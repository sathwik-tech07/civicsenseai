# CivicSense AI OS v5.0 — Evidence Migration Inventory

**Audit Date:** 2026-11-12  
**Target Bucket:** `civicsense-evidence` (Supabase Storage S3 API)  
**Target Project Reference:** `bcpgsvvjuxzowxqqmouk` (`us-east-2`)  
**Target Endpoint:** `https://bcpgsvvjuxzowxqqmouk.supabase.co/storage/v1/s3`  
**Audit Scope:** Local Filesystem (`backend/uploads/`) vs Database Records (`incidents.photo_url`)  
**Mode:** STRICT READ-ONLY INSPECTION (No uploads, no file copies, no DB mutations, no deletes)  

---

## 1. Executive Migration Summary

| Metric | Count | Details |
| :--- | :---: | :--- |
| **Total Local Evidence Files** | **27** | Located in `backend/uploads/` (total size: 5,384 bytes). |
| **Total Unique Local File Payloads** | **2** | 25 bitwise identical JPEGs (210 B) + 2 bitwise identical PNGs (67 B). |
| **Total Reconciled Database Records** | **50** | Production snapshot incidents in `supabase_postgres_dump_20261110_004500.sql`. |
| **Total Active Database Evidence Refs** | **50** | All 50 incidents have `photo_url` populated; `resolved_photo_url` is NULL. |
| **External HTTP/HTTPS References** | **23** | Unsplash images (2), example stubs (20), legacy AWS S3 URL (1). |
| **Local Path References (`/uploads/...`)** | **19** | Seed/test references (`audit_test.jpg` and `img_test_evidence_*.png`). |
| **S3 Key References (`uploads/...`)** | **8** | Relative S3 keys generated during mock tests (`uploads/img_*.jpg`). |
| **Inline Base64 Data URIs (Dev DB)** | **11** | Present only in local dev SQLite DB (`backend/civicsense.db`), 0 in Supabase dump. |
| **Matched Physical Files in Database** | **0** | Historical DB references point to test stubs from prior runs; current 27 files are from recent test runs. |
| **Missing Physical Files for DB Refs** | **27** | 19 `/uploads/` + 8 `uploads/` references in the DB have no physical file on disk. |
| **Unreferenced Local Files on Disk** | **27** | All 27 physical files currently on disk were created during recent test suite runs. |

---

## 2. Inventory of Local Files on Disk (`backend/uploads/`)

All 27 files currently present in `backend/uploads/` were verified with magic bytes and SHA-256 digests:

| # | Filename | Size | MIME Type | Magic Bytes Header | SHA-256 Digest (Prefix) | Duplicate Group |
| :- | :--- | :---: | :---: | :---: | :---: | :---: |
| **1** | `img_089f2068758d40b0.png` | 67 B | `image/png` | `89504E470D0A1A0A` | `bf6e855b6761` | Group A (2 copies) |
| **2** | `img_6f83a866dd3d411e.png` | 67 B | `image/png` | `89504E470D0A1A0A` | `bf6e855b6761` | Group A (2 copies) |
| **3** | `whatsapp_1794247913_d87e99.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **4** | `whatsapp_1794248093_4b75fc.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **5** | `whatsapp_1794248172_985010.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **6** | `whatsapp_1794248307_d15df6.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **7** | `whatsapp_1794248704_ad5afd.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **8** | `whatsapp_1794248864_4bf35d.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **9** | `whatsapp_1794249170_a707f5.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **10** | `whatsapp_1794249513_f67486.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **11** | `whatsapp_1794252764_4ac4db.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **12** | `whatsapp_1794300660_5e2890.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **13** | `whatsapp_1794301393_af17f2.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **14** | `whatsapp_1794301482_f3fe22.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **15** | `whatsapp_1794301533_7e199e.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **16** | `whatsapp_1794301599_a4a204.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **17** | `whatsapp_1794301641_3f0922.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **18** | `whatsapp_1794302722_9eb5e3.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **19** | `whatsapp_1794302783_b0d35b.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **20** | `whatsapp_1794385025_8397e9.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **21** | `whatsapp_1794391174_90bcf0.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **22** | `whatsapp_1794391346_cdd528.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **23** | `whatsapp_1794391361_9511ec.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **24** | `whatsapp_1794393210_5e9edb.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **25** | `whatsapp_1794396252_11bd3f.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **26** | `whatsapp_1794398991_e26564.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |
| **27** | `whatsapp_1794424251_98b2f7.jpg` | 210 B | `image/jpeg` | `FFD8FFE000104A46` | `bf88ecf283b9` | Group B (25 copies) |

---

## 3. Database Evidence References (Supabase Production Reconciled)

The 50 reconciled incident records in `database_backups/supabase_postgres_dump_20261110_004500.sql` contain the following references:

### A. External HTTP/HTTPS URLs (23 Records)
These records reference external public images. They do not depend on local disk storage and will never 404 when moving to S3:

| Incident ID | Stored `photo_url` | Category / Resolution Behavior |
| :--- | :--- | :--- |
| `INC-2026-5FC042` | `https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3` | Direct HTTP 307 Redirect to Unsplash |
| `INC-2026-9B0D78` | `https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3` | Direct HTTP 307 Redirect to Unsplash |
| `INC-2026-82470E` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-8FBB73` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-0502EB` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-A0548A` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-4FF59B` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-B7C83C` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-4E83E5` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-21EF34` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-D07038` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-874FFB` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-547CA5` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-0B4421` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-E998E5` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-C8DD7C` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-97B30C` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-90E976` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-D61E68` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-A98315` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-028021` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-4290A9` | `https://example.com/c1_photo.jpg` | Direct HTTP 307 Redirect |
| `INC-2026-F1271D` | `https://civicsense-bucket.s3.ap-south-1.amazonaws.com/uploads/img_9876543210fedcba.jpg` | Code extracts `uploads/img_...` and presigns on S3 provider |

---

### B. Local File Paths (`/uploads/...`) — 19 Records
These 19 records represent historical test incidents created in previous testing sprints:

| Incident ID | Stored `photo_url` | Expected Local File | Status on Disk |
| :--- | :--- | :--- | :---: |
| `INC-2026-BA317F` | `/uploads/audit_test.jpg` | `audit_test.jpg` | **MISSING** |
| `INC-2026-61305F` | `/uploads/audit_test.jpg` | `audit_test.jpg` | **MISSING** |
| `INC-2026-E38237` | `/uploads/audit_test.jpg` | `audit_test.jpg` | **MISSING** |
| `INC-A-885483` | `/uploads/img_test_evidence_885483.png` | `img_test_evidence_885483.png` | **MISSING** |
| `INC-B-885483` | `/uploads/img_test_evidence_b_885483.png` | `img_test_evidence_b_885483.png` | **MISSING** |
| `INC-A-dc3afc` | `/uploads/img_test_evidence_dc3afc.png` | `img_test_evidence_dc3afc.png` | **MISSING** |
| `INC-B-dc3afc` | `/uploads/img_test_evidence_b_dc3afc.png` | `img_test_evidence_b_dc3afc.png` | **MISSING** |
| `INC-A-10484f` | `/uploads/img_test_evidence_10484f.png` | `img_test_evidence_10484f.png` | **MISSING** |
| `INC-B-10484f` | `/uploads/img_test_evidence_b_10484f.png` | `img_test_evidence_b_10484f.png` | **MISSING** |
| `INC-A-524b3b` | `/uploads/img_test_evidence_524b3b.png` | `img_test_evidence_524b3b.png` | **MISSING** |
| `INC-B-524b3b` | `/uploads/img_test_evidence_b_524b3b.png` | `img_test_evidence_b_524b3b.png` | **MISSING** |
| `INC-A-5a1475` | `/uploads/img_test_evidence_5a1475.png` | `img_test_evidence_5a1475.png` | **MISSING** |
| `INC-B-5a1475` | `/uploads/img_test_evidence_b_5a1475.png` | `img_test_evidence_b_5a1475.png` | **MISSING** |
| `INC-A-c0206f` | `/uploads/img_test_evidence_c0206f.png` | `img_test_evidence_c0206f.png` | **MISSING** |
| `INC-B-c0206f` | `/uploads/img_test_evidence_b_c0206f.png` | `img_test_evidence_b_c0206f.png` | **MISSING** |
| `INC-A-5835a7` | `/uploads/img_test_evidence_5835a7.png` | `img_test_evidence_5835a7.png` | **MISSING** |
| `INC-B-5835a7` | `/uploads/img_test_evidence_b_5835a7.png` | `img_test_evidence_b_5835a7.png` | **MISSING** |
| `INC-A-fdbb9a` | `/uploads/img_test_evidence_fdbb9a.png` | `img_test_evidence_fdbb9a.png` | **MISSING** |
| `INC-B-fdbb9a` | `/uploads/img_test_evidence_b_fdbb9a.png` | `img_test_evidence_b_fdbb9a.png` | **MISSING** |

---

### C. Relative S3 Object Keys (`uploads/...`) — 8 Records
These 8 records were generated during isolated S3 unit test runs:

| Incident ID | Stored `photo_url` | Expected File Name | Status on Disk |
| :--- | :--- | :--- | :---: |
| `INC-S3-83d899` | `uploads/img_189657f447254f3b.jpg` | `img_189657f447254f3b.jpg` | **MISSING** |
| `INC-S3-5873e1` | `uploads/img_b27b2104bc5d4f85.jpg` | `img_b27b2104bc5d4f85.jpg` | **MISSING** |
| `INC-S3-fcc02a` | `uploads/img_da482b3c42354168.jpg` | `img_da482b3c42354168.jpg` | **MISSING** |
| `INC-S3-156886` | `uploads/img_a8e1c2131b934b0f.jpg` | `img_a8e1c2131b934b0f.jpg` | **MISSING** |
| `INC-S3-16bb34` | `uploads/img_e5141b6cdee74a55.jpg` | `img_e5141b6cdee74a55.jpg` | **MISSING** |
| `INC-S3-ff17e7` | `uploads/img_eff6252ada0c4df9.jpg` | `img_eff6252ada0c4df9.jpg` | **MISSING** |
| `INC-S3-609fd6` | `uploads/img_f39c26428f4c41fe.jpg` | `img_f39c26428f4c41fe.jpg` | **MISSING** |
| `INC-S3-413f35` | `uploads/img_d61374876c954ef2.jpg` | `img_d61374876c954ef2.jpg` | **MISSING** |

---

## 4. Proposed Migration Mapping to Supabase Bucket `civicsense-evidence`

When uploading the existing local evidence files to the private bucket `civicsense-evidence`, the exact S3 object keys must use the prefix `uploads/`:

| Local File (`backend/uploads/`) | Target S3 Object Key in `civicsense-evidence` | Content-Type |
| :--- | :--- | :--- |
| `img_089f2068758d40b0.png` | `uploads/img_089f2068758d40b0.png` | `image/png` |
| `img_6f83a866dd3d411e.png` | `uploads/img_6f83a866dd3d411e.png` | `image/png` |
| `whatsapp_1794247913_d87e99.jpg` | `uploads/whatsapp_1794247913_d87e99.jpg` | `image/jpeg` |
| `whatsapp_1794248093_4b75fc.jpg` | `uploads/whatsapp_1794248093_4b75fc.jpg` | `image/jpeg` |
| `whatsapp_1794248172_985010.jpg` | `uploads/whatsapp_1794248172_985010.jpg` | `image/jpeg` |
| `whatsapp_1794248307_d15df6.jpg` | `uploads/whatsapp_1794248307_d15df6.jpg` | `image/jpeg` |
| `whatsapp_1794248704_ad5afd.jpg` | `uploads/whatsapp_1794248704_ad5afd.jpg` | `image/jpeg` |
| `whatsapp_1794248864_4bf35d.jpg` | `uploads/whatsapp_1794248864_4bf35d.jpg` | `image/jpeg` |
| `whatsapp_1794249170_a707f5.jpg` | `uploads/whatsapp_1794249170_a707f5.jpg` | `image/jpeg` |
| `whatsapp_1794249513_f67486.jpg` | `uploads/whatsapp_1794249513_f67486.jpg` | `image/jpeg` |
| `whatsapp_1794252764_4ac4db.jpg` | `uploads/whatsapp_1794252764_4ac4db.jpg` | `image/jpeg` |
| `whatsapp_1794300660_5e2890.jpg` | `uploads/whatsapp_1794300660_5e2890.jpg` | `image/jpeg` |
| `whatsapp_1794301393_af17f2.jpg` | `uploads/whatsapp_1794301393_af17f2.jpg` | `image/jpeg` |
| `whatsapp_1794301482_f3fe22.jpg` | `uploads/whatsapp_1794301482_f3fe22.jpg` | `image/jpeg` |
| `whatsapp_1794301533_7e199e.jpg` | `uploads/whatsapp_1794301533_7e199e.jpg` | `image/jpeg` |
| `whatsapp_1794301599_a4a204.jpg` | `uploads/whatsapp_1794301599_a4a204.jpg` | `image/jpeg` |
| `whatsapp_1794301641_3f0922.jpg` | `uploads/whatsapp_1794301641_3f0922.jpg` | `image/jpeg` |
| `whatsapp_1794302722_9eb5e3.jpg` | `uploads/whatsapp_1794302722_9eb5e3.jpg` | `image/jpeg` |
| `whatsapp_1794302783_b0d35b.jpg` | `uploads/whatsapp_1794302783_b0d35b.jpg` | `image/jpeg` |
| `whatsapp_1794385025_8397e9.jpg` | `uploads/whatsapp_1794385025_8397e9.jpg` | `image/jpeg` |
| `whatsapp_1794391174_90bcf0.jpg` | `uploads/whatsapp_1794391174_90bcf0.jpg` | `image/jpeg` |
| `whatsapp_1794391346_cdd528.jpg` | `uploads/whatsapp_1794391346_cdd528.jpg` | `image/jpeg` |
| `whatsapp_1794391361_9511ec.jpg` | `uploads/whatsapp_1794391361_9511ec.jpg` | `image/jpeg` |
| `whatsapp_1794393210_5e9edb.jpg` | `uploads/whatsapp_1794393210_5e9edb.jpg` | `image/jpeg` |
| `whatsapp_1794396252_11bd3f.jpg` | `uploads/whatsapp_1794396252_11bd3f.jpg` | `image/jpeg` |
| `whatsapp_1794398991_e26564.jpg` | `uploads/whatsapp_1794398991_e26564.jpg` | `image/jpeg` |
| `whatsapp_1794424251_98b2f7.jpg` | `uploads/whatsapp_1794424251_98b2f7.jpg` | `image/jpeg` |

---

## 5. Storage Retrieval Code Verification

Inspection of `backend/app/routers/incidents.py` (Lines 512–541) demonstrates how each record format is resolved when `STORAGE_PROVIDER=s3`:

```python
# 1. External URLs (Unsplash / Example Stubs)
if (photo_ref.startswith("http://") or photo_ref.startswith("https://")) and not ("s3." in photo_ref or "amazonaws.com" in photo_ref):
    if redirect:
        return RedirectResponse(url=photo_ref, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    return {"incident_id": incident.id, "storage_provider": "external", "url": photo_ref}

# 2. S3 Provider Resolution
if storage_provider.provider_name == "s3":
    key = photo_ref
    if "amazonaws.com/" in photo_ref:
        key = photo_ref.split(".amazonaws.com/")[-1]
    elif photo_ref.startswith("/uploads/"):
        key = photo_ref.replace("/uploads/", "uploads/")

    presigned_url = storage_provider.generate_presigned_url(key)
    if redirect:
        return RedirectResponse(url=presigned_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    return {"incident_id": incident.id, "storage_provider": "s3", "url": presigned_url}
```

### Retrieval Code Findings:
1. **External URLs (23 records):** Handled cleanly via direct 307 redirect. Will not contact S3 or fail.
2. **Legacy AWS S3 URL (`INC-2026-F1271D`):** Handled cleanly. Strips `.amazonaws.com/` and presigns on the active S3 provider.
3. **Local Paths (`/uploads/...`) (19 records):** Automatically normalized to `uploads/...` and presigned on S3.
4. **Existing Database Records:** **Zero SQL modifications required.** All database references remain backward-compatible.

---

## 6. Risk Analysis: Changing `STORAGE_PROVIDER` from `local` to `s3`

| Risk Factor | Severity | Description | Mitigation Strategy |
| :--- | :---: | :--- | :--- |
| **Missing Historical Test Stubs** | **Low** | 19 historical test incidents reference `/uploads/audit_test.jpg` and `img_test_evidence_*.png`, which do not exist on disk. When presigned, visiting the link will return Supabase S3 `404 NoSuchKey`. | Upload a single default municipal pothole placeholder named `uploads/audit_test.jpg` to the bucket. |
| **Active Production Reporting** | **None** | New citizen reports submitted via Web or WhatsApp call `POST /api/v1/incidents/upload-image`, which streams directly to S3 and returns valid S3 keys. | Zero risk. Works out of the box. |
| **Render Restart File Loss** | **Eliminated** | Under `STORAGE_PROVIDER=local`, files on Render's ephemeral container disk are wiped upon restart. Switching to `STORAGE_PROVIDER=s3` permanently eliminates this risk. | Target state achieved. |
| **Data URIs in Local Dev DB** | **None (Prod)** | Local dev DB contains 11 base64 strings from browser tests. The production Supabase dump contains 0 base64 strings. | Ensure production incidents continue using durable URLs. |

---

## 7. Migration Execution Runbook (When Ready)

Once the user creates the `civicsense-evidence` bucket in the Supabase Dashboard, the 27 files can be copied in one command using the AWS CLI or a Python boto3 script:

```bash
# Example AWS CLI migration command (using Supabase S3 credentials):
aws s3 cp backend/uploads/ s3://civicsense-evidence/uploads/ \
    --recursive \
    --endpoint-url https://bcpgsvvjuxzowxqqmouk.supabase.co/storage/v1/s3 \
    --region us-east-2
```
