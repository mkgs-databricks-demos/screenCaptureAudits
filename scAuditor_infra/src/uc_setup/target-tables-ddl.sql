-- Databricks notebook source
-- DBTITLE 1,SC Auditor UC Setup — Target Tables DDL
-- MAGIC %md
-- MAGIC # SC Auditor UC Setup — Target Tables DDL
-- MAGIC
-- MAGIC Creates and maintains the analytical tables in Unity Catalog for the SC Auditor
-- MAGIC screen capture audit tool. All tables use **liquid clustering** (`CLUSTER BY AUTO`)
-- MAGIC and **change data feed** for downstream consumption.
-- MAGIC
-- MAGIC Tables created:
-- MAGIC - `audit_sessions` — top-level audit session tracking
-- MAGIC - `audit_screenshots` — screenshot evidence with Volume paths
-- MAGIC - `audit_extractions` — ai_parse_document extraction results
-- MAGIC - `audit_findings` — individual findings or observations
-- MAGIC - `audit_reports` — generated report packages
-- MAGIC - `target_systems` — registry of audited systems
-- MAGIC
-- MAGIC This notebook is invoked by the `sc_auditor_uc_setup` job in the
-- MAGIC `scAuditor_infra` bundle. Parameters are passed from the job definition,
-- MAGIC which derives catalog/schema from `${resources.schemas.sc_auditor_schema.*}`.
-- MAGIC
-- MAGIC > **Note:** Predictive optimization should remain enabled on the target
-- MAGIC > schema so that optimal clustering is applied asynchronously.

-- COMMAND ----------

-- DBTITLE 1,Set Catalog and Schema from Parameters
DECLARE OR REPLACE VARIABLE catalog_use STRING;
DECLARE OR REPLACE VARIABLE schema_use STRING;

SET VARIABLE catalog_use = :catalog_use;
SET VARIABLE schema_use = :schema_use;

USE IDENTIFIER(catalog_use || '.' || schema_use);
SELECT current_catalog(), current_schema();

-- COMMAND ----------

-- DBTITLE 1,Set Query Tags for Observability
SET QUERY_TAGS['project'] = 'Screen Capture Audits';
SET QUERY_TAGS['component'] = 'uc_setup';
SET QUERY_TAGS['pipeline'] = 'sc_auditor_infra';
EXECUTE IMMEDIATE "SET QUERY_TAGS['catalog'] = '" || catalog_use || "';";
EXECUTE IMMEDIATE "SET QUERY_TAGS['schema'] = '" || schema_use || "';";

-- COMMAND ----------

-- DBTITLE 1,Table 1 — audit_sessions
CREATE TABLE IF NOT EXISTS audit_sessions
(
  session_id        STRING    NOT NULL  COMMENT 'Unique identifier for the audit session',
  user_id           STRING    NOT NULL  COMMENT 'Identity of the auditor who initiated the session',
  target_system     STRING    NOT NULL  COMMENT 'Name or identifier of the system being audited (e.g., Epic Claims, SAP Finance, demo-site.com)',
  target_url        STRING              COMMENT 'Base URL of the target system at time of audit',
  audit_type        STRING              COMMENT 'User-defined audit category (e.g., claims, compliance, security review)',
  audit_label       STRING              COMMENT 'Human-friendly label for this audit (e.g., Q1 Medicare Batch 42)',
  entity_ids        ARRAY<STRING>       COMMENT 'IDs of entities being audited — system-agnostic (claim IDs, account numbers, case numbers, etc.)',
  tags              MAP<STRING,STRING>  COMMENT 'Arbitrary key-value tags for filtering and grouping (e.g., regulation:CMS, department:compliance)',
  status            STRING    NOT NULL  COMMENT 'Current session status: active, paused, completed, or failed',
  started_at        TIMESTAMP NOT NULL  COMMENT 'Timestamp when the audit session was initiated',
  completed_at      TIMESTAMP           COMMENT 'Timestamp when the audit session was completed or failed',
  total_screenshots INT                 COMMENT 'Count of screenshots captured during this session',
  total_findings    INT                 COMMENT 'Count of findings recorded during this session',
  report_path       STRING              COMMENT 'UC Volume path to the final generated audit report PDF',
  metadata          VARIANT             COMMENT 'Additional session-level context as semi-structured data',
  CONSTRAINT audit_sessions_pk PRIMARY KEY (session_id)
)
USING DELTA
CLUSTER BY AUTO
COMMENT 'Top-level audit session tracking. One row per audit session regardless of target system.'
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.enableRowTracking' = 'true',
  'delta.enableTypeWidening' = 'true',
  'delta.enableVariantShredding' = 'true',
  'quality' = 'silver',
  'pipeline' = 'sc_auditor'
);

-- COMMAND ----------

-- DBTITLE 1,Table 2 — audit_screenshots
CREATE TABLE IF NOT EXISTS audit_screenshots
(
  screenshot_id     STRING    NOT NULL  COMMENT 'Unique identifier for the screenshot',
  session_id        STRING    NOT NULL  COMMENT 'Audit session this screenshot belongs to',
  capture_order     INT       NOT NULL  COMMENT 'Sequence number within the session (1-based)',
  screen_label      STRING              COMMENT 'Agent-assigned label for the screen (e.g., Login Page, Claim Detail, Account Summary)',
  page_url          STRING              COMMENT 'Full URL of the page at time of capture',
  volume_path       STRING    NOT NULL  COMMENT 'UC Volume path to the screenshot PNG file',
  captured_at       TIMESTAMP NOT NULL  COMMENT 'Timestamp when the screenshot was captured',
  viewport_width    INT                 COMMENT 'Browser viewport width in pixels at time of capture',
  viewport_height   INT                 COMMENT 'Browser viewport height in pixels at time of capture',
  file_size_bytes   BIGINT              COMMENT 'Size of the screenshot file in bytes',
  annotations       VARIANT             COMMENT 'Agent-generated notes about what is visible on screen',
  CONSTRAINT audit_screenshots_pk PRIMARY KEY (screenshot_id)
)
USING DELTA
CLUSTER BY AUTO
COMMENT 'Screenshot evidence captured during audit sessions. Each row represents one browser screenshot with metadata and Volume storage path.'
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.enableRowTracking' = 'true',
  'delta.enableTypeWidening' = 'true',
  'delta.enableVariantShredding' = 'true',
  'quality' = 'silver',
  'pipeline' = 'sc_auditor'
);

-- COMMAND ----------

-- DBTITLE 1,Table 3 — audit_extractions
CREATE TABLE IF NOT EXISTS audit_extractions
(
  extraction_id     STRING    NOT NULL  COMMENT 'Unique identifier for the extraction',
  screenshot_id     STRING    NOT NULL  COMMENT 'Screenshot that was processed',
  session_id        STRING    NOT NULL  COMMENT 'Audit session this extraction belongs to',
  extraction_prompt STRING              COMMENT 'The prompt passed to ai_parse_document for this extraction',
  extracted_data    VARIANT             COMMENT 'Structured output from ai_parse_document — schema varies by system and screen type',
  confidence_score  FLOAT               COMMENT 'Model-reported confidence score for the extraction (0.0 to 1.0)',
  extracted_at      TIMESTAMP NOT NULL  COMMENT 'Timestamp when the extraction was performed',
  model_used        STRING              COMMENT 'Model identifier used for the extraction',
  processing_time_ms INT               COMMENT 'Time taken to process the extraction in milliseconds',
  CONSTRAINT audit_extractions_pk PRIMARY KEY (extraction_id)
)
USING DELTA
CLUSTER BY AUTO
COMMENT 'Information extracted from screenshots via ai_parse_document. Each row is one extraction pass against a screenshot.'
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.enableRowTracking' = 'true',
  'delta.enableTypeWidening' = 'true',
  'delta.enableVariantShredding' = 'true',
  'quality' = 'silver',
  'pipeline' = 'sc_auditor'
);

-- COMMAND ----------

-- DBTITLE 1,Table 4 — audit_findings
CREATE TABLE IF NOT EXISTS audit_findings
(
  finding_id        STRING    NOT NULL  COMMENT 'Unique identifier for the finding',
  session_id        STRING    NOT NULL  COMMENT 'Audit session this finding belongs to',
  screenshot_id     STRING              COMMENT 'Screenshot that supports this finding, if applicable',
  extraction_id     STRING              COMMENT 'Extraction that produced this finding, if applicable',
  finding_type      STRING    NOT NULL  COMMENT 'Type of finding: observation, discrepancy, compliance_issue, note, etc.',
  category          STRING              COMMENT 'User or agent-defined category (e.g., billing, access control, data quality)',
  description       STRING    NOT NULL  COMMENT 'Free-text description of the finding',
  evidence          VARIANT             COMMENT 'Supporting data extracted from screenshots or other sources',
  severity          STRING    NOT NULL  COMMENT 'Severity level: info, low, medium, high, or critical',
  regulation_ref    STRING              COMMENT 'Optional regulatory reference (CMS rule, SOX section, HIPAA control, etc.)',
  created_at        TIMESTAMP NOT NULL  COMMENT 'Timestamp when the finding was recorded',
  CONSTRAINT audit_findings_pk PRIMARY KEY (finding_id)
)
USING DELTA
CLUSTER BY AUTO
COMMENT 'Individual findings or observations recorded during an audit. Findings may be linked to specific screenshots and extractions.'
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.enableRowTracking' = 'true',
  'delta.enableTypeWidening' = 'true',
  'delta.enableVariantShredding' = 'true',
  'quality' = 'silver',
  'pipeline' = 'sc_auditor'
);

-- COMMAND ----------

-- DBTITLE 1,Table 5 — audit_reports
CREATE TABLE IF NOT EXISTS audit_reports
(
  report_id         STRING    NOT NULL  COMMENT 'Unique identifier for the report',
  session_id        STRING    NOT NULL  COMMENT 'Audit session this report was generated from',
  report_type       STRING    NOT NULL  COMMENT 'Report type: summary, detailed, compliance, or custom',
  report_format     STRING    NOT NULL  COMMENT 'File format of the report: pdf, docx, or html',
  volume_path       STRING    NOT NULL  COMMENT 'UC Volume path to the generated report file',
  generated_at      TIMESTAMP NOT NULL  COMMENT 'Timestamp when the report was generated',
  page_count        INT                 COMMENT 'Number of pages in the generated report',
  file_size_bytes   BIGINT              COMMENT 'Size of the report file in bytes',
  summary           STRING              COMMENT 'AI-generated executive summary of the audit findings',
  metadata          VARIANT             COMMENT 'Report generation metadata: template used, sections included, etc.',
  CONSTRAINT audit_reports_pk PRIMARY KEY (report_id)
)
USING DELTA
CLUSTER BY AUTO
COMMENT 'Generated audit report packages. Each row tracks a report file stored in a UC Volume.'
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.enableRowTracking' = 'true',
  'delta.enableTypeWidening' = 'true',
  'delta.enableVariantShredding' = 'true',
  'quality' = 'silver',
  'pipeline' = 'sc_auditor'
);

-- COMMAND ----------

-- DBTITLE 1,Table 6 — target_systems
CREATE TABLE IF NOT EXISTS target_systems
(
  system_id         STRING    NOT NULL  COMMENT 'Unique identifier for the target system',
  system_name       STRING    NOT NULL  COMMENT 'Human-readable name of the target system',
  base_url          STRING              COMMENT 'Base URL used to access the target system',
  system_type       STRING              COMMENT 'System category: claims, finance, ehr, portal, custom, etc.',
  auth_method       STRING              COMMENT 'Authentication method: form_login, sso, mfa, basic, oauth2_m2m, etc.',
  first_audited_at  TIMESTAMP           COMMENT 'Timestamp of the first audit against this system',
  last_audited_at   TIMESTAMP           COMMENT 'Timestamp of the most recent audit against this system',
  total_audits      INT       DEFAULT 0 COMMENT 'Total number of audit sessions conducted against this system',
  notes             STRING              COMMENT 'Free-text notes about this system (quirks, access requirements, etc.)',
  CONSTRAINT target_systems_pk PRIMARY KEY (system_id)
)
USING DELTA
CLUSTER BY AUTO
COMMENT 'Registry of target systems that have been audited. Used for analytics, pattern grouping, and system discovery.'
TBLPROPERTIES (
  'delta.enableChangeDataFeed' = 'true',
  'delta.enableDeletionVectors' = 'true',
  'delta.enableRowTracking' = 'true',
  'delta.enableTypeWidening' = 'true',
  'delta.enableVariantShredding' = 'true',
  'delta.feature.allowColumnDefaults' = 'supported',
  'quality' = 'silver',
  'pipeline' = 'sc_auditor'
);

-- COMMAND ----------

-- DBTITLE 1,Verify Predictive Optimization Status
-- Liquid clustering (CLUSTER BY AUTO) relies on predictive optimization
-- to trigger OPTIMIZE asynchronously after writes.
DESCRIBE SCHEMA EXTENDED IDENTIFIER(catalog_use || '.' || schema_use);

-- COMMAND ----------

-- DBTITLE 1,Declare Service Principal Variable
DECLARE OR REPLACE VARIABLE spn_application_id STRING;
SET VARIABLE spn_application_id = :spn_application_id;
SELECT spn_application_id;

-- COMMAND ----------

-- DBTITLE 1,Grant USE CATALOG to Service Principal
DECLARE OR REPLACE use_catalog_grnt_stmnt STRING DEFAULT
  "GRANT USE CATALOG ON CATALOG " || catalog_use || " TO `" || spn_application_id || "`;";

SELECT use_catalog_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Execute USE CATALOG Grant
EXECUTE IMMEDIATE use_catalog_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Grant USE SCHEMA to Service Principal
DECLARE OR REPLACE use_schema_grnt_stmnt STRING DEFAULT
  "GRANT USE SCHEMA ON SCHEMA " || catalog_use || "." || schema_use || " TO `" || spn_application_id || "`;";

SELECT use_schema_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Execute USE SCHEMA Grant
EXECUTE IMMEDIATE use_schema_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Grant MODIFY and SELECT on All Tables to Service Principal
DECLARE OR REPLACE tbl_grnt_stmnt STRING DEFAULT
  "GRANT MODIFY, SELECT ON SCHEMA " || catalog_use || "." || schema_use || " TO `" || spn_application_id || "`;";

SELECT tbl_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Execute Table Grant
EXECUTE IMMEDIATE tbl_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Grant Volume Access to Service Principal
DECLARE OR REPLACE vol_grnt_stmnt STRING DEFAULT
  "GRANT READ VOLUME, WRITE VOLUME ON SCHEMA " || catalog_use || "." || schema_use || " TO `" || spn_application_id || "`;";

SELECT vol_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Execute Volume Grant
EXECUTE IMMEDIATE vol_grnt_stmnt;

-- COMMAND ----------

-- DBTITLE 1,Verify Grants
EXECUTE IMMEDIATE ('SHOW GRANTS ON SCHEMA ' || catalog_use || '.' || schema_use);

-- COMMAND ----------

-- DBTITLE 1,Show All Tables
SHOW TABLES;