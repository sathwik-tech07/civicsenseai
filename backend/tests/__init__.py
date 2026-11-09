"""
CivicSense AI - Backend Test Package Initialization
Ensures complete isolation from the canonical production/development database.
Clones a clean ephemeral test database from the verified raw snapshot backup.
"""

import os
import sys
import shutil

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
repo_dir = os.path.abspath(os.path.join(backend_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Path to pristine snapshot and disposable test DB
raw_snapshot = os.path.join(repo_dir, "database_backups", "civicsense_raw_snapshot_20261109_162654.db")
test_db_path = os.path.join(repo_dir, "civicsense_test_isolated.db")

# Seed disposable test database from pristine raw snapshot
if os.path.exists(raw_snapshot):
    shutil.copyfile(raw_snapshot, test_db_path)
    os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path.replace(chr(92), '/')}"
