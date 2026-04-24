## Session: Deploy Fixes, Lakebase Init, and OTel Dashboard

**Date:** 2026-04-24
**Bundle:** scAuditor_agent
**Target:** dev

---

### Summary

Deployed the scAuditor_agent Databricks App for the first time. Three deployment cycles were required to reach a stable, running state. After the app was healthy, built an OTel observability dashboard against the telemetry tables.

---

### Deployment #1 — TypeScript Build Failures (06:48–06:50)

**5 TypeScript errors** prevented the Vite client build from completing.

| File | Error | Root Cause | Fix |
| --- | --- | --- | --- |
| `AuditPage.tsx:3` | TS2305 ×3 — `ResizableHandle`, `ResizablePanel`, `ResizablePanelGroup` not exported | `react-resizable-panels` v3 uses `PanelResizeHandle`, `Panel`, `PanelGroup` | Updated imports to correct v3 API names |
| `AuditPage.tsx:235` | TS2322 — `unknown` not assignable to `ReactNode` | `msg.tool_calls && <div>` propagates `unknown` through logical AND | Changed to `Array.isArray(msg.tool_calls) && <div>` for type narrowing |
| `HistoryPage.tsx:4` | TS6133 — unused `Input` import | Scaffolding artifact | Removed unused import |
| `AuditPage.tsx` | `withHandle` prop doesn't exist | v3 API change — resize handles are separate components | Replaced `withHandle` prop with styled child `<div>` inside `<PanelResizeHandle>` |

**Additional fix:** Upgraded `rolldown-vite` from 7.1.14 → 7.3.1 (deprecation warning).

**Files modified:**
- `src/client/pages/AuditPage.tsx`
- `src/client/pages/HistoryPage.tsx`
- `package.json`

---

### Deployment #2 — Lakebase Schema Init Crash (07:18–07:19)

**PostgreSQL syntax error** (code `42601`, position 701) during server startup in `init-schema.ts`.

**Root cause:** The `credential_references` CREATE TABLE statement used an inline `UNIQUE(COALESCE(user_id, '__shared__'), target_system, credential_source)` constraint. PostgreSQL does not allow function expressions (like `COALESCE`) inside inline `UNIQUE` table constraints — only bare column references are permitted.

**Fix:** Removed the inline `UNIQUE(...)` from CREATE TABLE and added a separate functional unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_unique
  ON app.credential_references (
    COALESCE(user_id, '__shared__'),
    target_system,
    credential_source
  );
```

This preserves the original uniqueness logic: NULL `user_id` values are treated as a single `'__shared__'` namespace, preventing duplicate shared credentials for the same target system and credential source.

**Files modified:**
- `src/server/init-schema.ts`

---

### Deployment #3 — Success (07:26)

Build output:
- **Server:** 22 files, 76.15 kB, 38ms
- **Client:** 1,681 modules, 381 kB JS, 683ms

App started at: `https://dev-sc-auditor-7474657291520070.aws.databricksapps.com`

Lakebase schema initialized successfully — 6 tables created in `app` schema:
- `agent_sessions`
- `agent_messages`
- `navigation_patterns`
- `agent_memory`
- `active_audit_workflows`
- `credential_references`

OTel telemetry confirmed flowing (initial snapshot): 426 logs, 56 traces, 805 metrics.

---

### OTel Observability Dashboard

Built an 18-widget dashboard against the three OTel telemetry tables:

| Table | Purpose |
| --- | --- |
| `hls_fde_dev.dev_matthew_giglia_sc_auditor.sc_auditor_agent_otel_logs` | App logs (structured) |
| `hls_fde_dev.dev_matthew_giglia_sc_auditor.sc_auditor_agent_otel_traces` | Distributed traces (spans) |
| `hls_fde_dev.dev_matthew_giglia_sc_auditor.sc_auditor_agent_otel_metrics` | Gauge, Sum, Histogram metrics |

**Dashboard structure (4 sections):**

1. **Overview** — Log volume over time, severity distribution, top resource names
2. **Logs** — Filterable log explorer, error-only view, log body search
3. **Traces** — Span duration distribution, slowest operations, trace waterfall
4. **Metrics** — V8 heap usage, Lakebase query duration trend, connection pool stats, HTTP request rates

**5 datasets** with extracted gauge/sum/histogram values from the nested OTel metric schema.

**Theming:** Databricks brand colors (Lava 600, Navy 800, Green 600, Yellow 600).

**Key performance insights from initial telemetry:**
- `pg.connect` cold start: 597ms (one-time)
- Steady-state Lakebase queries: 6–16ms
- V8 heap: 6M → 9.5M (stable, no leak indicators)
- Lakebase query duration trending down: 33ms → 26ms

**Dashboard published at:** `/sql/dashboardsv3/01f13faf394b123e9406a0568c101c3d`

---

### Final State

| Component | Status |
| --- | --- |
| App | Running, no errors in latest logs |
| Telemetry | All 3 signal types operational (logs, traces, metrics) |
| Dashboard | Published, 18 widgets across 4 sections |
| Lakebase | 6 tables initialized, queries healthy |

---

### Files Modified Summary

| File | Change |
| --- | --- |
| `src/client/pages/AuditPage.tsx` | Fixed react-resizable-panels v3 imports, type narrowing, resize handle |
| `src/client/pages/HistoryPage.tsx` | Removed unused `Input` import |
| `package.json` | Upgraded `rolldown-vite` 7.1.14 → 7.3.1 |
| `src/server/init-schema.ts` | Replaced inline UNIQUE constraint with functional unique index |

### Design Decisions

- **Functional unique index over trigger-based approach:** PostgreSQL's `CREATE UNIQUE INDEX` with `COALESCE` is cleaner and more performant than a BEFORE INSERT trigger for enforcing uniqueness across nullable columns.
- **`Array.isArray()` for type narrowing:** Preferred over a simple truthiness check because it properly narrows `unknown` to `any[]`, satisfying TypeScript's strict JSX children type requirements.
- **rolldown-vite upgrade:** Preemptive — the deprecation warning indicated the 7.1.x entry point would be removed; 7.3.1 uses the new entry point.
