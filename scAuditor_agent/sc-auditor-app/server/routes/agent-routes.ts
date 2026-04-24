/**
 * Agent chat routes — SSE streaming for the agent loop.
 */
import type { AppKitServer } from '@databricks/appkit';
import { AuditorAgent } from '../agent/auditor-agent.js';
import { BrowserController } from '../plugins/browser-agent/browser-controller.js';
import type { AgentContext } from '../agent/types.js';

// Active agent sessions keyed by session ID
const activeAgents = new Map<string, { agent: AuditorAgent; browser: BrowserController }>();

export async function setupAgentRoutes(appkit: AppKitServer): Promise<void> {
  const app = appkit.server.app;
  const pool = appkit.lakebase.pool;

  // Send a message to the agent
  app.post('/api/agent/:sessionId/chat', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;
      const userId = req.headers['x-user-id'] as string ?? 'anonymous';

      // Look up session
      const sessionResult = await pool.query(
        `SELECT * FROM app.agent_sessions WHERE id = $1`,
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const session = sessionResult.rows[0];

      // Get or create agent + browser for this session
      let entry = activeAgents.get(sessionId);
      if (!entry) {
        const browser = new BrowserController();
        await browser.launch();

        const ctx: AgentContext = {
          sessionId,
          userId,
          targetSystem: session.target_system,
          targetUrl: session.target_url,
          auditType: session.audit_type,
        };

        const agent = new AuditorAgent(appkit, browser, ctx);
        entry = { agent, browser };
        activeAgents.set(sessionId, entry);
      }

      // Store user message
      await pool.query(
        `INSERT INTO app.agent_messages (session_id, role, content)
         VALUES ($1, 'user', $2)`,
        [sessionId, message]
      );

      // Run agent loop
      const { response, toolCallsMade } = await entry.agent.chat(message);

      // Store assistant response
      await pool.query(
        `INSERT INTO app.agent_messages (session_id, role, content, tool_calls)
         VALUES ($1, 'assistant', $2, $3)`,
        [
          sessionId,
          response,
          toolCallsMade.length > 0 ? JSON.stringify(toolCallsMade) : null,
        ]
      );

      // Update session timestamp
      await pool.query(
        `UPDATE app.agent_sessions SET updated_at = NOW() WHERE id = $1`,
        [sessionId]
      );

      res.json({
        response,
        toolCallsMade: toolCallsMade.map((tc) => ({
          name: tc.name,
          arguments: tc.arguments,
        })),
      });
    } catch (err) {
      console.error('[agent] Chat failed:', err);
      res.status(500).json({ error: 'Agent chat failed' });
    }
  });

  // Get conversation history for a session
  app.get('/api/agent/:sessionId/messages', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, role, content, tool_calls, tool_results, created_at
         FROM app.agent_messages
         WHERE session_id = $1
         ORDER BY created_at ASC`,
        [req.params.sessionId]
      );

      res.json({ messages: result.rows });
    } catch (err) {
      console.error('[agent] Messages fetch failed:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Cleanup: close browser when session ends
  app.post('/api/agent/:sessionId/close', async (req, res) => {
    try {
      const entry = activeAgents.get(req.params.sessionId);
      if (entry) {
        await entry.browser.close();
        activeAgents.delete(req.params.sessionId);
      }
      res.json({ closed: true });
    } catch (err) {
      console.error('[agent] Close failed:', err);
      res.status(500).json({ error: 'Failed to close agent session' });
    }
  });
}
