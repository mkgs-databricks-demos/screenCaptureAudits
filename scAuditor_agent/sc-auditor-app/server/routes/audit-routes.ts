/**
 * Audit session CRUD routes.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { Express } from 'express';
import { v4 as uuid } from 'uuid';

export function setupAuditRoutes(appkit: AppKitServer, app: Express): void {
  const pool = appkit.lakebase.pool;

  // Create a new audit session
  app.post('/api/audits', async (req, res) => {
    try {
      const { targetSystem, targetUrl, auditType, auditLabel, entityIds, tags } = req.body;
      const userId = req.headers['x-user-id'] as string ?? 'anonymous';
      const sessionId = uuid();
      const now = new Date().toISOString();

      // Create in Lakebase (operational)
      await pool.query(
        `INSERT INTO app.agent_sessions (id, user_id, target_system, target_url, audit_type, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [sessionId, userId, targetSystem, targetUrl ?? null, auditType ?? null]
      );

      // Create in UC (analytical) via SQL warehouse
      try {
        await appkit.analytics.executeStatement(`
          INSERT INTO audit_sessions (
            session_id, user_id, target_system, target_url, audit_type,
            audit_label, entity_ids, tags, status, started_at,
            total_screenshots, total_findings
          ) VALUES (
            '${sessionId}', '${userId}', '${targetSystem}',
            ${targetUrl ? `'${targetUrl}'` : 'NULL'},
            ${auditType ? `'${auditType}'` : 'NULL'},
            ${auditLabel ? `'${auditLabel.replace(/'/g, "''")}'` : 'NULL'},
            ${entityIds ? `ARRAY(${entityIds.map((id: string) => `'${id}'`).join(',')})` : 'NULL'},
            ${tags ? `MAP(${Object.entries(tags).map(([k, v]) => `'${k}', '${v}'`).join(',')})` : 'NULL'},
            'active', '${now}', 0, 0
          )
        `);
      } catch (err) {
        console.error('[audit] UC insert failed:', err);
      }

      res.json({ sessionId, status: 'active', startedAt: now });
    } catch (err) {
      console.error('[audit] Create failed:', err);
      res.status(500).json({ error: 'Failed to create audit session' });
    }
  });

  // List audit sessions
  app.get('/api/audits', async (req, res) => {
    try {
      const { status, targetSystem, limit = '20' } = req.query;
      const conditions = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (status) {
        conditions.push(`status = $${paramIdx++}`);
        params.push(status);
      }
      if (targetSystem) {
        conditions.push(`target_system = $${paramIdx++}`);
        params.push(targetSystem);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT * FROM app.agent_sessions ${where}
         ORDER BY started_at DESC LIMIT $${paramIdx}`,
        [...params, parseInt(limit as string, 10)]
      );

      res.json({ sessions: result.rows });
    } catch (err) {
      console.error('[audit] List failed:', err);
      res.status(500).json({ error: 'Failed to list audit sessions' });
    }
  });

  // Get a single audit session
  app.get('/api/audits/:sessionId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM app.agent_sessions WHERE id = $1`,
        [req.params.sessionId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('[audit] Get failed:', err);
      res.status(500).json({ error: 'Failed to get audit session' });
    }
  });

  // Update session status
  app.patch('/api/audits/:sessionId', async (req, res) => {
    try {
      const { status } = req.body;
      const completedAt = ['completed', 'failed'].includes(status)
        ? new Date().toISOString()
        : null;

      await pool.query(
        `UPDATE app.agent_sessions
         SET status = $1, updated_at = NOW(), completed_at = $2
         WHERE id = $3`,
        [status, completedAt, req.params.sessionId]
      );

      res.json({ updated: true });
    } catch (err) {
      console.error('[audit] Update failed:', err);
      res.status(500).json({ error: 'Failed to update audit session' });
    }
  });
}
