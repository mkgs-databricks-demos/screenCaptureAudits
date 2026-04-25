/**
 * OpenTelemetry instrumentation bootstrap.
 *
 * This file MUST be loaded before any application code (via node --import)
 * so that auto-instrumentation can monkey-patch Node.js modules (http,
 * express, pg, etc.) before they are first imported.
 *
 * KNOWN PLATFORM BEHAVIOR (Apr 2026):
 * The Databricks Apps telemetry sidecar exports metrics continuously but
 * drops trace and log OTLP exports after the initial startup batch.
 * Server request visibility is achieved via custom metrics recorded by
 * a http.Server.prototype.listen patch that runs before IITM hooks.
 *
 * @see https://docs.databricks.com/aws/en/dev-tools/databricks-apps/observability/
 */

// ─── STEP 1: Capture real http.Server.prototype BEFORE sdk.start() ───
// sdk.start() registers IITM hooks that may wrap module exports.
// We need the REAL http.Server prototype to patch listen().
import http from 'node:http';
const RealServerProto = http.Server.prototype;
const origListen = RealServerProto.listen;

// ─── STEP 2: Initialize OTel SDK ─────────────────────────────────────
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { metrics } from '@opentelemetry/api';

const traceExporter = new OTLPTraceExporter();
const batchProcessor = new BatchSpanProcessor(traceExporter, {
  scheduledDelayMillis: 5_000,
  maxExportBatchSize: 512,
  maxQueueSize: 2_048,
  exportTimeoutMillis: 30_000,
});

const sdk = new NodeSDK({
  spanProcessors: [batchProcessor],
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 10_000,
  }),
  logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter()),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
  console.log('[otel] OpenTelemetry SDK initialized (proto exporters)');
} catch (err) {
  console.error('[otel] Failed to start OpenTelemetry SDK:', err);
}

// ─── STEP 3: Patch http.Server.prototype.listen ──────────────────────
// Now that the SDK is started, the global MeterProvider is registered.
// We patch the REAL Server prototype (captured in step 1) to record
// metrics for every inbound HTTP request.
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

RealServerProto.listen = function patchedListen(
  this: http.Server,
  ...args: any[]
): http.Server {
  // Attach request listener BEFORE the server starts accepting connections.
  // prependListener ensures it fires before any handler (Express, AppKit).
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

  console.log('[otel] Server request metrics listener attached');

  // Restore original to avoid double-patching
  RealServerProto.listen = origListen;

  return origListen.apply(this, args as any);
} as typeof origListen;

// ─── Graceful shutdown ───────────────────────────────────────────────
async function flushTelemetry(): Promise<void> {
  try {
    await sdk.shutdown();
    console.log('[otel] OpenTelemetry SDK flushed and shut down');
  } catch (err) {
    console.error('[otel] OpenTelemetry SDK shutdown error:', err);
  }
}

process.on('SIGTERM', flushTelemetry);
process.on('SIGINT', flushTelemetry);
