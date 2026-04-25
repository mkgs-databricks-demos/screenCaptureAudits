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
 * IMPORTANT: This middleware is prepended to the Express stack BEFORE
 * Express's own init middleware. Therefore it MUST NOT use Express-specific
 * request methods (req.get, req.protocol, req.hostname). Use raw
 * http.IncomingMessage properties (req.headers, req.url, req.method) only.
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
 *
 * Uses raw http.IncomingMessage properties (not Express helpers) because
 * prependMiddleware() places this before Express's init middleware.
 */
export function otelServerSpans(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  // Use raw req.url (IncomingMessage) with fallback to req.originalUrl (Express)
  const target = req.originalUrl ?? req.url ?? '/';
  const path = target.split('?')[0];

  // --- Metric: count the request ---
  serverRequestCount.add(1, { 'http.method': method, 'http.target': path });

  // Raw http.IncomingMessage header access (safe before Express init)
  const hostHeader = req.headers?.host ?? 'unknown';
  const hostname = hostHeader.split(':')[0];
  const userAgent = req.headers?.['user-agent'] ?? '';
  const scheme = (req.socket as any)?.encrypted ? 'https' : 'http';

  // --- Trace: create a server span ---
  const span = tracer.startSpan(`${method} ${path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': method,
      'http.target': target,
      'http.scheme': scheme,
      'http.host': hostname,
      'http.user_agent': userAgent,
      'net.host.name': hostname,
      'net.host.port': Number(req.socket?.localPort),
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
  // @ts-expect-error \u2014 Express internal API
  app.lazyrouter?.();

  // Create a layer manually by temporarily using app.use,
  // then moving the new layer to the front
  // @ts-expect-error \u2014 Express internal
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
