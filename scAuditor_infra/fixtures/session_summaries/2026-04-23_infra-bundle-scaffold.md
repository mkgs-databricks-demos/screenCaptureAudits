# scAuditor_infra — Session Summary

## Session: Infrastructure Bundle Scaffold

**Date:** 2026-04-23
**Branch:** `mg-initial-scaffold`
**Commits:** `39721fe`, `8693b1d`, `dc35223`, `c1bf43e`

---

### What Was Built

The full `scAuditor_infra` infrastructure bundle was created from scratch, following the two-bundle DAB pattern established in `dbxWearables/zeroBus/dbxW_zerobus_infra`. This bundle owns all shared Databricks infrastructure for the SC Auditor screen capture audit tool.

---

### Changes Made

#### 1. Bundle Configuration (`39721fe`)

Created `databricks.yml` with:
- **Variables:** `catalog`, `schema` (feed only the schema resource), `secret_scope_name`, `client_id_dbs_key`, `client_secret_dbs_key`, `run_as_user`, `higher_level_service_principal`, `serverless_environment_version`, 5 tag variables
- **Three targets:** `dev` (hls_fde_dev, development mode), `hls_fde` (hls_fde, production), `prod` (placeholder)
- **Conventions:** Resource substitution via `${resources.schemas.sc_auditor_schema.*}`, schema-qualified secret keys to avoid collisions in shared scope

#### 2. Resource Definitions (`8693b1d`)

Created 6 resource YAML files:

| Resource | File | Key |
| --- | --- | --- |
| UC Schema | `audits.schema.yml` | `sc_auditor_schema` — `prevent_destroy: true`, per-target grants |
| Screenshots Volume | `screenshots.volume.yml` | `screenshots_volume` — managed volume for PNG files |
| Reports Volume | `reports.volume.yml` | `reports_volume` — managed volume for report files |
| SQL Warehouse | `infra_warehouse.sql_warehouse.yml` | `infra_warehouse` — 2X-Small serverless PRO, CHANNEL_NAME_PREVIEW |
| Lakebase | `auditor.lakebase.yml` | `sc_auditor_lakebase` — PG 17, 7-day PITR, per-target CU limits (0.5-2 dev, 0.5-4 hls_fde) |
| Secret Scope | `auditor.secret_scope.yml` | `sc_auditor_secret_scope` — DATABRICKS backend, `prevent_destroy: true` |

Every resource includes a `description` or `comment` field.

#### 3. UC Setup Job + Notebooks (`dc35223`)

Created the two-task bootstrap job:

**Task 1: `ensure_service_principal`** (`src/uc_setup/ensure-service-principal.ipynb`)
- Finds or creates SPN named `sc-auditor-{schema}`
- Auto-provisions `client_id` (from SPN `application_id`) and `workspace_url` in secret scope
- Grants READ ACL on scope to the SPN
- Checks for admin-provisioned `client_secret`
- Outputs `application_id` as task value

**Task 2: `create_target_tables`** (`src/uc_setup/target-tables-ddl.sql`)
- Creates 6 analytical Delta tables with full column comments:
  - `audit_sessions` — one row per audit session
  - `audit_screenshots` — screenshot evidence with Volume paths
  - `audit_extractions` — ai_parse_document extraction results
  - `audit_findings` — findings with severity/category/evidence
  - `audit_reports` — generated report packages
  - `target_systems` — registry of audited systems
- All tables: `CLUSTER BY AUTO`, change data feed enabled
- Grants `MODIFY`, `SELECT`, `READ FILES`, `WRITE FILES` to SPN

#### 4. Deployment Script (`c1bf43e`)

Created `deploy.sh` at project root — orchestrates the two-bundle pattern:
- `--infra` / `--app` / `--run-setup` / `--validate-only` flags
- Readiness gates: checks 2 auto-provisioned secret keys (`client_id`, `workspace_url`) + `audit_sessions` table
- Adapted from zeroBus: simplified from 5 auto-provisioned keys to 2, different table check

---

### Design Decisions

1. **System-agnostic schema** — All tables use generic columns (`target_system`, `audit_type`, `entity_ids ARRAY`, `tags MAP`, `finding_type`, `category`) instead of domain-specific columns. Any web-based system can be audited without schema changes.

2. **VARIANT for flexible data** — `extracted_data`, `evidence`, `annotations`, and `metadata` columns use Databricks `VARIANT` type for schema-on-read flexibility. Each target system produces different extraction structures.

3. **Two auto-provisioned keys (vs zeroBus's 5)** — SC Auditor only needs `client_id` and `workspace_url` auto-provisioned. ZeroBus also derives `zerobus_endpoint`, `target_table_name`, and others. The simpler model reflects this app's credential needs.

4. **Lakebase for operational OLTP** — Agent sessions, messages, patterns, and memory need low-latency reads/writes during active audits. UC Delta tables serve the analytical layer (reporting, cross-session analysis).

5. **Dual-volume design** — Screenshots and reports have separate volumes for independent access control and lifecycle management. Screenshots are write-heavy during audits; reports are generated once per session.

6. **Comments on everything** — Every table, column, resource YAML description, and secret scope includes documentation. This is a convention established in zeroBus and enforced here.

---

### Files Created

| File | Description |
| --- | --- |
| `databricks.yml` | Bundle config — variables, 3 targets, includes |
| `resources/audits.schema.yml` | UC schema with prevent_destroy and grants |
| `resources/screenshots.volume.yml` | Managed volume for screenshot PNGs |
| `resources/reports.volume.yml` | Managed volume for report files |
| `resources/infra_warehouse.sql_warehouse.yml` | 2X-Small serverless PRO warehouse |
| `resources/auditor.lakebase.yml` | Lakebase Autoscaling project (PG 17) |
| `resources/auditor.secret_scope.yml` | Secret scope (DATABRICKS backend) |
| `resources/uc_setup.job.yml` | Two-task bootstrap job |
| `src/uc_setup/ensure-service-principal.ipynb` | SPN creation + credential provisioning |
| `src/uc_setup/target-tables-ddl.sql` | 6 analytical table DDL with comments |
| `deploy.sh` (project root) | Deployment orchestrator with readiness gates |
| `README.md` | Bundle documentation |

### Bundle Structure

```
scAuditor_infra/
├── databricks.yml
├── README.md
├── resources/
│   ├── audits.schema.yml
│   ├── screenshots.volume.yml
│   ├── reports.volume.yml
│   ├── infra_warehouse.sql_warehouse.yml
│   ├── auditor.lakebase.yml
│   ├── auditor.secret_scope.yml
│   └── uc_setup.job.yml
├── src/uc_setup/
│   ├── ensure-service-principal.ipynb
│   └── target-tables-ddl.sql
└── fixtures/
    └── session_summaries/
        ├── INDEX.md
        └── 2026-04-23_infra-bundle-scaffold.md
```
