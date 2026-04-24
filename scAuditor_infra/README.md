# scAuditor_infra

Infrastructure bundle for the SC Auditor screen capture audit tool. **Deploy this bundle before `scAuditor_agent`.**

This bundle provisions all shared Databricks infrastructure: Unity Catalog schema, managed volumes, SQL warehouse, Lakebase project, secret scope, and a bootstrap job that creates the service principal and analytical tables.

## Resources

| Resource | Key | Description |
|----------|-----|-------------|
| UC Schema | `sc_auditor_schema` | Unity Catalog schema for all SC Auditor data objects |
| Screenshots Volume | `screenshots_volume` | Managed volume for screenshot PNG files |
| Reports Volume | `reports_volume` | Managed volume for generated report files (HTML) |
| SQL Warehouse | `infra_warehouse` | 2X-Small serverless PRO warehouse for DDL, ai_parse_document, and analytical queries |
| Lakebase | `sc_auditor_lakebase` | PostgreSQL-compatible OLTP database for agent state (sessions, messages, patterns, memory) |
| Secret Scope | `sc_auditor_secret_scope` | Stores SPN credentials and target system authentication keys |
| UC Setup Job | `sc_auditor_uc_setup` | Two-task bootstrap: (1) create/verify SPN + store credentials, (2) run DDL for analytical tables |

## UC Analytical Tables

Created by the setup job's DDL task in `src/uc_setup/target-tables-ddl.sql`:

| Table | Description |
|-------|-------------|
| `audit_sessions` | Top-level session tracking (one row per audit) |
| `audit_screenshots` | Screenshot evidence with Volume paths and viewport metadata |
| `audit_extractions` | ai_parse_document extraction results per screenshot |
| `audit_findings` | Individual findings with severity, category, evidence, and regulation references |
| `audit_reports` | Generated report packages with Volume paths and executive summaries |
| `target_systems` | Registry of audited systems for analytics and pattern grouping |

All tables are Delta with `CLUSTER BY AUTO` and change data feed enabled. Every table and column includes a `COMMENT`.

## Bootstrap Job

The UC setup job (`uc_setup.job.yml`) runs two tasks in sequence:

1. **ensure_service_principal** (`ensure-service-principal.ipynb`)
   - Finds or creates a service principal named `sc-auditor-{schema}`
   - Stores `client_id` and `workspace_url` in the secret scope
   - Grants schema-level and volume-level permissions to the SPN
   - Outputs `application_id` as a task value for downstream tasks

2. **create_target_tables** (`target-tables-ddl.sql`)
   - Creates all 6 analytical tables with full column comments
   - Grants `MODIFY`, `SELECT` to the SPN on the schema
   - Grants `READ FILES`, `WRITE FILES` on the schema for Volume access

## Variables

Key variables (set per-target in `databricks.yml`):

| Variable | Description | Dev Value |
|----------|-------------|-----------|
| `catalog` | UC catalog | `hls_fde_dev` |
| `schema` | UC schema name | `sc_auditor` |
| `secret_scope_name` | Secret scope name | `sc_auditor_credentials` |
| `client_id_dbs_key` | Secret key for SPN client ID | `client_id_dev_matthew_giglia_sc_auditor` |
| `client_secret_dbs_key` | Secret key for SPN client secret | `client_secret_dev_matthew_giglia_sc_auditor` |
| `run_as_user` | Job execution identity | `matthew.giglia@databricks.com` |

## Deployment

```bash
# Validate
databricks bundle validate --target dev

# Deploy infrastructure
databricks bundle deploy --target dev

# Deploy + run bootstrap job
databricks bundle deploy --target dev
databricks bundle run sc_auditor_uc_setup --target dev

# Or use the orchestration script from the project root
./deploy.sh --target dev --run-setup
```

After the setup job completes, provision the client secret (one-time admin step):

```bash
databricks secrets put-secret sc_auditor_credentials \
  client_secret_dev_matthew_giglia_sc_auditor --string-value "<secret>"
```

## Conventions

- **Resource substitutions**: All resources reference the schema via `${resources.schemas.sc_auditor_schema.*}`, never via raw variables. This ensures references are bound to the actual deployed object.
- **Secret key naming**: Schema-qualified keys (e.g., `client_id_dev_matthew_giglia_sc_auditor`) allow multiple schemas to share a single scope without collisions.
- **`prevent_destroy: true`**: Applied to schema, Lakebase, and secret scope resources to guard against accidental deletion.
- **Comments everywhere**: Every table, column, and resource includes a description or comment.

## File Structure

```
scAuditor_infra/
├── databricks.yml                          # Bundle config, variables, targets
├── resources/
│   ├── audits.schema.yml                   # UC schema
│   ├── screenshots.volume.yml              # Managed volume for screenshots
│   ├── reports.volume.yml                  # Managed volume for reports
│   ├── infra_warehouse.sql_warehouse.yml   # Serverless SQL warehouse
│   ├── auditor.lakebase.yml                # Lakebase Autoscaling project
│   ├── auditor.secret_scope.yml            # Secret scope
│   └── uc_setup.job.yml                    # Bootstrap job
└── src/uc_setup/
    ├── ensure-service-principal.ipynb       # SPN creation + secret storage
    └── target-tables-ddl.sql               # Analytical table DDL
```
