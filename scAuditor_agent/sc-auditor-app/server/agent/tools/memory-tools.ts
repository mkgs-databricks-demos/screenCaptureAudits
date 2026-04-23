/**
 * Long-term memory tools for the agent.
 *
 * Allows the agent to store and recall persistent knowledge per user,
 * optionally scoped to a target system.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { AgentContext, ToolDefinition } from '../types.js';

export function createMemoryTools(
  appkit: AppKitServer,
  ctx: AgentContext
): ToolDefinition[] {
  const pool = appkit.lakebase.pool;

  return [
    {
      name: 'recall_memory',
      description:
        'Recall stored memories for the current user. Optionally filter by target system and/or memory type. ' +
        'Memory types: preference, fact, system_quirk, tip.',
      parameters: {
        type: 'object',
        properties: {
          memory_type: {
            type: 'string',
            enum: ['preference', 'fact', 'system_quirk', 'tip'],
            description: 'Filter by memory type',
          },
          target_system: {
            type: 'string',
            description: 'Filter by target system (omit for global memories)',
          },
          key: {
            type: 'string',
            description: 'Look up a specific memory by key',
          },
        },
      },
      execute: async (args: {
        memory_type?: string;
        target_system?: string;
        key?: string;
      }) => {
        const conditions = [`user_id = $1`];
        const params: unknown[] = [ctx.userId];
        let paramIdx = 2;

        if (args.memory_type) {
          conditions.push(`memory_type = $${paramIdx++}`);
          params.push(args.memory_type);
        }
        if (args.target_system) {
          conditions.push(`target_system = $${paramIdx++}`);
          params.push(args.target_system);
        } else {
          // Include both global and current-system memories
          conditions.push(`(target_system IS NULL OR target_system = $${paramIdx++})`);
          params.push(ctx.targetSystem);
        }
        if (args.key) {
          conditions.push(`key = $${paramIdx++}`);
          params.push(args.key);
        }

        const result = await pool.query(
          `SELECT key, value, memory_type, target_system, confidence, access_count
           FROM app.agent_memory
           WHERE ${conditions.join(' AND ')}
           ORDER BY confidence DESC, access_count DESC
           LIMIT 20`,
          params
        );

        // Update access counts
        if (result.rows.length > 0) {
          const keys = result.rows.map((r: { key: string }) => r.key);
          await pool.query(
            `UPDATE app.agent_memory
             SET access_count = access_count + 1, last_accessed_at = NOW()
             WHERE user_id = $1 AND key = ANY($2)`,
            [ctx.userId, keys]
          );
        }

        return { memories: result.rows, count: result.rows.length };
      },
    },
    {
      name: 'store_memory',
      description:
        'Store a piece of knowledge for long-term recall. If a memory with the same key already exists for this user and system, it will be updated.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Unique key for this memory (e.g., "preferred_search_method")',
          },
          value: {
            type: 'object',
            description: 'The memory content as structured JSON',
          },
          memory_type: {
            type: 'string',
            enum: ['preference', 'fact', 'system_quirk', 'tip'],
            description: 'Category of memory',
          },
          target_system: {
            type: 'string',
            description:
              'Target system this memory applies to. Omit for global/cross-system memories.',
          },
        },
        required: ['key', 'value', 'memory_type'],
      },
      execute: async (args: {
        key: string;
        value: Record<string, unknown>;
        memory_type: string;
        target_system?: string;
      }) => {
        const result = await pool.query(
          `INSERT INTO app.agent_memory (user_id, target_system, memory_type, key, value)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, memory_type)
             WHERE key = $4
             DO UPDATE SET value = $5, updated_at = NOW(), confidence = 1.0
           RETURNING id`,
          [
            ctx.userId,
            args.target_system ?? null,
            args.memory_type,
            args.key,
            JSON.stringify(args.value),
          ]
        );

        return {
          stored: true,
          memory_id: result.rows[0]?.id,
          key: args.key,
          memory_type: args.memory_type,
        };
      },
    },
  ];
}
