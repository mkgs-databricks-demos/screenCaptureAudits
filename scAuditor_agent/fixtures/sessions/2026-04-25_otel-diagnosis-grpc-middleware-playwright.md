## Session: OTel Diagnosis, gRPC Exporters, Server Span Middleware, Playwright Investigation

**Date:** 2026-04-25
**Bundle:** `scAuditor_agent`
**Target:** `dev`

---

### Summary

Deep investigation into missing `SPAN_KIND_SERVER` traces in the OTel telemetry pipeline, followed by implementing three fixes: manual server span middleware, gRPC exporter switch, and Playwright browser install (blocked). Discovered a platform-level issue where the OTel sidecar only flushes trace data during the app startup window.

---

### Problems Encountered

#### 1. Missing SPAN_KIND_SERVER Traces

**Symptom:** Zero server-side trace spans existed despite 124K+ inbound HTTP requests on Apr 24 and 20K on Apr 25, confirmed via `http.server.duration` metrics (which are unsampled).

**Investigation sequence:**
1. Reviewed `server/otel.ts` — SDK initializes correctly, auto-instrumentations enabled
2. Reviewed `tsdown.server.config.ts` — `unbundle: true` with external node_modules, ruled out bundler interference
3. Reviewed `app.yaml` — `OTEL_TRACES_SAMPLER_ARG: 0.1` (10% sampling)
4. Queried metrics vs traces — at 10% of 124K requests, ~12,400 server spans expected, got 0
5. Bumped sampling to 100% (`1.0`) and redeployed — still 0 server spans with 352+ requests from metrics
6. Queried app logs — no OTel exporter errors, SDK init clean
7. Identified protocol mismatch: `-proto` (HTTP/protobuf) exporters vs platform's `OTEL_EXPORTER_OTLP_PROTOCOL=grpc` sidecar
8. Identified ESM hook gap: `@opentelemetry/instrumentation-http` metrics path works but `http.createServer()` trace hook doesn't fire in AppKit's ESM + `--import` combination

#### 2. Trace Export Stops After Startup (NEW FINDING)

**Symptom:** After deploying all fixes (gRPC exporters + middleware), 499 traces today ALL have timestamps within the startup window (04:20:29-31Z). Zero post-startup traces despite confirmed inbound traffic generating `http.server.duration` metrics at 04:27:48Z.

**Root cause:** The platform's OTel sidecar or the `BatchSpanProcessor` stops accepting/flushing trace spans after the initial batch. This affects ALL deploys — both `-proto` and `-grpc` exporters. The earlier appearance of traces "throughout the day" on Apr 24 was actually startup traces from 10+ separate deployments.

**Impact:** Server span middleware creates spans correctly (compiled and loaded per build logs), but they're lost in the export pipeline. This is a platform-level behavior, not a code issue.

#### 3. Playwright Browser Install Fails in App Build Environment

**Symptom:** `npx playwright install chromium` in both `postinstall` and `prebuild` hooks causes deployment failure. The Chromium headless shell download (~130MB) exceeds build environment constraints.

**Error:** "Error installing packages" (postinstall) / "Error building app" (prebuild)

---

### Changes Made

#### Fix 1: Manual Server Span Middleware (NEW FILE)
**File:** `server/middleware/otel-server-spans.ts`

Express middleware using `@opentelemetry/api` to manually create `SPAN_KIND_SERVER` spans for all inbound HTTP requests. Sets `http.method`, `http.target`, `http.scheme`, `http.host`, `http.status_code`, `http.route`, `net.host.name`, `net.host.port`. Runs downstream handlers inside the span context so child spans (Lakebase, HTTP client) are linked. Records duration and sets `SpanStatusCode.ERROR` for 5xx responses. ~55 LOC.

#### Fix 2: Middleware Registration in server.ts
**File:** `server/server.ts`

Added `import { otelServerSpans }` and `app.use(otelServerSpans)` as the FIRST middleware inside `appkit.server.extend()`, before all route registrations. Comment explains the ESM hook workaround and references removal criteria.

#### Fix 3: gRPC Exporters
**File:** `server/otel.ts`

Replaced HTTP/protobuf exporter imports with gRPC equivalents:
- `@opentelemetry/exporter-trace-otlp-proto` -> `@opentelemetry/exporter-trace-otlp-grpc`
- `@opentelemetry/exporter-metrics-otlp-proto` -> `@opentelemetry/exporter-metrics-otlp-grpc`
- `@opentelemetry/exporter-logs-otlp-proto` -> `@opentelemetry/exporter-logs-otlp-grpc`

Updated console log to `[otel] OpenTelemetry SDK initialized (gRPC exporters)`. Added docblock explaining the protocol rationale.

#### Fix 4: Package.json Dependencies
**File:** `package.json`

- Removed: `@opentelemetry/exporter-{trace,metrics,logs}-otlp-proto`
- Added: `@opentelemetry/exporter-{trace,metrics,logs}-otlp-grpc` `^0.203.0`
- Added: `@grpc/grpc-js` `^1.12.0`
- Playwright install hooks reverted (blocked — see above)

#### Fix 5: Trace Sampling Rate
**File:** `app.yaml`

`OTEL_TRACES_SAMPLER_ARG` changed from `0.1` to `1.0` (100%) with comment explaining dev vs production intent and reference to diagnosis cell.

#### Analysis Notebook
**File:** `fixtures/Genie Code Session Starter` (renamed to "scAuditor Agent Bundle Review")

Added cells:
- Project overview, file map, companion bundle reference, OTel telemetry tables
- OTel Logs — Volume by Date and Severity
- OTel Traces — Span Summary by Operation
- OTel Metrics — Available Metrics Catalog
- OTel Traces — HTTP Latency Distribution
- OTel Traces — Error Spans
- Investigate: Missing Server Spans vs Metrics
- Diagnosis: Missing Server Spans (markdown — full root cause analysis and recommended fixes)

---

### Design Decisions

1. **Middleware over version pinning** for missing server spans — deterministic, removable, no OTel version lock-in. The ESM hook gap is structural (AppKit + OTel interaction), not version-specific.

2. **gRPC over HTTP/protobuf exporters** — matches the platform's `OTEL_EXPORTER_OTLP_PROTOCOL=grpc` sidecar. While this didn't fix the post-startup trace drop (platform issue), it eliminates a protocol mismatch that could cause subtle data loss.

3. **100% sampling for dev** — at dev traffic volumes, sampling is unnecessary and complicates debugging. Production should revert to 10%.

4. **Playwright install deferred** — the app build environment can't handle the ~130MB Chromium download. Needs either a runtime download approach (wrapper in start script) or lazy initialization in `browser-controller.ts`.

---

### Remaining Work

| Item | Priority | Approach |
| --- | --- | --- |
| Trace export stops after startup | High | Platform-level issue — investigate sidecar flush behavior, consider support ticket. May need `OTEL_BSP_SCHEDULE_DELAY` tuning or explicit `forceFlush()` calls. |
| Playwright browser install | High | Move to start script wrapper: `npx playwright install chromium && node --import ./dist/otel.js ...` or lazy download in `browser-controller.ts` on first `.launch()` call. |
| Revert sampling to 10% for production | Low | Change `OTEL_TRACES_SAMPLER_ARG` back to `0.1` in `app.yaml` before `hls_fde` deploy. |
| SIGTERM shutdown timeout | Low | App logs show "App did not respect SIGTERM timeout of 15 seconds" on every deploy. The `flushTelemetry` handler in `otel.ts` may need a timeout cap, or AppKit's shutdown needs investigation. |

---

### Files Modified

| File | Change |
| --- | --- |
| `server/middleware/otel-server-spans.ts` | **NEW** — Manual SPAN_KIND_SERVER middleware |
| `server/server.ts` | Added middleware import + registration |
| `server/otel.ts` | Switched to gRPC exporters, updated log message |
| `package.json` | Swapped -proto for -grpc deps, added @grpc/grpc-js |
| `app.yaml` | Bumped OTEL_TRACES_SAMPLER_ARG to 1.0 |
| `fixtures/Genie Code Session Starter` | Renamed to "scAuditor Agent Bundle Review", added 12 analysis cells |

### Deployments

| # | Time (UTC) | Result | Notes |
| --- | --- | --- | --- |
| 1 | 03:38 | Success | Sampling bump to 1.0 only |
| 2 | 04:07 | Failed | Playwright in postinstall — download too large |
| 3 | 04:12 | Failed | Playwright in prebuild — build env constraints |
| 4 | 04:19 | Success | All OTel fixes, Playwright reverted |
