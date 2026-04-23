/**
 * Lakebase schema initialization.
 *
 * Creates the `app` schema and all operational tables on first startup.
 * All statements are idempotent (IF NOT EXISTS) — safe to re-run.
 */
import type { AppKitServer } from '@databricks/appkit';

const SCHEMA_SQL = `CREATE SCHEMA IF NOT EXISTS app`;

const TABLES_SQL = [
  // ---- agent_sessions ----
  `CREATE TABLE IF NOT EXISTS app.agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    target_system VARCHAR(255) NOT NULL,
    target_url VARCHAR(1024),
    audit_type VARCHAR(255),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    context JSONB DEFAULT '{}'::jsonb
  )`,
  `COMMENT ON TABLE app.agent_sessions IS 'Active and recent audit sessions for the agent. Tracks session lifecycle and short-term conversation context.'`,
  `COMMENT ON COLUMN app.agent_sessions.id IS 'Unique session identifier'`,
  `COMMENT ON COLUMN app.agent_sessions.user_id IS 'Identity of the auditor'`,
  `COMMENT ON COLUMN app.agent_sessions.status IS 'Session status: active, paused, completed, or failed'`,
  `COMMENT ON COLUMN app.agent_sessions.target_system IS 'Name or identifier of the system being audited'`,
  `COMMENT ON COLUMN app.agent_sessions.target_url IS 'Base URL of the target system'`,
  `COMMENT ON COLUMN app.agent_sessions.audit_type IS 'User-defined audit category'`,
  `COMMENT ON COLUMN app.agent_sessions.started_at IS 'When the session was initiated'`,
  `COMMENT ON COLUMN app.agent_sessions.updated_at IS 'Last activity timestamp'`,
  `COMMENT ON COLUMN app.agent_sessions.completed_at IS 'When the session was completed or failed'`,
  `COMMENT ON COLUMN app.agent_sessions.context IS 'Short-term conversation context as JSON'`,

  // ---- agent_messages ----
  `CREATE TABLE IF NOT EXISTS app.agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES app.agent_sessions(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_results JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON app.agent_messages(session_id, created_at)`,
  `COMMENT ON TABLE app.agent_messages IS 'Conversation history per agent session. Stores the full message exchange including tool calls and results.'`,
  `COMMENT ON COLUMN app.agent_messages.role IS 'Message role: user, assistant, system, or tool'`,
  `COMMENT ON COLUMN app.agent_messages.content IS 'Message content text'`,
  `COMMENT ON COLUMN app.agent_messages.tool_calls IS 'Tool calls made by the assistant in this turn, if any'`,
  `COMMENT ON COLUMN app.agent_messages.tool_results IS 'Results returned from tool execution, if any'`,

  // ---- navigation_patterns ----
  `CREATE TABLE IF NOT EXISTS app.navigation_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_system VARCHAR(255) NOT NULL,
    pattern_name VARCHAR(255) NOT NULL,
    description TEXT,
    audit_purpose TEXT,
    agent_instructions TEXT,
    steps JSONB NOT NULL,
    screen_sequence TEXT[] NOT NULL,
    auth_method VARCHAR(50),
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    last_edited_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    UNIQUE(target_system, pattern_name)
  )`,
  `COMMENT ON TABLE app.navigation_patterns IS 'Learned and auditor-curated navigation patterns keyed by target system.'`,
  `COMMENT ON COLUMN app.navigation_patterns.target_system IS 'Target system this pattern applies to'`,
  `COMMENT ON COLUMN app.navigation_patterns.pattern_name IS 'Human-readable name, unique per target system'`,
  `COMMENT ON COLUMN app.navigation_patterns.description IS 'Description of what this pattern does'`,
  `COMMENT ON COLUMN app.navigation_patterns.audit_purpose IS 'Why this pattern exists and what audit requirement it fulfills'`,
  `COMMENT ON COLUMN app.navigation_patterns.agent_instructions IS 'Pattern-level instructions for the agent that apply to every step'`,
  `COMMENT ON COLUMN app.navigation_patterns.steps IS 'Ordered array of step objects with action, selector, label, notes, and fallbacks'`,
  `COMMENT ON COLUMN app.navigation_patterns.screen_sequence IS 'Ordered list of screen labels visited'`,
  `COMMENT ON COLUMN app.navigation_patterns.auth_method IS 'Authentication method: form_login, sso, mfa, basic, oauth2_m2m'`,
  `COMMENT ON COLUMN app.navigation_patterns.success_count IS 'Times this pattern completed successfully'`,
  `COMMENT ON COLUMN app.navigation_patterns.failure_count IS 'Times this pattern failed during execution'`,
  `COMMENT ON COLUMN app.navigation_patterns.last_edited_by IS 'User who last edited via the visual editor'`,

  // ---- agent_memory ----
  `CREATE TABLE IF NOT EXISTS app.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    target_system VARCHAR(255),
    memory_type VARCHAR(50) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memory_user_type ON app.agent_memory(user_id, memory_type)`,
  `COMMENT ON TABLE app.agent_memory IS 'Long-term agent memory. Stores persistent knowledge per user, optionally scoped to a target system.'`,
  `COMMENT ON COLUMN app.agent_memory.target_system IS 'Target system scope. NULL for global preferences.'`,
  `COMMENT ON COLUMN app.agent_memory.memory_type IS 'Category: preference, fact, system_quirk, or tip'`,
  `COMMENT ON COLUMN app.agent_memory.key IS 'Lookup key for this memory entry'`,
  `COMMENT ON COLUMN app.agent_memory.value IS 'Memory content as structured JSON'`,
  `COMMENT ON COLUMN app.agent_memory.confidence IS 'Confidence score (0.0 to 1.0). Decreases if contradicted.'`,
  `COMMENT ON COLUMN app.agent_memory.access_count IS 'Times this memory has been recalled'`,

  // ---- active_audit_workflows ----
  `CREATE TABLE IF NOT EXISTS app.active_audit_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES app.agent_sessions(id),
    audit_type VARCHAR(255),
    entity_ids JSONB DEFAULT '[]'::jsonb,
    current_step INT DEFAULT 0,
    total_steps INT,
    steps_completed JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    pattern_id UUID REFERENCES app.navigation_patterns(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `COMMENT ON TABLE app.active_audit_workflows IS 'Tracks in-progress audit workflows with step-by-step execution state.'`,
  `COMMENT ON COLUMN app.active_audit_workflows.entity_ids IS 'IDs of entities being audited — system-agnostic JSON array'`,
  `COMMENT ON COLUMN app.active_audit_workflows.current_step IS 'Index of the current step (0-based)'`,
  `COMMENT ON COLUMN app.active_audit_workflows.steps_completed IS 'JSON array of completed step results'`,
  `COMMENT ON COLUMN app.active_audit_workflows.status IS 'Workflow status: pending, in_progress, completed, or failed'`,
  `COMMENT ON COLUMN app.active_audit_workflows.pattern_id IS 'Navigation pattern being followed, if any'`,

  // ---- credential_references ----
  `CREATE TABLE IF NOT EXISTS app.credential_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    target_system VARCHAR(255) NOT NULL,
    credential_source VARCHAR(50) NOT NULL,
    secret_scope VARCHAR(255),
    username_key VARCHAR(255),
    password_key VARCHAR(255),
    uc_connection_name VARCHAR(255),
    auth_method VARCHAR(50) NOT NULL,
    mfa_method VARCHAR(50),
    login_url VARCHAR(1024),
    token_url VARCHAR(1024),
    scopes VARCHAR(1024),
    is_admin_managed BOOLEAN DEFAULT false,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(COALESCE(user_id, '__shared__'), target_system, credential_source)
  )`,
  `COMMENT ON TABLE app.credential_references IS 'References to credentials for target system authentication. NEVER stores actual secrets.'`,
  `COMMENT ON COLUMN app.credential_references.user_id IS 'Owning user. NULL for shared admin-managed M2M credentials.'`,
  `COMMENT ON COLUMN app.credential_references.credential_source IS 'Where credentials are stored: secret_scope or uc_connection'`,
  `COMMENT ON COLUMN app.credential_references.secret_scope IS 'Databricks secret scope name (when credential_source = secret_scope)'`,
  `COMMENT ON COLUMN app.credential_references.username_key IS 'Key in secret scope for the username'`,
  `COMMENT ON COLUMN app.credential_references.password_key IS 'Key in secret scope for the password'`,
  `COMMENT ON COLUMN app.credential_references.uc_connection_name IS 'Unity Catalog connection name (when credential_source = uc_connection)'`,
  `COMMENT ON COLUMN app.credential_references.auth_method IS 'Authentication method: form_login, sso, mfa, basic, oauth2_m2m'`,
  `COMMENT ON COLUMN app.credential_references.mfa_method IS 'MFA method if applicable: totp, sms, email, push'`,
  `COMMENT ON COLUMN app.credential_references.login_url IS 'Login page URL or OAuth2 authorization endpoint'`,
  `COMMENT ON COLUMN app.credential_references.token_url IS 'OAuth2 token endpoint for M2M flows'`,
  `COMMENT ON COLUMN app.credential_references.scopes IS 'OAuth2 scopes (space-delimited)'`,
  `COMMENT ON COLUMN app.credential_references.is_admin_managed IS 'True for admin-provisioned credentials shared across users'`,
];

export async function initLakebaseSchema(appkit: AppKitServer): Promise<void> {
  const pool = appkit.lakebase.pool;

  console.log('[db] Initializing Lakebase schema...');

  await pool.query(SCHEMA_SQL);

  for (const sql of TABLES_SQL) {
    await pool.query(sql);
  }

  console.log('[db] Lakebase schema initialized');
}
