"""
CivicSense AI — Production Zero-Data-Loss Migration Script (Corrected Schema)
Source:  SQLite (civicsense.db) in read-only mode with stable transaction snapshot
Target:  Supabase PostgreSQL (11 data tables) via Session Pooler (port 5432)
Model:   3-State Idempotent Reconciliation (MISSING, ALREADY_MATCHED, DATA_CONFLICT)
Safety:  Repeatable Read Isolation, Exclusive Table Locks, Post-Commit Sequence Sync
"""

import sys
import os
import json
import math
import sqlite3
from decimal import Decimal
from datetime import datetime
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Set
from dotenv import dotenv_values
from sqlalchemy import create_engine, text

# -----------------------------------------------------------------------------
# Data Structures
# -----------------------------------------------------------------------------
@dataclass
class FieldDifference:
    field_name: str
    source_val: Any
    target_val: Any

@dataclass
class RecordClassification:
    table_name: str
    record_id: Any
    status: str  # "MISSING", "ALREADY_MATCHED", "DATA_CONFLICT"
    differences: List[FieldDifference]
    source_payload: Dict[str, Any]

# -----------------------------------------------------------------------------
# Precise Column Typing Maps (Table-Aware)
# -----------------------------------------------------------------------------
TIMESTAMP_COLUMNS: Set[Tuple[str, str]] = {
    ("users", "created_at"),
    ("users", "updated_at"),
    ("incidents", "created_at"),
    ("reports", "created_at"),
    ("ai_analyses", "created_at"),
    ("workflow_history", "created_at"),
    ("audit_logs", "when"),
    ("notifications", "timestamp"),
    ("archive_workflow_history", "created_at"),
    ("archive_audit_logs", "when"),
    ("archive_notifications", "timestamp")
}

BOOLEAN_COLUMNS: Set[Tuple[str, str]] = {
    ("users", "is_active"),
    ("notifications", "read"),
    ("archive_notifications", "read")
}

FLOAT_COLUMNS: Set[Tuple[str, str]] = {
    ("incidents", "lat"),
    ("incidents", "lng"),
    ("incidents", "estimated_repair_cost"),
    ("incidents", "saved_early_intervention"),
    ("incidents", "confidence"),
    ("ai_analyses", "cv_confidence"),
    ("ai_analyses", "historical_failure_rate"),
    ("rate_limit_events", "timestamp")  # Unix epoch float
}

JSON_COLUMNS: Set[Tuple[str, str]] = {
    ("reports", "content_json"),
    ("ai_analyses", "objects_detected")
}

# -----------------------------------------------------------------------------
# Type-Aware Comparators (Zero Whitespace Trimming, Microsecond Preserving)
# -----------------------------------------------------------------------------
def parse_utc_timestamp(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    val_str = str(val)
    # Reject unsanitized whitespace around timestamp strings
    if val_str != val_str.strip():
        raise ValueError(f"Unsanitized whitespace detected around timestamp: '{val_str}'")
    
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S"
    ):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
    raise ValueError(f"Unable to parse timestamp: '{val}'")

def timestamps_equal(val1: Any, val2: Any) -> bool:
    if val1 is None and val2 is None:
        return True
    if val1 is None or val2 is None:
        return False
    dt1 = parse_utc_timestamp(val1)
    dt2 = parse_utc_timestamp(val2)
    return dt1 == dt2

def floats_equal(val1: Any, val2: Any, tol: float = 1e-9) -> bool:
    if val1 is None and val2 is None:
        return True
    if val1 is None or val2 is None:
        return False
    try:
        f1 = float(val1)
        f2 = float(val2)
        return math.isclose(f1, f2, rel_tol=tol, abs_tol=tol)
    except (ValueError, TypeError):
        return False

def json_strict_equal(v1: Any, v2: Any) -> bool:
    """
    Type-sensitive, recursive JSON equality check.
    Guarantees bool (True/False) is never equated with int (1/0).
    Detects missing keys, extra keys, and array order differences.
    """
    # Strict boolean vs numeric check
    if isinstance(v1, bool) or isinstance(v2, bool):
        if not (isinstance(v1, bool) and isinstance(v2, bool)):
            return False
        return v1 is v2

    if type(v1) != type(v2):
        if isinstance(v1, (int, float, Decimal)) and isinstance(v2, (int, float, Decimal)):
            return float(v1) == float(v2)
        return False

    if isinstance(v1, dict):
        if set(v1.keys()) != set(v2.keys()):
            return False
        for k in v1:
            if not json_strict_equal(v1[k], v2[k]):
                return False
        return True

    if isinstance(v1, list):
        if len(v1) != len(v2):
            return False
        for elem1, elem2 in zip(v1, v2):
            if not json_strict_equal(elem1, elem2):
                return False
        return True

    return v1 == v2

def jsons_equal(val1: Any, val2: Any) -> bool:
    if val1 is None and val2 is None:
        return True
    if val1 is None or val2 is None:
        return False
    obj1 = json.loads(val1) if isinstance(val1, str) else val1
    obj2 = json.loads(val2) if isinstance(val2, str) else val2
    return json_strict_equal(obj1, obj2)

def compare_values(table_name: str, col_name: str, src_val: Any, tgt_val: Any) -> bool:
    # 1. Null handling
    if src_val is None and tgt_val is None:
        return True
    if src_val is None or tgt_val is None:
        return False

    key = (table_name, col_name)

    # 2. Boolean fields (SQLite integer 0/1 vs PG boolean True/False)
    if key in BOOLEAN_COLUMNS:
        if isinstance(src_val, (int, bool)) and isinstance(tgt_val, (int, bool)):
            return bool(src_val) is bool(tgt_val)
        return False

    # 3. Timestamp fields (including 'when' in audit_logs)
    if key in TIMESTAMP_COLUMNS:
        return timestamps_equal(src_val, tgt_val)

    # 4. JSON fields
    if key in JSON_COLUMNS:
        return jsons_equal(src_val, tgt_val)

    # 5. Floating point fields (including rate_limit_events.timestamp)
    if key in FLOAT_COLUMNS:
        return floats_equal(src_val, tgt_val)

    # 6. String & Exact Fields (Zero whitespace trimming)
    return str(src_val) == str(tgt_val)

# -----------------------------------------------------------------------------
# Actual Canonical Table Specs (100% Parity with Live SQLite & Supabase)
# -----------------------------------------------------------------------------
TABLE_SPECS = [
    {
        "name": "users",
        "pk": "id",
        "columns": ["id", "email", "full_name", "hashed_password", "role", "department", "status", "is_active", "created_at", "updated_at"],
    },
    {
        "name": "incidents",
        "pk": "id",
        "columns": [
            "id", "title", "type", "severity", "status", "ward_id", "ward_name", "lat", "lng", "address",
            "priority_score", "estimated_repair_cost", "saved_early_intervention", "photo_url", "resolved_photo_url",
            "assigned_crew", "user_id", "confidence", "description", "recommended_department", "estimated_repair_time",
            "public_safety_risk", "environmental_impact", "future_damage_prediction", "ai_recommendation",
            "executive_summary", "explanation", "created_at", "assigned_engineer_id"
        ],
    },
    {
        "name": "reports",
        "pk": "id",
        "columns": ["id", "title", "report_type", "generated_by", "file_url", "content_json", "created_at"],
    },
    {
        "name": "ai_analyses",
        "pk": "id",
        "columns": [
            "id", "incident_id", "cv_confidence", "cv_model", "hospital_proximity_meters", "hospital_name",
            "road_classification", "duplicate_complaints_count", "estimated_daily_traffic", "historical_failure_rate",
            "weather_risk_factor", "summary", "objects_detected", "created_at"
        ],
    },
    {
        "name": "workflow_history",
        "pk": "id",
        "columns": ["id", "incident_id", "stage", "assigned_user", "department", "notes", "duration_seconds", "created_at"],
    },
    {
        "name": "audit_logs",
        "pk": "id",
        "columns": ["id", "incident_id", "who", "what", "when", "result"],
    },
    {
        "name": "notifications",
        "pk": "id",
        "columns": ["id", "incident_id", "type", "title", "message", "timestamp", "read"],
    },
    {
        "name": "rate_limit_events",
        "pk": "id",
        "columns": ["id", "key", "timestamp"],
    },
    # Archive tables (for orphan records whose incident_id is not in incidents)
    {
        "name": "archive_workflow_history",
        "source_table": "workflow_history",
        "pk": "id",
        "columns": ["id", "incident_id", "stage", "assigned_user", "department", "notes", "duration_seconds", "created_at"],
        "is_archive": True
    },
    {
        "name": "archive_audit_logs",
        "source_table": "audit_logs",
        "pk": "id",
        "columns": ["id", "incident_id", "who", "what", "when", "result"],
        "is_archive": True
    },
    {
        "name": "archive_notifications",
        "source_table": "notifications",
        "pk": "id",
        "columns": ["id", "incident_id", "type", "title", "message", "timestamp", "read"],
        "is_archive": True
    }
]

# -----------------------------------------------------------------------------
# Transform Payload for PostgreSQL Driver
# -----------------------------------------------------------------------------
def transform_payload(table_name: str, row_dict: Dict[str, Any]) -> Dict[str, Any]:
    transformed = dict(row_dict)
    for col, val in transformed.items():
        if val is None:
            continue
        key = (table_name, col)
        if key in BOOLEAN_COLUMNS:
            transformed[col] = bool(val)
        elif key in TIMESTAMP_COLUMNS:
            transformed[col] = parse_utc_timestamp(val)
        elif key in JSON_COLUMNS:
            if isinstance(val, (dict, list)):
                transformed[col] = json.dumps(val)
            elif isinstance(val, str):
                transformed[col] = val
        elif key in FLOAT_COLUMNS:
            transformed[col] = float(val)
    return transformed

# -----------------------------------------------------------------------------
# Build Safe INSERT SQL with Quoted Columns
# -----------------------------------------------------------------------------
def build_insert_sql(table_name: str, columns: List[str]) -> str:
    quoted_cols = [f'"{col}"' for col in columns]
    placeholders = [f":{col}" for col in columns]
    return f'INSERT INTO public."{table_name}" ({", ".join(quoted_cols)}) VALUES ({", ".join(placeholders)})'

# -----------------------------------------------------------------------------
# Main Migration Procedure
# -----------------------------------------------------------------------------
def execute_migration(sqlite_path: str, pg_url: str) -> None:
    # 1. Connect to SQLite in read-only URI mode with stable point-in-time snapshot
    sqlite_uri = f"file:{os.path.abspath(sqlite_path)}?mode=ro"
    s_conn = sqlite3.connect(sqlite_uri, uri=True)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()
    # Establish stable snapshot across all queries
    s_cur.execute("BEGIN;")

    s_cur.execute("SELECT id FROM incidents;")
    valid_incident_ids = set(r[0] for r in s_cur.fetchall())

    # 2. Configure target engine with REPEATABLE READ isolation upfront
    pg_engine = create_engine(pg_url, isolation_level="REPEATABLE READ", pool_pre_ping=True)

    # 3. Begin Target Transaction with EXCLUSIVE Table Locks
    with pg_engine.connect() as pg_conn:
        with pg_conn.begin():
            print("[Locking] Acquiring EXCLUSIVE lock on all 11 target tables...")
            all_table_names = [spec["name"] for spec in TABLE_SPECS]
            quoted_tables = [f'public."{t}"' for t in all_table_names]
            lock_sql = f'LOCK TABLE {", ".join(quoted_tables)} IN EXCLUSIVE MODE;'
            pg_conn.execute(text(lock_sql))
            print("  PASS: Locks acquired. Concurrent writes blocked.")

            # 4. Classify all 401 records (Field-by-field comparison)
            all_classifications: List[RecordClassification] = []

            for spec in TABLE_SPECS:
                tname = spec["name"]
                pk_col = spec["pk"]
                cols = spec["columns"]
                is_archive = spec.get("is_archive", False)
                source_table = spec.get("source_table", tname)

                # Fetch source records
                if not is_archive:
                    if source_table in ("workflow_history", "audit_logs", "notifications"):
                        placeholders = ",".join(["?"] * len(valid_incident_ids))
                        query = f"SELECT * FROM [{source_table}] WHERE incident_id IN ({placeholders});"
                        s_cur.execute(query, list(valid_incident_ids))
                    else:
                        s_cur.execute(f"SELECT * FROM [{source_table}];")
                else:
                    placeholders = ",".join(["?"] * len(valid_incident_ids))
                    query = f"SELECT * FROM [{source_table}] WHERE incident_id NOT IN ({placeholders});"
                    s_cur.execute(query, list(valid_incident_ids))

                source_records = [dict(r) for r in s_cur.fetchall()]

                # Fetch existing target records
                quoted_cols = [f'"{c}"' for c in cols]
                tgt_res = pg_conn.execute(text(f'SELECT {", ".join(quoted_cols)} FROM public."{tname}";')).fetchall()
                target_map = {r._mapping[pk_col]: dict(r._mapping) for r in tgt_res}

                # Evaluate each source record field-by-field
                for s_row in source_records:
                    rec_id = s_row[pk_col]
                    if rec_id not in target_map:
                        all_classifications.append(RecordClassification(
                            table_name=tname,
                            record_id=rec_id,
                            status="MISSING",
                            differences=[],
                            source_payload=s_row
                        ))
                    else:
                        t_row = target_map[rec_id]
                        diffs = []
                        for col in cols:
                            if not compare_values(tname, col, s_row[col], t_row[col]):
                                diffs.append(FieldDifference(col, s_row[col], t_row[col]))
                        if not diffs:
                            all_classifications.append(RecordClassification(
                                table_name=tname,
                                record_id=rec_id,
                                status="ALREADY_MATCHED",
                                differences=[],
                                source_payload=s_row
                            ))
                        else:
                            all_classifications.append(RecordClassification(
                                table_name=tname,
                                record_id=rec_id,
                                status="DATA_CONFLICT",
                                differences=diffs,
                                source_payload=s_row
                            ))

            # 5. Check for conflicts
            conflicts = [c for c in all_classifications if c.status == "DATA_CONFLICT"]
            if conflicts:
                print(f"FATAL: {len(conflicts)} DATA_CONFLICT records detected! Rolling back.")
                for conf in conflicts[:10]:
                    print(f"  Conflict in table '{conf.table_name}' ID '{conf.record_id}':")
                    for d in conf.differences:
                        print(f"    - {d.field_name}: src='{d.source_val}' != tgt='{d.target_val}'")
                raise RuntimeError(f"Migration aborted due to {len(conflicts)} data conflicts. Zero data overwritten.")

            missing = [c for c in all_classifications if c.status == "MISSING"]
            matched = [c for c in all_classifications if c.status == "ALREADY_MATCHED"]
            print(f"Classification Summary: Total={len(all_classifications)}, Matched={len(matched)}, Missing={len(missing)}, Conflicts=0")

            # 6. Insert missing records in topological order
            if missing:
                for spec in TABLE_SPECS:
                    tname = spec["name"]
                    table_missing = [c for c in missing if c.table_name == tname]
                    if table_missing:
                        print(f"Inserting {len(table_missing)} missing rows into {tname}...")
                        insert_sql = build_insert_sql(tname, spec["columns"])
                        payloads = [transform_payload(tname, c.source_payload) for c in table_missing]
                        pg_conn.execute(text(insert_sql), payloads)
                        print(f"  PASS: {tname} batch insert complete.")

            # 7. In-transaction row count verification
            total_target_rows = 0
            for spec in TABLE_SPECS:
                tname = spec["name"]
                cnt = pg_conn.execute(text(f'SELECT count(*) FROM public."{tname}";')).scalar()
                total_target_rows += cnt

            if total_target_rows != 401:
                raise RuntimeError(f"FATAL: In-transaction count check failed! Expected 401, got {total_target_rows}. Rolling back.")

            print(f"In-Transaction Verification: Exactly {total_target_rows} rows present. Committing transaction...")

        # Transaction commits here when exiting `with pg_conn.begin():`
        print("PASS: Migration transaction committed successfully.")

    # 8. Post-Commit Sequence Synchronization
    print("[Sequences] Synchronizing sequences strictly AFTER successful data commit...")
    with pg_engine.connect() as pg_conn:
        with pg_conn.begin():
            seq_queries = [
                "SELECT setval(pg_get_serial_sequence('public.audit_logs', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.audit_logs;",
                "SELECT setval(pg_get_serial_sequence('public.workflow_history', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.workflow_history;",
                "SELECT setval(pg_get_serial_sequence('public.rate_limit_events', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.rate_limit_events;"
            ]
            for q in seq_queries:
                pg_conn.execute(text(q))
        print("PASS: All 3 sequences synchronized.")

    # 9. Clean up read snapshot
    s_conn.rollback()
    s_conn.close()
    pg_engine.dispose()
    print("Zero-Data-Loss Migration verified successfully.")
