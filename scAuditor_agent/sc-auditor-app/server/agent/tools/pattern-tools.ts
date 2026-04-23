/**
 * Navigation pattern tools for the agent.
 *
 * Allows the agent to recall learned navigation patterns for a target system
 * and save new patterns after completing an audit successfully.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { AgentContext, ToolDefinition } from '../types.js';

export function createPatternTools(
  appkit: AppKitServer,
  ctx: AgentContext
): ToolDefinition[] {
  const pool = appkit.lakebase.pool;

  return [
    {
      name: 'recall_pattern',
      description:
        'Look up navigation patterns for a target system. Returns patterns ranked by success rate. ' +
        'Use this before starting an audit to check if a known path exists.',
      parameters: {
        type: 'object',
        properties: {
          target_system: {
            type: 'string',
            description: 'Target system to look up patterns for',
          },
          pattern_name: {
            type: 'string',
            description: 'Look up a specific pattern by name',
          },
        },
        required: ['target_system'],
      },
      execute: async (args: { target_system: string; pattern_name?: string }) => {
        const conditions = [`target_system = $1`];
        const params: unknown[] = [args.target_system];

        if (args.pattern_name) {
          conditions.push(`pattern_name = $2`);
          params.push(args.pattern_name);
        }

        const result = await pool.query(
          `SELECT id, pattern_name, description, audit_purpose, agent_instructions,
                  steps, screen_sequence, auth_method, success_count, failure_count,
                  last_used_at, created_by
           FROM app.navigation_patterns
           WHERE ${conditions.join(' AND ')}
           ORDER BY success_count DESC, failure_count ASC
           LIMIT 10`,
          params
        );

        return { patterns: result.rows, count: result.rows.length };
      },
    },
    {
      name: 'save_pattern',
      description:
        'Save a navigation pattern for a target system. Call this after completing a successful audit ' +
        'to record the steps taken so they can be reused in future audits.',
      parameters: {
        type: 'object',
        properties: {
          pattern_name: {
            type: 'string',
            description: 'Human-readable name for this pattern (unique per target system)',
          },
          description: {
            type: 'string',
            description: 'Description of what this pattern does',
          },
          steps: {
            type: 'array',
            description:
              'Ordered array of step objects: { step_order, action, selector, value, label, description, screenshot_required }',
            items: {
              type: 'object',
              properties: {
                step_order: { type: 'number' },
                action: { type: 'string' },
                selector: { type: 'string' },
                value: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' },
                screenshot_required: { type: 'boolean' },
              },
            },
          },
          screen_sequence: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ordered list of screen labels visited',
          },
          auth_method: {
            type: 'string',
            description: 'Authentication method: form_login, sso, mfa, basic, oauth2_m2m',
          },
        },
        required: ['pattern_name', 'steps', 'screen_sequence'],
      },
      execute: async (args: {
        pattern_name: string;
        description?: string;
        steps: Record<string, unknown>[];
        screen_sequence: string[];
        auth_method?: string;
      }) => {
        const result = await pool.query(
          `INSERT INTO app.navigation_patterns
             (target_system, pattern_name, description, steps, screen_sequence, auth_method, success_count, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
           ON CONFLICT (target_system, pattern_name)
             DO UPDATE SET
               steps = $4, screen_sequence = $5, description = $3,
               success_count = app.navigation_patterns.success_count + 1,
               last_used_at = NOW(), updated_at = NOW()
           RETURNING id`,
          [
            ctx.targetSystem,
            args.pattern_name,
            args.description ?? null,
            JSON.stringify(args.steps),
            args.screen_sequence,
            args.auth_method ?? null,
            ctx.userId,
          ]
        );

        return {
          saved: true,
          pattern_id: result.rows[0]?.id,
          pattern_name: args.pattern_name,
          target_system: ctx.targetSystem,
        };
      },
    },
  ];
}
