# scAuditor_agent — Session Summary

## Session: App Bundle Scaffold, Agent Core, UI & Intelligence

**Date:** 2026-04-23
**Branch:** `mg-initial-scaffold`
**Commits:** `3300d97`, `ec320ec`, `1a49053`, `04d27e0`, `bff2a41`

---

### What Was Built

The complete `scAuditor_agent` application bundle — from empty directory to a fully functional Databricks App with an AI-powered audit agent, 5-page React frontend, 15 agent tools, report generation, and workflow tracking. Built in 4 phases across a single session.

---

### Changes Made

#### Phase 2: App Bundle Scaffold (`3300d97`)

Created the AppKit application skeleton:

- **`databricks.yml`** — App bundle config mirroring infra targets. Additional variables: `postgres_branch`, `postgres_database`, `telemetry_table_prefix` (sc_auditor_agent). Same workspace/target structure as infra.

- **`resources/sc_auditor.app.yml`** — Databricks App resource with:
  - `telemetry_export_destinations` — OTel logs/traces/metrics exported to UC tables (controlled declaratively, not in app code)
  - `user_api_scopes: [sql, files.files]` — OBO access for ai_query and Volume files
  - 4 app resources: `postgres` (Lakebase), 3 secrets (client_id, client_secret, workspace_url)
  - Per-target name/permission overrides

- **`sc-auditor-app/app.yaml`** — Runtime config: `command: ['npm', 'run', 'start']`, env vars via `valueFrom`, OTEL sampler at 10%

- **`sc-auditor-app/package.json`** — Dependencies: AppKit 0.20.3, Playwright, OpenTelemetry stack, React 19, react-resizable-panels, lucide-react, Zod. Scripts follow zeroBus pattern (start with `--import otel.js`, tsdown build).

- **`appkit.plugins.json`** — 4 plugins: analytics, files, lakebase, server

- **TypeScript configs** — tsconfig.json (project references), tsconfig.shared.json (strict ESNext), tsconfig.server.json (ES2020), tsconfig.client.json (ES2022 + JSX + path aliases), tsdown.server.config.ts

- **`server/otel.ts`** — Node SDK auto-instrumentation (Express, HTTP, Postgres), loaded via `--import` before server

- **`server/db/init-schema.ts`** — Creates `app` schema + 6 Lakebase tables with full `COMMENT ON`:
  - `agent_sessions`, `agent_messages` (idx_messages_session), `navigation_patterns` (UNIQUE target_system+pattern_name), `agent_memory` (idx_memory_user_type), `active_audit_workflows`, `credential_references` (UNIQUE on COALESCE user_id + target_system + source)

- **Client scaffold** — `App.tsx` (router with 5 routes), `Navbar.tsx`, placeholder pages, `main.tsx`, Tailwind/Vite config

#### Phase 3: Agent Core (`ec320ec`)

Built the AI agent with Playwright browser automation and 11 tools:

- **`server/plugins/browser-agent/browser-controller.ts`** — BrowserController class wrapping Playwright headless Chromium (1920x1080). Methods: `launch()`, `navigateTo()`, `clickElement()`, `typeText()`, `pressKey()`, `takeScreenshot()` (returns Buffer), `waitForElement()`, `getPageContent()` (extracts visible text via TreeWalker, up to 8000 chars), `close()`

- **`server/agent/types.ts`** — ToolDefinition, AgentMessage, ToolCall, ToolResult, AgentContext interfaces

- **`server/agent/auditor-agent.ts`** — AuditorAgent class:
  - Direct LLM tool-use loop (no LangChain), max 15 rounds per message
  - `callLLM()` uses `ai_query('databricks-claude-sonnet-4', payload)` via SQL warehouse
  - `chat()` sends conversation history + tool defs, executes tool calls, loops until final text
  - `persistMessage()` stores to Lakebase

- **`server/agent/prompts/system-prompt.ts`** — Session-aware system prompt with capabilities, workflow, and guidelines

- **11 agent tools across 6 categories:**

  | File | Tools | Description |
  | --- | --- | --- |
  | `browser-tools.ts` | `navigate_to_url`, `click_element`, `type_text`, `press_key`, `take_screenshot`, `wait_for_element`, `get_page_content` | Playwright browser control |
  | `extraction-tools.ts` | `extract_from_screenshot` | ai_parse_document via SQL warehouse (OBO) |
  | `finding-tools.ts` | `record_finding` | Insert to UC audit_findings with finding_type/severity/evidence |
  | `memory-tools.ts` | `recall_memory`, `store_memory` | Per-user long-term memory (UPSERT, access count tracking) |
  | `pattern-tools.ts` | `recall_pattern`, `save_pattern` | Pattern recall ranked by success_count, save with UPSERT |
  | `login-tools.ts` | `login_to_system` | Dual source: secret_scope (form login) + uc_connection (M2M OAuth2) |

- **5 server route files:**

  | File | Endpoints | Description |
  | --- | --- | --- |
  | `audit-routes.ts` | POST/GET/GET/:id/PATCH `/api/audits` | Session CRUD (Lakebase + UC dual write) |
  | `agent-routes.ts` | POST `/api/agent/:id/chat`, GET `/api/agent/:id/messages`, POST `/api/agent/:id/close` | Agent lifecycle per session (Map of active agents) |
  | `pattern-routes.ts` | GET/GET/:id/PATCH/:id/DELETE/:id `/api/patterns` | Pattern CRUD for visual editor |
  | `screenshot-routes.ts` | POST/GET/:id `/api/screenshots` | Upload to UC Volume + metadata in UC table |
  | `server.ts` | — | Updated entry point: schema init + all route registration |

#### Phase 4: UI (`1a49053`)

Built complete React frontend with Databricks brand design system:

- **Component library (5 files):**
  - `Card.tsx` — Card, CardHeader, CardContent with Databricks styling
  - `Badge.tsx` — 5 variants (default, success, error, warning, info) + StatusBadge mapping
  - `Button.tsx` — 4 variants (primary/lava, secondary/outlined, ghost, danger), 3 sizes
  - `Input.tsx` — Input, Textarea, Select with labels and Databricks focus ring
  - `EmptyState.tsx` — Centered empty state with icon, title, description, optional action

- **API client (`lib/api.ts`)** — Typed functions for all endpoints: audits, agent chat, patterns, credentials. TypeScript interfaces for AuditSession, ChatResponse, AgentMessage, NavigationPattern, PatternStep, CredentialReference.

- **5 pages:**

  | Page | Route | Key Features |
  | --- | --- | --- |
  | Dashboard | `/` | Stats grid (active/completed/failed/systems), recent sessions table, EmptyState fallback |
  | Audit | `/audit`, `/audit/:sessionId` | NewAuditForm → split-pane workspace: ScreenshotViewer (60%) + ChatPanel (40%) via ResizablePanelGroup. Optimistic message updates, tool call badges, auto-scroll |
  | History | `/history` | Search + status filter, filterable table with duration calculation |
  | Patterns | `/patterns` | Grouped by target_system. PatternDetail: description, audit_purpose, agent_instructions. StepEditor: label, action, selector, value, description, auditor_notes, screenshot_required. Numbered step timeline with action icons |
  | Settings | `/settings` | Tabbed credential management (User Credentials via secret scope + Admin M2M via UC connections). AddCredentialForm adapts fields per mode. Agent preferences (screenshot format, viewport, max rounds) |

- **Credential routes (`credential-routes.ts`)** — CRUD for credential_references table. Lists user's own + shared admin-managed credentials.

#### Phase 5: Intelligence (`04d27e0`)

Added report generation, workflow tracking, and enhanced agent capabilities:

- **`server/services/report-generator.ts`** — `generateAuditReport()`:
  - Fetches session, findings, screenshots, extractions from UC
  - Generates executive summary via `ai_query('databricks-claude-sonnet-4')`
  - Builds branded HTML report (Databricks colors, stats, findings by severity, screenshot grid)
  - Uploads to UC Volume, records in `audit_reports` table, updates session `report_path`

- **2 new tool files (4 tools):**

  | File | Tools | Description |
  | --- | --- | --- |
  | `report-tools.ts` | `generate_report` | Wraps report-generator service; 4 report types (summary, detailed, compliance, custom) |
  | `workflow-tools.ts` | `start_workflow`, `update_workflow_step`, `complete_workflow` | Step-by-step audit tracking linked to patterns. `complete_workflow` increments pattern success/failure counters |

- **`report-routes.ts`** — GET `/api/reports/:sessionId` (list), POST `/api/reports/:sessionId/generate` (on-demand)

- **System prompt expanded** — Full 12-step audit lifecycle workflow, guidelines for pattern-linked workflows, report generation, and memory storage

#### Documentation (`bff2a41`)

- **Root `README.md`** — Architecture overview, data layer table, agent tools, pattern learning, deployment guide, technology stack, security model
- **`scAuditor_infra/README.md`** — 7 resources, 6 UC tables, bootstrap job, variables, conventions
- **`scAuditor_agent/README.md`** — Full app tree, plugins, Lakebase tables, 15 tools, 5 pages, resource bindings, credential management

---

### Design Decisions

1. **Direct LLM tool-use loop (no LangChain)** — `ai_query()` through the SQL warehouse provides a clean integration with Databricks-served models. No external dependencies, no LangChain abstractions. The agent loop is simple: send history + tools → execute tool calls → loop until text response.

2. **ai_query via SQL warehouse for LLM calls** — All LLM interactions go through the analytics plugin's `executeStatement()`. This uses the user's OBO credentials, follows UC AI Gateway routing, and keeps the app stateless (no API keys for external LLM providers).

3. **Session-scoped browser/agent lifecycle** — Each active audit session gets its own BrowserController + AuditorAgent instance, stored in a Map keyed by session ID. The `/close` endpoint cleans up. This isolates browser state across concurrent audits.

4. **Dual-write pattern (Lakebase + UC)** — Audit sessions are written to both Lakebase (fast OLTP for agent operations) and UC Delta tables (durable analytical layer). Lakebase writes are authoritative; UC writes are best-effort (caught and logged on failure).

5. **OTel at bundle resource level, not in code** — `telemetry_export_destinations` in `sc_auditor.app.yml` controls where OTel data goes. The app code only sets up the Node SDK auto-instrumentation. This allows enabling/disabling OTel per-target without code changes.

6. **Pattern success/failure counters via workflow completion** — Rather than tracking pattern success in save_pattern, the `complete_workflow` tool is the single point where counters are updated. This ensures counts are accurate — only workflows that ran to completion (or explicitly failed) affect the stats.

7. **HTML reports (not PDF)** — HTML is viewable in any browser, doesn't require PDF generation libraries, and is lightweight to produce. The report is styled with Databricks brand CSS inline. PDF conversion can be added later if needed.

8. **Credential references never store secrets** — The `credential_references` table stores only pointers (scope name + key names, or UC connection names). Actual credential retrieval happens at runtime in `login_to_system` via the Secrets API or UC Connections API.

9. **ResizablePanelGroup for audit workspace** — The split-pane layout (screenshots left, chat right) uses `react-resizable-panels` for user-adjustable sizing. Default 60/40 split with min sizes prevents either panel from collapsing.

10. **Component library with Databricks CSS custom properties** — All components use `var(--dbx-*)` tokens defined in the Tailwind theme. This ensures the design system stays consistent and can be themed (light/dark) by changing CSS variables at the root.

---

### Files Created / Modified

| File | Action | Description |
| --- | --- | --- |
| `databricks.yml` | Created | App bundle config — variables, 3 targets |
| `resources/sc_auditor.app.yml` | Created | App resource — OTel, secrets, Lakebase, scopes |
| `sc-auditor-app/app.yaml` | Created | Runtime config — command, env vars, OTel sampler |
| `sc-auditor-app/package.json` | Created | Dependencies and scripts |
| `sc-auditor-app/appkit.plugins.json` | Created | 4 AppKit plugins |
| `sc-auditor-app/tsconfig*.json` (4 files) | Created | TypeScript configs |
| `sc-auditor-app/tsdown.server.config.ts` | Created | Server build config |
| `server/server.ts` | Created + Updated | AppKit entry — schema init + 7 route registrations |
| `server/otel.ts` | Created | OTel Node SDK auto-instrumentation |
| `server/db/init-schema.ts` | Created | 6 Lakebase table DDL with comments |
| `server/agent/auditor-agent.ts` | Created | Core LLM tool-use loop |
| `server/agent/types.ts` | Created | Tool/message/context interfaces |
| `server/agent/prompts/system-prompt.ts` | Created + Updated | System prompt (expanded in Phase 5) |
| `server/agent/tools/index.ts` | Created + Updated | Tool registry (11 → 15 tools) |
| `server/agent/tools/browser-tools.ts` | Created | 7 Playwright browser tools |
| `server/agent/tools/extraction-tools.ts` | Created | ai_parse_document tool |
| `server/agent/tools/finding-tools.ts` | Created | Finding recording tool |
| `server/agent/tools/memory-tools.ts` | Created | Memory recall/store tools |
| `server/agent/tools/pattern-tools.ts` | Created | Pattern recall/save tools |
| `server/agent/tools/login-tools.ts` | Created | Dual-source login tool |
| `server/agent/tools/report-tools.ts` | Created | Report generation tool |
| `server/agent/tools/workflow-tools.ts` | Created | 3 workflow management tools |
| `server/plugins/browser-agent/browser-controller.ts` | Created | Playwright wrapper |
| `server/routes/audit-routes.ts` | Created | Session CRUD (dual write) |
| `server/routes/agent-routes.ts` | Created | Agent chat + lifecycle |
| `server/routes/pattern-routes.ts` | Created | Pattern CRUD |
| `server/routes/screenshot-routes.ts` | Created | Volume upload + metadata |
| `server/routes/credential-routes.ts` | Created | Credential reference CRUD |
| `server/routes/report-routes.ts` | Created | Report listing + generation |
| `server/services/report-generator.ts` | Created | HTML report builder with LLM summary |
| `client/src/App.tsx` | Created | Router with 5 routes + Navbar layout |
| `client/src/components/*.tsx` (6 files) | Created | Card, Badge, Button, Input, EmptyState, Navbar |
| `client/src/lib/api.ts` | Created | Typed API client for all endpoints |
| `client/src/pages/dashboard/DashboardPage.tsx` | Rebuilt | Stats + recent sessions |
| `client/src/pages/audit/AuditPage.tsx` | Rebuilt | Split-pane workspace |
| `client/src/pages/history/HistoryPage.tsx` | Rebuilt | Filterable history table |
| `client/src/pages/patterns/PatternsPage.tsx` | Rebuilt | Visual pattern editor |
| `client/src/pages/settings/SettingsPage.tsx` | Rebuilt | Credential management + preferences |
| `README.md` | Created | Bundle documentation |

### Bundle Structure (Current State)

```
scAuditor_agent/
├── databricks.yml
├── README.md
├── resources/
│   └── sc_auditor.app.yml
├── fixtures/
│   └── session_summaries/
│       ├── INDEX.md
│       └── 2026-04-23_app-scaffold-agent-ui-intelligence.md
└── sc-auditor-app/
    ├── app.yaml
    ├── appkit.plugins.json
    ├── package.json
    ├── tsconfig*.json (4)
    ├── tsdown.server.config.ts
    ├── client/src/
    │   ├── App.tsx, main.tsx
    │   ├── components/ (6 files)
    │   ├── lib/api.ts
    │   └── pages/ (5 directories, 5 page files)
    └── server/
        ├── server.ts, otel.ts
        ├── db/init-schema.ts
        ├── agent/
        │   ├── auditor-agent.ts, types.ts
        │   ├── prompts/system-prompt.ts
        │   └── tools/ (9 files including index.ts)
        ├── plugins/browser-agent/browser-controller.ts
        ├── routes/ (6 files)
        └── services/report-generator.ts
```

### Next Steps

1. **Deploy infrastructure** — `./deploy.sh --target dev --run-setup`
2. **Provision client_secret** — one-time admin step
3. **Deploy app** — `./deploy.sh --target dev --app`
4. **Install Playwright browsers** — `npx playwright install chromium` in the app container
5. **End-to-end test** — create an audit session, send a chat message, verify agent responds
6. **Demo target system** — stand up a simple login-protected web page for live demos
