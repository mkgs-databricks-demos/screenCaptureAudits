/**
 * Screenshot management routes.
 *
 * Handles uploading screenshots to UC Volumes and recording metadata
 * in both Lakebase (operational) and UC (analytical).
 */
import type { AppKitServer } from '@databricks/appkit';
import { v4 as uuid } from 'uuid';

export async function setupScreenshotRoutes(appkit: AppKitServer): Promise<void> {
  const pool = appkit.lakebase.pool;
  const app = appkit.server.app;

  // Upload a screenshot (called by the agent after take_screenshot)
  app.post('/api/screenshots', async (req, res) => {
    try {
      const {
        sessionId,
        captureOrder,
        screenLabel,
        pageUrl,
        base64Data,
        viewportWidth,
        viewportHeight,
      } = req.body;

      const screenshotId = uuid();
      const now = new Date().toISOString();
      const buffer = Buffer.from(base64Data, 'base64');
      const fileSizeBytes = buffer.length;

      // Determine volume path
      const volumePath = `/Volumes/${process.env.DATABRICKS_VOLUME_FILES ?? 'catalog/schema/screenshots'}/${sessionId}/${screenshotId}.png`;

      // Upload to UC Volume via the files plugin
      try {
        await appkit.files.upload(volumePath, buffer);
      } catch (err) {
        console.error('[screenshot] Volume upload failed:', err);
        res.status(500).json({ error: 'Failed to upload screenshot to volume' });
        return;
      }

      // Store metadata in UC (analytical)
      try {
        await appkit.analytics.executeStatement(`
          INSERT INTO audit_screenshots (
            screenshot_id, session_id, capture_order, screen_label,
            page_url, volume_path, captured_at,
            viewport_width, viewport_height, file_size_bytes
          ) VALUES (
            '${screenshotId}', '${sessionId}', ${captureOrder},
            ${screenLabel ? `'${screenLabel.replace(/'/g, "''")}'` : 'NULL'},
            ${pageUrl ? `'${pageUrl.replace(/'/g, "''")}'` : 'NULL'},
            '${volumePath}', '${now}',
            ${viewportWidth ?? 'NULL'}, ${viewportHeight ?? 'NULL'},
            ${fileSizeBytes}
          )
        `);
      } catch (err) {
        console.error('[screenshot] UC insert failed:', err);
      }

      // Update session screenshot count
      try {
        await appkit.analytics.executeStatement(`
          UPDATE audit_sessions
          SET total_screenshots = total_screenshots + 1
          WHERE session_id = '${sessionId}'
        `);
      } catch {
        // Non-critical
      }

      res.json({
        screenshotId,
        volumePath,
        capturedAt: now,
        fileSizeBytes,
      });
    } catch (err) {
      console.error('[screenshot] Upload failed:', err);
      res.status(500).json({ error: 'Failed to process screenshot' });
    }
  });

  // List screenshots for a session
  app.get('/api/screenshots/:sessionId', async (_req, res) => {
    try {
      const result = await appkit.analytics.executeStatement(`
        SELECT screenshot_id, session_id, capture_order, screen_label,
               page_url, volume_path, captured_at,
               viewport_width, viewport_height, file_size_bytes
        FROM audit_screenshots
        WHERE session_id = '${_req.params.sessionId}'
        ORDER BY capture_order ASC
      `);

      res.json({ screenshots: result?.result?.data_array ?? [] });
    } catch (err) {
      console.error('[screenshot] List failed:', err);
      res.status(500).json({ error: 'Failed to list screenshots' });
    }
  });
}
