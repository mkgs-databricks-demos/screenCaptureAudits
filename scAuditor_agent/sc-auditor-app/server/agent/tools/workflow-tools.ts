/**
 * Workflow management tools for the agent.
 *
 * Tracks step-by-step audit workflow progress, optionally linked to
 * navigation patterns. Manages the active_audit_workflows table.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { AgentContext, ToolDefinition } from '../types.js';

export function createWorkflowTools(
  appkit: AppKitServer,
  ctx: AgentContext
): ToolDefinition[] {
  const pool = appkit.lakebase.pool;

  return [
    {
      name: 'start_workflow',
      description:
        'Start a tracked audit workflow for the current session. Optionally link to a navigation pattern ' +
        'to follow. Returns a workflow ID for updating progress.',
      parameters: {
        type: 'object',
        properties: {
          audit_type: {
            type: 'string',
            description: 'Audit type for this workflow',
          },
          entity_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of entities being audited (claim IDs, account numbers, etc.)',
          },
          total_steps: {
            type: 'number',
            description: 'Expected total number of steps in this workflow',
          },
          pattern_id: {
            type: 'string',
            description: 'Navigation pattern ID to follow (from recall_pattern)',
          },
        },
      },
      execute: async (args: {
        audit_type?: string;
        entity_ids?: string[];
        total_steps?: number;
        pattern_id?: string;
      }) => {
        const result = await pool.query(
          `INSERT INTO app.active_audit_workflows
             (session_id, audit_type, entity_ids, total_steps, pattern_id, status)
           VALUES ($1, $2, $3, $4, $5, 'in_progress')
           RETURNING id`,
          [
            ctx.sessionId,
            args.audit_type ?? null,
            JSON.stringify(args.entity_ids ?? []),
            args.total_steps ?? null,
            args.pattern_id ?? null,
          ]
        );

        return {
          workflow_id: result.rows[0]?.id,
          status: 'in_progress',
        };
      },
    },
    {
      name: 'update_workflow_step',
      description:
        'Update the progress of an active audit workflow. Call after completing each step.',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'Workflow ID (from start_workflow)',
          },
          step_index: {
            type: 'number',
            description: 'Current step index (0-based)',
          },
          step_result: {
            type: 'object',
            description: 'Result of the completed step: { label, status, screenshot_id, notes }',
          },
        },
        required: ['workflow_id', 'step_index', 'step_result'],
      },
      execute: async (args: {
        workflow_id: string;
        step_index: number;
        step_result: Record<string, unknown>;
      }) => {
        const stepEntry = {
          ...args.step_result,
          completed_at: new Date().toISOString(),
        };

        await pool.query(
          `UPDATE app.active_audit_workflows
           SET current_step = $1,
               steps_completed = steps_completed || $2::jsonb,
               updated_at = NOW()
           WHERE id = $3`,
          [args.step_index + 1, JSON.stringify([stepEntry]), args.workflow_id]
        );

        return { updated: true, current_step: args.step_index + 1 };
      },
    },
    {
      name: 'complete_workflow',
      description:
        'Mark an audit workflow as completed or failed. If successful and linked to a pattern, ' +
        'increments the pattern success count. If failed, increments the failure count.',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'Workflow ID to complete',
          },
          status: {
            type: 'string',
            enum: ['completed', 'failed'],
            description: 'Final status of the workflow',
          },
        },
        required: ['workflow_id', 'status'],
      },
      execute: async (args: { workflow_id: string; status: 'completed' | 'failed' }) => {
        // Update workflow status
        await pool.query(
          `UPDATE app.active_audit_workflows
           SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [args.status, args.workflow_id]
        );

        // Get linked pattern ID
        const wfResult = await pool.query(
          `SELECT pattern_id FROM app.active_audit_workflows WHERE id = $1`,
          [args.workflow_id]
        );
        const patternId = wfResult.rows[0]?.pattern_id;

        // Update pattern success/failure count
        if (patternId) {
          const counterCol = args.status === 'completed' ? 'success_count' : 'failure_count';
          await pool.query(
            `UPDATE app.navigation_patterns
             SET ${counterCol} = ${counterCol} + 1,
                 last_used_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [patternId]
          );
        }

        return {
          workflow_id: args.workflow_id,
          status: args.status,
          pattern_updated: !!patternId,
        };
      },
    },
  ];
}
