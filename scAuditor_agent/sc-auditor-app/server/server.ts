import http from 'node:http';
import { createApp, lakebase, server } from '@databricks/appkit';
import { initLakebaseSchema } from './db/init-schema.js';
import { otelServerSpans, prependMiddleware } from './middleware/otel-server-spans.js';
import { metrics } from '@opentelemetry/api';
import { setupAuditRoutes } from './routes/audit-routes.js';
import { setupAgentRoutes } from './routes/agent-routes.js';
import { setupPatternRoutes } from './routes/pattern-routes.js';
import { setupScreenshotRoutes } from './routes/screenshot-routes.js';
import { setupCredentialRoutes } from './routes/credential-routes.js';
import { setupReportRoutes } from './routes/report-routes.js';

// ─────────────────────────────────────────────────────────────────────────
// Server-level request metrics via http.Server 'request' event.
//
// AppKit wraps Express in a higher-level HTTP handler that performs auth
// and static file serving BEFORE Express processes the request. So Express
// middleware (even prepended) only sees authenticated, non-static requests.
//
// To instrument ALL requests (including auth redirects and static files),
// we hook into the http.Server's 'request' event, which fires before any
// handler — including AppKit's wrapper.
//
// We patch http.Server.prototype.listen() so we can attach our listener
// to the server instance the moment it starts, before any requests arrive.
// ─────────────────────────────────────────────────────────────────────────
const serverMeter = metrics.getMeter('sc-auditor-server', '1.0.0');

const serverRequestDuration = serverMeter.createHistogram(
  'http.server.request.duration',
  { description: 'Duration of inbound HTTP requests (ms)', unit: 'ms' },
);

const serverRequestCount = serverMeter.createCounter(
  'http.server.request.total',
  { description: 'Total inbound HTTP requests', unit: '1' },
);

const serverErrorCount = serverMeter.createCounter(
  'http.server.errors.total',
  { description: 'Total inbound HTTP 5xx errors', unit: '1' },
);

// Patch http.Server.prototype.listen to attach our request listener
const origListen = http.Server.prototype.listen;
http.Server.prototype.listen = function patchedListen(
  this: http.Server,
  ...args: Parameters<typeof origListen>
): http.Server {
  // Prepend our 'request' listener so it fires before Express
  this.prependListener('request', (req, res) => {
    const start = Date.now();
    const method = req.method ?? 'UNKNOWN';
    const rawUrl = req.url ?? '/';
    const path = rawUrl.split('?')[0];

    serverRequestCount.add(1, { 'http.method': method, 'http.target': path });

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;

      serverRequestDuration.record(duration, {
        'http.method': method,
        'http.target': path,
        'http.status_code': String(statusCode),
      });

      if (statusCode >= 500) {
        serverErrorCount.add(1, {
          'http.method': method,
          'http.target': path,
          'http.status_code': String(statusCode),
        });
      }
    });
  });

  console.log('[otel] Server request metrics listener attached via listen() patch');

  // Restore original to avoid double-patching on subsequent listen() calls
  http.Server.prototype.listen = origListen;

  return origListen.apply(this, args);
} as typeof origListen;

createApp({
  plugins: [
    server({ autoStart: false }),
    lakebase(),
  ],
})
  .then(async (appkit) => {
    await initLakebaseSchema(appkit);

    appkit.server.extend((app: any) => {
      // Prepend OTel server-span middleware into Express stack.
      // This creates SPAN_KIND_SERVER traces (useful during startup).
      // For post-startup, the http.Server listener above provides metrics.
      prependMiddleware(app);

      setupAuditRoutes(appkit, app);
      setupAgentRoutes(appkit, app);
      setupPatternRoutes(appkit, app);
      setupScreenshotRoutes(appkit, app);
      setupCredentialRoutes(appkit, app);
      setupReportRoutes(appkit, app);
    });

    await appkit.server.start();
  })
  .catch(console.error);
