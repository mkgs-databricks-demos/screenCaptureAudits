# Screen Capture Audits

AI-powered screen capture audit tool that automates logging into any web-based system, navigating screens, capturing screenshots as evidence, extracting structured data, and generating audit reports. Built on Databricks AppKit with Playwright browser automation and Databricks Document Intelligence (`ai_parse_document`).

## Use Cases

This tool is **system-agnostic** and works with any web-based application requiring authentication and documented screen captures:

- **Healthcare**: Medicare claims audits (CMS), EHR system reviews, insurance underwriting
- **Finance**: SOX compliance, financial statement audits, transaction monitoring
- **Government**: Portal audits, regulatory compliance, data quality checks
- **Enterprise**: Access control reviews, security assessments, vendor system audits

## Architecture

The project follows the **two-bundle DAB pattern** for clean separation of infrastructure and application concerns:

```
screenCaptureAudits/
├── README.md
├── LICENSE
├── deploy.sh                     # Orchestrates infra-first deployment
├── scAuditor_infra/              # Bundle 1: Infrastructure (deploy first)
│   ├── databricks.yml
│   ├── resources/                # UC schema, volumes, warehouse, Lakebase, secrets
│   └── src/uc_setup/             # Bootstrap job: SPN creation + DDL
└── scAuditor_agent/              # Bundle 2: Application (deploy second)
    ├── databricks.yml
    ├── resources/                # Databricks App resource with OTel config
    └── sc-auditor-app/           # AppKit source (React + Node.js)
        ├── client/               # React frontend (Databricks brand design)
        └── server/               # Express backend + AI agent + Playwright
```

### Data Layer

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **OLTP** | Lakebase (Postgres) | Agent sessions, messages, navigation patterns, memory, workflows, credential references |
| **Analytical** | Unity Catalog (Delta) | Audit sessions, screenshots, extractions, findings, reports, target systems |
| **File Storage** | UC Volumes | Screenshot PNGs, generated report files (HTML) |
| **Secrets** | Databricks Secret Scope | Target system credentials (key references only) |

### Agent

The AI agent runs a direct LLM tool-use loop (no LangChain) powered by Databricks-served foundation models via the UC AI Gateway (`ai_query`). It has access to 15 tools across 8 categories:

| Category | Tools |
|----------|-------|
| Browser | `navigate_to_url`, `click_element`, `type_text`, `press_key`, `take_screenshot`, `wait_for_element`, `get_page_content` |
| Extraction | `extract_from_screenshot` (ai_parse_document) |
| Findings | `record_finding` |
| Memory | `recall_memory`, `store_memory` |
| Patterns | `recall_pattern`, `save_pattern` |
| Auth | `login_to_system` (secret scope + UC connections) |
| Reports | `generate_report` |
| Workflow | `start_workflow`, `update_workflow_step`, `complete_workflow` |

### Pattern Learning

The agent learns reusable navigation patterns:

1. On the first audit of a system, the agent explores and records each step
2. Steps are saved as a named pattern with selectors, actions, and labels
3. On subsequent audits, the agent recalls matching patterns and follows them
4. Auditors can refine patterns via the visual editor (add notes, fallback instructions, screenshots)
5. Success/failure counts are tracked to rank patterns by reliability

## Deployment

### Prerequisites

- Databricks CLI configured with a profile for the target workspace
- Access to `fevm-hls-fde.cloud.databricks.com` (or your target workspace)
- `databricks bundle` CLI v0.200+ installed

### Quick Start

```bash
# 1. Deploy infrastructure + run bootstrap job
./deploy.sh --target dev --run-setup

# 2. Provision the client secret (one-time, admin step)
databricks secrets put-secret --scope sc_auditor_credentials \
  --key client_secret_dev_matthew_giglia_sc_auditor --string-value "<secret>"

# 3. Deploy the application
./deploy.sh --target dev --app
```

### Targets

| Target | Catalog | Mode | Description |
|--------|---------|------|-------------|
| `dev` | `hls_fde_dev` | development | Personal dev environment |
| `hls_fde` | `hls_fde` | production | Shared FDE workspace |
| `prod` | TBD | production | Placeholder for dedicated workspace |

### deploy.sh

The deployment script orchestrates the two-bundle pattern:

```bash
./deploy.sh --target <target> [--run-setup] [--app] [--infra] [--validate-only]
```

- `--infra` — Deploy infrastructure bundle only
- `--run-setup` — Deploy infra + run the UC setup job (creates SPN, DDL)
- `--app` — Deploy application bundle only
- `--validate-only` — Validate both bundles without deploying

## Local Development

```bash
cd scAuditor_agent/sc-auditor-app

# Install dependencies
npm install

# Create .env with Lakebase connection + secrets
# (see scAuditor_agent/README.md for required env vars)

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Technology Stack

- **Frontend**: React 19, Tailwind CSS 4, Vite (Rolldown), react-resizable-panels, Lucide icons
- **Backend**: Node.js, Express (via AppKit server plugin), TypeScript
- **Browser Automation**: Playwright (headless Chromium)
- **AI/ML**: Databricks Foundation Model API (Claude Sonnet 4 via ai_query), ai_parse_document
- **Data**: Lakebase (Postgres), Unity Catalog (Delta), UC Volumes
- **Observability**: OpenTelemetry (traces, metrics, logs exported to UC tables)
- **Deployment**: Databricks Asset Bundles (DABs), AppKit
- **Design System**: Databricks brand (DM Sans/Mono, Lava/Navy/Oat palette)

## Security

- **No secrets in code or database** — credential references store only scope/key pointers
- **Two credential paths**:
  1. **User credentials** — per-user, stored in Databricks secret scope, retrieved at runtime
  2. **Admin M2M** — admin-provisioned UC connections with OAuth2 client credentials, shared across users
- **OBO (On-Behalf-Of)** queries for SQL warehouse access
- **Service principal** for production deployments with least-privilege grants
