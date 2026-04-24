# scAuditor_infra — Session Summary

## Session: Deploy Fixes and First Full Deploy

**Date:** 2026-04-24

---

### Summary

Completed the first successful end-to-end deployment of both the `scAuditor_infra` and `scAuditor_agent` bundles to the dev target. The session focused on fixing deployment blockers in `deploy.sh`, optimizing Delta table properties, isolating Lakebase projects per target, and correcting cross-bundle schema references.

---

### Changes Made

#### 1. Delta Table Properties Optimization

**File:** `src/uc_setup/target-tables-ddl` (notebook ID: 3441550612453067)

**Added to all 6 tables:**
- `delta.enableDeletionVectors = true` — avoids full Parquet rewrites on UPDATE/DELETE/MERGE
- `delta.enableRowTracking = true` — foundation for CDF streaming consumers
- `delta.enableTypeWidening = true` — safe schema evolution (INT→BIGINT, etc.)
- `delta.enableVariantShredding = true` — physically separates frequently-accessed VARIANT fields

**Removed from all 6 tables:**
- `delta.feature.variantType-preview` — auto-set by platform when VARIANT columns used
- `delta.minReaderVersion` / `delta.minWriterVersion` — docs recommend against manual pinning
- `delta.feature.allowColumnDefaults` — removed from 5 tables; kept on `target_systems` only (required for `DEFAULT 0`)

**Verification:** `DESCRIBE EXTENDED target_systems` confirmed all properties set. Platform auto-set protocol versions to minReaderVersion=3, minWriterVersion=7.

#### 2. Lakebase Project Isolation (Target-Specific project_id)

**Problem:** Both `dev` and `hls_fde` targets used `project_id: sc-auditor`, causing them to share the same OLTP database. Dev testing could corrupt production operational data.

**Files modified:**
- `scAuditor_infra/databricks.yml` — added `lakebase_project_id` variable with per-target values
- `scAuditor_infra/resources/auditor.lakebase.yml` — uses `${var.lakebase_project_id}`, added documentation comment block
- `scAuditor_agent/databricks.yml` — updated `postgres_branch` and `postgres_database` per target
- `deploy.sh` — updated `resolve_infra_vars` to read the variable

**Result:**
- Dev: `dev-matthew-giglia-sc-auditor` (new project, isolated database `db-mkbq-j1jpixj372`)
- hls_fde: `sc-auditor` (existing project, unchanged, database `db-tcbk-ln6y1dmkax`)

#### 3. deploy.sh — stderr Contaminating JSON Parsing

**Problem:** `2>&1` redirects on lines 184, 321, 330, 402 merged CLI stderr warnings into JSON output variables, breaking Python JSON parsers.

**Fix:** Removed `2>&1` from all JSON capture commands (`bundle summary`, `get-project`, `list-endpoints`, `list-secrets`). stderr flows to terminal naturally.

#### 4. deploy.sh — list-secrets JSON Format Mismatch

**Problem:** CLI `--output json` returns bare array `[{"key": "..."}]`, but parser expected REST API format `{"secrets": [...]}`.

**Fix (line ~415-420):** Updated Python parser to handle both formats:
```python
secrets = data.get('secrets', data) if isinstance(data, dict) else data
```

#### 5. deploy.sh — Lakebase Project ID Resolution

**Problem:** `resolve_infra_vars()` only checked `postgres_projects` resource, didn't read `lakebase_project_id` variable.

**Fix (line ~232-239):** Prefer variable, fallback to resource:
```python
project_id = get_var('lakebase_project_id')
if not project_id:
    pg_projects = resources.get('postgres_projects', {})
```

#### 6. deploy.sh — Workspace Host from Bundle Summary

**Problem:** `workspace_url` was a hardcoded key name in `build_key_arrays`. The workspace host value is already available from `workspace.host` in the bundle summary.

**Fix:** Extract `workspace_host` from `data.get('workspace', {}).get('host', '')` in `resolve_infra_vars`. Added `safe_url()` sanitizer that preserves `:` and `/` (the standard `safe()` stripped them, producing `httpsfevm-hls-fde.cloud.databricks.com`).

**Result:** `WORKSPACE_HOST` resolved at runtime from the bundle — no new variable needed.

#### 7. deploy.sh — Lakebase get-project CLI Path

**Problem:** `databricks postgres get-project "${project_id}"` used just the project ID, but the CLI expects the full resource path.

**Fix:** Changed to `databricks postgres get-project "projects/${project_id}"` — matching the pattern `list-endpoints` already used.

#### 8. CLI Secrets Syntax Corrections

**Files:** `README.md`, `resources/auditor.secret_scope.yml`, `deploy.sh`

**Corrected:** `put-secret` and `list-secrets` use positional scope/key arguments, not `--scope`/`--key` flags.

#### 9. Agent Bundle Schema Fix

**File:** `scAuditor_agent/databricks.yml`

**Problem:** Dev target had `schema: sc_auditor`, but DABs development mode prefixes the deployed schema to `dev_matthew_giglia_sc_auditor`. App deployment failed with `SCHEMA_DOES_NOT_EXIST: Schema 'hls_fde_dev.sc_auditor' does not exist`.

**Fix:** Updated dev target:
```yaml
schema: dev_matthew_giglia_sc_auditor   # was: sc_auditor
client_id_dbs_key: client_id_${var.schema}       # simplified — prefix baked into schema var
client_secret_dbs_key: client_secret_${var.schema}
```

#### 10. Lakebase Database Resource Naming Fix

**File:** `scAuditor_agent/databricks.yml`

**Problem:** Agent bundle referenced `databases/databricks_postgres`, but Lakebase uses auto-generated IDs. `databricks_postgres` is the internal Postgres database name, not the Lakebase resource identifier.

**Fix:** Updated both targets with actual database IDs discovered via `databricks postgres list-databases`.

---

### Deployment Status

**First full deploy: SUCCESS**

Command: `./deploy.sh --target dev`

| Stage | Result |
| --- | --- |
| Validate scAuditor_infra | Validation OK |
| Deploy scAuditor_infra | Deployment complete |
| Resolve infrastructure variables | All 7 variables resolved (including workspace host) |
| Verify infrastructure readiness | All 4 checks passed (3 secrets, 1 table) |
| Check Lakebase project status | Project exists, compute endpoint running |
| Validate scAuditor_agent | Validation OK |
| Deploy scAuditor_agent | Deployment complete |

**Dev resources deployed:**
- UC schema: `hls_fde_dev.dev_matthew_giglia_sc_auditor`
- SQL warehouse: `[dev matthew_giglia] SC Auditor Infra [dev]` (ID: e42b65b06218c16d)
- Secret scope: `sc_auditor_credentials` (3 keys)
- Lakebase project: `dev-matthew-giglia-sc-auditor` (PG17, 0.5–2 CU)
- Volumes: `screenshots`, `reports`
- 6 analytical tables with optimized TBLPROPERTIES
- SPN: `sc-auditor-dev_matthew_giglia_sc_auditor` (app ID: 4085f2a9-a250-46d4-a829-8628d8916573)
- App: scAuditor_agent deployed

---

### Design Decisions

1. **No `workspace_url_dbs_key` variable** — The workspace host is already available from `workspace.host` in the bundle summary. Adding a variable would duplicate information already in `databricks.yml` target config. The secret key name `workspace_url` remains a fixed convention across all targets.

2. **`safe_url()` vs modifying `safe()`** — A separate sanitizer for URL values avoids weakening shell eval safety for other variables. Only `WORKSPACE_HOST` uses `safe_url()`; all other variables use the stricter `safe()`.

3. **Schema variable carries dev prefix** — Rather than constructing the prefixed name dynamically, the agent bundle's dev target explicitly sets `schema: dev_matthew_giglia_sc_auditor`. This makes secret key derivation (`client_id_${var.schema}`) correct without string concatenation.

---

### Known Issues

1. **Data API status** — Lakebase check reports "Data API status could not be confirmed" — this is expected and informational. AppKit connects via direct Postgres wire protocol, not the Data API.

2. **Query tags cell** — `SET QUERY_TAGS` only works on SQL warehouses, not serverless interactive compute. The UC setup job uses a SQL warehouse so this succeeds in production; fails on interactive clusters.

---

### Files Modified

| File | Changes |
| --- | --- |
| `scAuditor_infra/databricks.yml` | Added `lakebase_project_id` variable with per-target values |
| `scAuditor_infra/resources/auditor.lakebase.yml` | Uses `${var.lakebase_project_id}`, added resource ID documentation |
| `scAuditor_infra/resources/auditor.secret_scope.yml` | Fixed CLI syntax in comments |
| `scAuditor_infra/resources/uc_setup.job.yml` | Removed stale `workspace_url_dbs_key` parameter |
| `scAuditor_infra/README.md` | Fixed CLI syntax in deployment instructions |
| `scAuditor_infra/src/uc_setup/target-tables-ddl` | Updated TBLPROPERTIES for all 6 tables |
| `scAuditor_agent/databricks.yml` | Fixed schema, secret key names, postgres_branch, postgres_database per target |
| `deploy.sh` | Fixed stderr redirects, JSON parser, lakebase resolution, workspace host extraction, safe_url(), get-project path |
