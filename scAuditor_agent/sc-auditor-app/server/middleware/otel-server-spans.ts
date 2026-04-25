/**
 * Manual server-span middleware for Express + server metrics via metric API.
 *
 * Works around TWO issues:
 *   1. ESM hook gap: @opentelemetry/instrumentation-http can't instrument
 *      http.createServer() in AppKit's ESM + --import combination.
 *   2. Sidecar trace drop: The platform sidecar stops exporting traces/logs
 *      after the initial startup batch. Only the metric pipeline works
 *      post-startup.
 *
 * Records server request metrics (duration histogram, request/error counters)
 * via the metric API which the sidecar exports continuously. Also creates
 * SPAN_KIND_SERVER trace spans (useful during startup, lost post-startup).
 *
 * IMPORTANT: This middleware must be prepended to the Express stack BEFORE
 * AppKit's built-in middleware (static files, auth). Use prependMiddleware()
 * to achieve this — app.use() runs AFTER AppKit's handlers.
 */
import { trace, context, metrics, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { Request, Response, NextFunction, Express } from 'express';

const tracer = trace.getTracer('sc-auditor-server', '1.0.0');
const meter = metrics.getMeter('sc-auditor-server', '1.0.0');

const serverRequestDuration = meter.createHistogram(
  'http.server.request.duration',
  { description: 'Duration of inbound HTTP requests (ms)', unit: 'ms' },
);

const serverRequestCount = meter.createCounter(
  'http.server.request.total',
  { description: 'Total inbound HTTP requests', unit: '1' },
);

const serverErrorCount = meter.createCounter(
  'http.server.errors.total',
  { description: 'Total inbound HTTP 5xx errors', unit: '1' },
);

/**
 * Express middleware that creates server spans and records metrics.
 */
export function otelServerSpans(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  const target = req.originalUrl;
  const path = target.split('?')[0];

  // --- Metric: count the request ---
  serverRequestCount.add(1, { 'http.method': method, 'http.target': path });

  // --- Trace: create a server span ---
  const span = tracer.startSpan(`${method} ${path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': method,
      'http.target': target,
      'http.scheme': req.protocol,
      'http.host': req.hostname,
      'http.user_agent': req.get('user-agent') ?? '',
      'net.host.name': req.hostname,
      'net.host.port': Number(req.socket.localPort),
    },
  });

  // Run downstream handlers inside the span context so child spans
  // (Lakebase queries, HTTP client calls) are linked as children.
  context.with(trace.setSpan(context.active(), span), () => {
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // --- Metric: record duration ---
      serverRequestDuration.record(duration, {
        'http.method': method,
        'http.target': path,
        'http.status_code': String(statusCode),
      });

      // --- Metric: count errors ---
      if (statusCode >= 500) {
        serverErrorCount.add(1, {
          'http.method': method,
          'http.target': path,
          'http.status_code': String(statusCode),
        });
      }

      // --- Trace: finish the span ---
      span.setAttribute('http.status_code', statusCode);
      if (req.route?.path) {
        span.setAttribute('http.route', req.route.path);
      }
      if (statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${statusCode}` });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.setAttribute('http.response_time_ms', duration);
      span.end();
    });

    next();
  });
}

/**
 * Prepend our middleware to the FRONT of the Express stack, before
 * AppKit's static file serving and auth middleware.
 *
 * Express stores its middleware in `app._router.stack`. By default,
 * `app.use()` appends to this array. This function unshifts our
 * middleware to index 0 so it runs first for every request.
 */
export function prependMiddleware(app: Express): void {
  // Force Express to initialize its router (it's lazy)
  // @ts-expect-error — Express internal API
  app.lazyrouter?.();

  // Create a layer manually by temporarily using app.use,
  // then moving the new layer to the front
  // @ts-expect-error — Express internal
  const router = app._router;
  if (!router) {
    // Fallback: just use app.use() normally
    app.use(otelServerSpans);
    return;
  }

  const stackBefore = router.stack.length;
  app.use(otelServerSpans);
  const stackAfter = router.stack.length;

  if (stackAfter > stackBefore) {
    // Move the last added layer(s) to the front
    const newLayers = router.stack.splice(stackBefore);
    router.stack.unshift(...newLayers);
  }
}
