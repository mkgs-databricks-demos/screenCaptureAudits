/**
 * Navigation pattern CRUD routes.
 */
import type { AppKitServer } from '@databricks/appkit';

export async function setupPatternRoutes(appkit: AppKitServer): Promise<void> {
  const pool = appkit.lakebase.pool;
  const app = appkit.server.app;

  // List patterns (optionally filtered by target system)
  app.get('/api/patterns', async (req, res) => {
    try {
      const { targetSystem } = req.query;
      let result;

      if (targetSystem) {
        result = await pool.query(
          `SELECT * FROM app.navigation_patterns
           WHERE target_system = $1
           ORDER BY success_count DESC`,
          [targetSystem]
        );
      } else {
        result = await pool.query(
          `SELECT * FROM app.navigation_patterns
           ORDER BY target_system, success_count DESC`
        );
      }

      res.json({ patterns: result.rows });
    } catch (err) {
      console.error('[patterns] List failed:', err);
      res.status(500).json({ error: 'Failed to list patterns' });
    }
  });

  // Get a single pattern
  app.get('/api/patterns/:patternId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM app.navigation_patterns WHERE id = $1`,
        [req.params.patternId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Pattern not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error('[patterns] Get failed:', err);
      res.status(500).json({ error: 'Failed to get pattern' });
    }
  });

  // Update a pattern (for the visual editor)
  app.patch('/api/patterns/:patternId', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string ?? 'anonymous';
      const {
        description,
        auditPurpose,
        agentInstructions,
        steps,
        screenSequence,
      } = req.body;

      const setClauses: string[] = ['updated_at = NOW()', `last_edited_by = $1`];
      const params: unknown[] = [userId];
      let paramIdx = 2;

      if (description !== undefined) {
        setClauses.push(`description = $${paramIdx++}`);
        params.push(description);
      }
      if (auditPurpose !== undefined) {
        setClauses.push(`audit_purpose = $${paramIdx++}`);
        params.push(auditPurpose);
      }
      if (agentInstructions !== undefined) {
        setClauses.push(`agent_instructions = $${paramIdx++}`);
        params.push(agentInstructions);
      }
      if (steps !== undefined) {
        setClauses.push(`steps = $${paramIdx++}`);
        params.push(JSON.stringify(steps));
      }
      if (screenSequence !== undefined) {
        setClauses.push(`screen_sequence = $${paramIdx++}`);
        params.push(screenSequence);
      }

      params.push(req.params.patternId);

      await pool.query(
        `UPDATE app.navigation_patterns
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIdx}`,
        params
      );

      res.json({ updated: true });
    } catch (err) {
      console.error('[patterns] Update failed:', err);
      res.status(500).json({ error: 'Failed to update pattern' });
    }
  });

  // Delete a pattern
  app.delete('/api/patterns/:patternId', async (req, res) => {
    try {
      await pool.query(
        `DELETE FROM app.navigation_patterns WHERE id = $1`,
        [req.params.patternId]
      );
      res.json({ deleted: true });
    } catch (err) {
      console.error('[patterns] Delete failed:', err);
      res.status(500).json({ error: 'Failed to delete pattern' });
    }
  });
}
