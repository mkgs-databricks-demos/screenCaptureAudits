# scAuditor_agent

Application bundle for the SC Auditor screen capture audit tool. **Deploy this bundle after `scAuditor_infra`.**

This bundle manages the Databricks App: a React + Node.js application built with AppKit that provides an AI agent for automated screen capture audits. The agent uses Playwright for browser automation, Databricks Foundation Models for intelligence, and ai_parse_document for data extraction.

## App Architecture

```
sc-auditor-app/
├── app.yaml                    # Databricks App runtime config
├── appkit.plugins.json         # AppKit plugins: analytics, lakebase, files, server
├── package.json
├── client/                     # React 19 frontend
│   └── src/
│       ├── App.tsx             # Router: 5 pages
│       ├── components/         # Reusable UI: Card, Badge, Button, Input, EmptyState, Navbar
│       ├── lib/api.ts          # Typed API client (audits, agent, patterns, credentials)
│       └── pages/
│           ├── dashboard/      # Stats grid + recent sessions table
│           ├── audit/          # Split-pane workspace: screenshots (60%) + agent chat (40%)
│           ├── history/        # Filterable past audit sessions
│           ├── patterns/       # Visual pattern editor with step timeline
│           └── settings/       # Credential management (user + admin M2M) + preferences
└── server/
    ├── server.ts               # AppKit entry: plugins, schema init, route registration
    ├── otel.ts                 # OpenTelemetry Node SDK auto-instrumentation
    ├── db/
    │   └── init-schema.ts      # Lakebase schema bootstrap (6 operational tables)
    ├── agent/
    │   ├── auditor-agent.ts    # Core LLM tool-use loop (max 15 rounds per message)
    │   ├── types.ts            # ToolDefinition, AgentMessage, AgentContext interfaces
    │   ├── prompts/
    │   │   └── system-prompt.ts
    │   └── tools/
    │       ├── index.ts        # Tool registry (15 tools)
    │       ├── browser-tools.ts
    │       ├── extraction-tools.ts
    │       ├── finding-tools.ts
    │       ├── memory-tools.ts
    │       ├── pattern-tools.ts
    │       ├── login-tools.ts
    │       ├── report-tools.ts
    │       └── workflow-tools.ts
    ├── plugins/
    │   └── browser-agent/
    │       └── browser-controller.ts   # Playwright headless Chromium wrapper
    ├── routes/
    │   ├── audit-routes.ts      # CRUD for audit sessions (Lakebase + UC)
    │   ├── agent-routes.ts      # Chat endpoint, message history, agent lifecycle
    │   ├── pattern-routes.ts    # Pattern CRUD for the visual editor
    │   ├── screenshot-routes.ts # Upload to UC Volume + metadata
    │   ├── credential-routes.ts # Credential reference CRUD
    │   └── report-routes.ts     # Report listing + on-demand generation
    └── services/
        └── report-generator.ts  # HTML report builder with LLM executive summaries
```

## AppKit Plugins

| Plugin | Purpose |
|--------|---------|
| `analytics` | SQL warehouse access for ai_parse_document, ai_query, and analytical queries |
| `lakebase` | Postgres connection pool for operational OLTP tables |
| `files` | UC Volume file upload/download for screenshots and reports |
| `server` | Express HTTP server with middleware |

## Lakebase Tables (Operational)

Created automatically on app startup via `db/init-schema.ts`:

| Table | Description |
|-------|-------------|
| `app.agent_sessions` | Active/recent audit sessions with lifecycle state |
| `app.agent_messages` | Full conversation history per session (user, assistant, tool messages) |
| `app.navigation_patterns` | Learned and auditor-curated navigation patterns per target system |
| `app.agent_memory` | Long-term agent knowledge: preferences, facts, system quirks, tips |
| `app.active_audit_workflows` | Step-by-step workflow progress linked to patterns |
| `app.credential_references` | Pointers to credentials (secret scope keys or UC connection names) |

## Agent Tools

The agent has 15 tools organized into 8 categories:

| Category | Tools | Description |
|----------|-------|-------------|
| **Browser** | `navigate_to_url`, `click_element`, `type_text`, `press_key`, `take_screenshot`, `wait_for_element`, `get_page_content` | Playwright headless Chromium control |
| **Extraction** | `extract_from_screenshot` | ai_parse_document via SQL warehouse (OBO) |
| **Findings** | `record_finding` | Store findings in UC with severity/category/evidence |
| **Memory** | `recall_memory`, `store_memory` | Per-user long-term knowledge (optionally per-system) |
| **Patterns** | `recall_pattern`, `save_pattern` | Navigation pattern learning and reuse |
| **Auth** | `login_to_system` | Authenticate via secret scope or UC connection |
| **Reports** | `generate_report` | HTML report with LLM executive summary, uploaded to Volume |
| **Workflow** | `start_workflow`, `update_workflow_step`, `complete_workflow` | Step-by-step progress tracking with pattern success/failure counters |

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Stats cards (active/completed/failed/systems), recent sessions table |
| **Audit** | `/audit`, `/audit/:sessionId` | New audit form or split-pane workspace (screenshot viewer + agent chat) |
| **History** | `/history` | Searchable, filterable table of past audit sessions |
| **Patterns** | `/patterns` | Visual pattern editor grouped by system, with step timeline and auditor context |
| **Settings** | `/settings` | Tabbed credential management (user + admin M2M), agent preferences |

## App Resource Bindings

Configured in `resources/sc_auditor.app.yml`:

| Resource | Type | Env Var | Permission |
|----------|------|---------|------------|
| `postgres` | Lakebase DB | `LAKEBASE_ENDPOINT` | CAN_CONNECT_AND_CREATE |
| `sc-auditor-client-id` | Secret | `SC_AUDITOR_CLIENT_ID` | READ |
| `sc-auditor-client-secret` | Secret | `SC_AUDITOR_CLIENT_SECRET` | READ |
| `sc-auditor-workspace-url` | Secret | `SC_AUDITOR_WORKSPACE_URL` | READ |

**OTel telemetry** is configured declaratively in the app resource YAML with `telemetry_export_destinations` exporting logs, traces, and metrics to UC tables.

**User API scopes**: `sql` (for ai_query/ai_parse_document) and `files.files` (for Volume access).

## Local Development

```bash
cd sc-auditor-app

# Install dependencies (runs postinstall: typegen)
npm install

# Create .env file with required environment variables:
#   PGHOST, PGPORT, PGDATABASE, PGUSER, PGSSLMODE  (Lakebase connection)
#   SC_AUDITOR_CLIENT_ID, SC_AUDITOR_CLIENT_SECRET   (SPN credentials)
#   SC_AUDITOR_WORKSPACE_URL                          (Workspace URL)
#   DATABRICKS_VOLUME_FILES                           (Volume path prefix)

# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Type check both client and server
npm run typecheck

# Production start (with OTel)
npm run start
```

## Deployment

```bash
# Validate the bundle
databricks bundle validate --target dev

# Deploy the app
databricks bundle deploy --target dev

# Or use the orchestration script from the project root
./deploy.sh --target dev --app
```

## Credential Management

The app supports two credential paths for target system authentication:

### User Credentials (Secret Scope)

Per-user credentials stored in a Databricks secret scope. The `credential_references` table stores only scope name and key pointers — actual secrets are retrieved at runtime via the Secrets API.

Key naming convention: `sc_cred_{user_hash}_{system}_username` / `sc_cred_{user_hash}_{system}_password`

### Admin M2M (UC Connections)

Admin-provisioned OAuth2 client credentials managed via Unity Catalog connections. The admin creates a UC connection with the service principal's `client_id`/`client_secret`, and the agent retrieves tokens at runtime via the UC Connections API. These credentials are shared across all users (`user_id = NULL`).
