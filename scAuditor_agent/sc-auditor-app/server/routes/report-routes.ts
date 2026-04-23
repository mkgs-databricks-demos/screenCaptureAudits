/**
 * Report management routes.
 *
 * Provides access to generated audit reports stored in UC.
 */
import type { AppKitServer } from '@databricks/appkit';
import { generateAuditReport } from '../services/report-generator.js';

export async function setupReportRoutes(appkit: AppKitServer): Promise<void> {
  const app = appkit.server.expressApp;

  // List reports for a session
  app.get('/api/reports/:sessionId', async (req, res) => {
    try {
      const result = await appkit.analytics.executeStatement(`
        SELECT report_id, session_id, report_type, report_format,
               volume_path, generated_at, page_count, file_size_bytes, summary
        FROM audit_reports
        WHERE session_id = '${req.params.sessionId}'
        ORDER BY generated_at DESC
      `);

      const rows = result?.result?.data_array ?? [];
      const reports = rows.map((r: string[]) => ({
        report_id: r[0],
        session_id: r[1],
        report_type: r[2],
        report_format: r[3],
        volume_path: r[4],
        generated_at: r[5],
        page_count: parseInt(r[6], 10),
        file_size_bytes: parseInt(r[7], 10),
        summary: r[8],
      }));

      res.json({ reports });
    } catch (err) {
      console.error('[reports] List failed:', err);
      res.status(500).json({ error: 'Failed to list reports' });
    }
  });

  // Generate a new report for a session
  app.post('/api/reports/:sessionId/generate', async (req, res) => {
    try {
      const { reportType } = req.body;
      const result = await generateAuditReport(
        appkit,
        req.params.sessionId,
        reportType ?? 'summary'
      );
      res.json(result);
    } catch (err) {
      console.error('[reports] Generate failed:', err);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });
}
