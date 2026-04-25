/**
 * OpenTelemetry instrumentation bootstrap.
 *
 * This file MUST be loaded before any application code (via node --import)
 * so that auto-instrumentation can monkey-patch Node.js modules (http,
 * express, pg, etc.) before they are first imported.
 *
 * When app telemetry is enabled in the Databricks App resource definition,
 * the platform auto-injects:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  = http://localhost:4314
 *   OTEL_EXPORTER_OTLP_PROTOCOL  = grpc
 *   OTEL_SERVICE_NAME            = <app-name>
 *   OTEL_RESOURCE_ATTRIBUTES     = workspace.id=<id>,app.name=<name>
 *   OTEL_BSP_*  / OTEL_BLRP_*   = batch processor config
 *
 * The SDK reads these env vars automatically — no hardcoded endpoints here.
 *
 * KNOWN PLATFORM BEHAVIOR (Apr 2026):
 * The Databricks Apps telemetry sidecar exports metrics continuously but
 * drops trace and log OTLP exports after the initial startup batch. This
 * affects both the BatchSpanProcessor/BatchLogRecordProcessor and stdout
 * capture. Only the PeriodicExportingMetricReader works post-startup.
 * Server request visibility is achieved via custom metric counters/histograms
 * in the otel-server-spans middleware. Trace spans are still created (useful
 * for startup diagnostics) but lost post-startup until platform fix.
 *
 * Uses HTTP/protobuf exporters (-proto packages) as recommended by the
 * official Databricks Apps telemetry documentation.
 *
 * @see https://docs.databricks.com/aws/en/dev-tools/databricks-apps/observability/
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

// --- Explicit BatchSpanProcessor ---
// Even though the sidecar drops post-startup traces, we keep the trace
// pipeline active so startup traces still export (deploy diagnostics:
// Lakebase init, token refresh, PG connections).
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

// Graceful shutdown — flush pending telemetry on SIGTERM/SIGINT.
// NOTE: We do NOT call process.exit() here. AppKit's built-in shutdown
// handler closes the HTTP server and Lakebase pool first.
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
