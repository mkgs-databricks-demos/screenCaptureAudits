## Session: OTel Server Metrics Fix — http.Server.prototype.listen Patch

**Date:** 2026-04-25  
**Bundle:** scAuditor_agent  
**Target:** dev  

### Problem

Zero `SPAN_KIND_SERVER` trace spans despite 124K+ inbound HTTP requests confirmed via `http.server.duration` metrics. Investigation from the earlier session identified three root causes: protocol mismatch (proto vs gRPC), ESM hook gap, and a platform-level trace flush issue.

### Investigation Findings

#### 1. Traces cluster exclusively at deploy times
Queried traces across Apr 24-25: 18 discrete 1-minute clusters on Apr 24, 3 on Apr 25. Each cluster corresponds to a deploy/startup event. Zero traces between deploys.

#### 2. Sidecar drops traces and logs post-startup, not metrics
| Signal | Post-Startup? | Mechanism |
| --- | --- | --- |
| Metrics | **Yes** (continuous) | `PeriodicExportingMetricReader` -> OTLP to sidecar |
| Traces | **No** (startup only) | `BatchSpanProcessor` -> OTLP to sidecar |
| Logs | **No** (startup only) | `BatchLogRecordProcessor` + stdout capture |

Proved via heartbeat counter diagnostic: custom counter in `otel.ts` exported 6 data points (cumulative 1-6) over 60 seconds, confirming the metric pipeline works continuously.

#### 3. Express middleware ordering: AppKit wraps Express
Diagnostic logging revealed the Express `_router.stack` has only 5 layers (query, expressInit, jsonParser, /health, /api/lakebase). Static file serving and auth are NOT in Express — AppKit wraps the entire Express app in a higher-level HTTP handler. `extend()` middleware only processes requests that pass AppKit's auth layer.

#### 4. Sidecar auth blocks unauthenticated requests
The sidecar reverse proxy returns 302 (redirect to login) for unauthenticated `curl` requests. Only authenticated browser/SDK requests reach the Node.js server. Bearer tokens from `dbutils` get 403/401 — the correct approach is `WorkspaceClient().config.authenticate()` which produces proper OAuth headers.

### Solution: Three-Layer Instrumentation

#### Layer 1: `http.Server.prototype.listen` patch (`otel.ts`)
- Captures the REAL `http.Server.prototype` before `sdk.start()` registers IITM hooks
- After `sdk.start()`, creates custom meters (`sc-auditor-server` scope)
- Patches `RealServerProto.listen` to `prependListener('request')` on the server
- Records `http.server.request.total` (counter), `http.server.request.duration` (histogram), `http.server.errors.total` (counter) via the metric API
- Self-restores original `listen()` after first call to prevent double-patching

#### Layer 2: Express middleware (`otel-server-spans.ts`)
- `prependMiddleware()` manipulates `app._router.stack` to unshift our middleware before AppKit's registered handlers
- Creates `SPAN_KIND_SERVER` trace spans with full HTTP attributes
- Only processes requests that reach Express (post-auth, post-static)

#### Layer 3: Auto-instrumentation (unchanged)
- `@opentelemetry/instrumentation-http` creates CLIENT spans/metrics for outbound requests
- Server hook now works in this deploy configuration (generates `SPAN_KIND_SERVER` traces)

### Verification Results

From `OTel Server Metrics Verification` notebook:

| Test | Result |
| --- | --- |
| Authenticated requests via `WorkspaceClient` | 5/7 returned 200 (SPA routes), 2/7 returned 401 (API routes need app auth) |
| `http.server.request.total` counter | 26 cumulative requests to `/health` |
| `http.server.request.duration` histogram | 9 data points with status/path attributes |
| `http.server.errors.total` counter | 9 cumulative 500 errors (self-health-check) |
| `SPAN_KIND_SERVER` traces | 10 spans at 06:49:23Z — **5 minutes post-startup** |
| Metric pipeline continuity | 28 distinct metrics flowing, latest at 06:51:20Z |

### Remaining Issues

| Item | Priority | Notes |
| --- | --- | --- |
| `/health` returns 500 for internal requests | Medium | Self-health-check bypasses sidecar auth; health route may expect context |
| Sidecar-proxied requests not in custom metrics | Medium | Listen patch captures `localhost:8000` traffic; sidecar may use different transport |
| Revert sampling to 10% for `hls_fde` target | Low | `OTEL_TRACES_SAMPLER_ARG` is `1.0` for dev debugging |
| Playwright browser install | High | Still blocked — needs runtime download approach |

### Files Modified

| File | Change |
| --- | --- |
| `server/otel.ts` | Reverted to `-proto` exporters, added `http.Server.prototype.listen` patch for server metrics, explicit `BatchSpanProcessor` |
| `server/server.ts` | Removed self-health-check timer, uses `prependMiddleware()` |
| `server/middleware/otel-server-spans.ts` | Added metric counters/histogram, added `prependMiddleware()` for Express stack manipulation |
| `package.json` | Reverted to `-proto` exporter packages, removed `@grpc/grpc-js`, added `@opentelemetry/sdk-trace-node` |
| `fixtures/OTel Server Metrics Verification` | New notebook — authenticated traffic tests + metric queries |

### Key Technical Insight

The Databricks Apps telemetry sidecar has differentiated behavior across OTel signals: the metric OTLP receiver works continuously, while the trace and log receivers only process data during the deployment startup window. Custom meters registered via `@opentelemetry/api` and exported by `PeriodicExportingMetricReader` provide reliable post-startup server visibility. The `http.Server.prototype.listen` monkey-patch must be applied in the `--import` module (before IITM hooks) to capture the real prototype.
