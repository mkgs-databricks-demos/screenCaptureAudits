/**
 * Core agent loop — direct LLM tool-use (no LangChain).
 *
 * Sends conversation history + tool definitions to a Databricks-served
 * foundation model via the Foundation Model API. When the model returns
 * tool_use blocks, executes the tools and feeds results back until the
 * model produces a final text response.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { BrowserController } from '../plugins/browser-agent/browser-controller.js';
import type { AgentContext, AgentMessage, ToolCall, ToolDefinition } from './types.js';
import { createAllTools } from './tools/index.js';
import { buildSystemPrompt } from './prompts/system-prompt.js';

const MAX_TOOL_ROUNDS = 15;

interface LLMMessage {
  role: string;
  content: string | LLMContentBlock[];
  tool_call_id?: string;
}

interface LLMContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface LLMToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class AuditorAgent {
  private appkit: AppKitServer;
  private browser: BrowserController;
  private tools: ToolDefinition[];
  private toolMap: Map<string, ToolDefinition>;
  private ctx: AgentContext;
  private messages: LLMMessage[];

  constructor(appkit: AppKitServer, browser: BrowserController, ctx: AgentContext) {
    this.appkit = appkit;
    this.browser = browser;
    this.ctx = ctx;
    this.tools = createAllTools(appkit, browser, ctx);
    this.toolMap = new Map(this.tools.map((t) => [t.name, t]));
    this.messages = [
      { role: 'system', content: buildSystemPrompt(ctx) },
    ];
  }

  /**
   * Send a user message and run the agent loop until a final text response.
   * Returns the assistant's text reply and any tool calls that were made.
   */
  async chat(userMessage: string): Promise<{
    response: string;
    toolCallsMade: ToolCall[];
  }> {
    this.messages.push({ role: 'user', content: userMessage });
    const allToolCalls: ToolCall[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await this.callLLM();

      // Check if the model wants to call tools
      const toolCalls = this.extractToolCalls(completion);

      if (toolCalls.length === 0) {
        // Final text response — no more tools
        const text = this.extractText(completion);
        this.messages.push({ role: 'assistant', content: text });
        return { response: text, toolCallsMade: allToolCalls };
      }

      // Add the assistant message with tool calls
      this.messages.push({
        role: 'assistant',
        content: completion.choices?.[0]?.message?.content ?? '',
      });

      // Execute each tool call and append results
      for (const tc of toolCalls) {
        allToolCalls.push(tc);
        const tool = this.toolMap.get(tc.name);

        let result: unknown;
        if (tool) {
          try {
            result = await tool.execute(tc.arguments);
          } catch (err) {
            result = {
              error: err instanceof Error ? err.message : String(err),
            };
          }
        } else {
          result = { error: `Unknown tool: ${tc.name}` };
        }

        this.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Exceeded max rounds
    const fallback = 'I reached the maximum number of tool-use rounds. Here is what I have so far.';
    this.messages.push({ role: 'assistant', content: fallback });
    return { response: fallback, toolCallsMade: allToolCalls };
  }

  /**
   * Call the Foundation Model API via the Databricks SQL statement API.
   * Uses ai_query() which routes through the UC AI Gateway.
   */
  private async callLLM(): Promise<Record<string, unknown>> {
    // Build the tool definitions in OpenAI function-calling format
    const toolDefs: LLMToolDef[] = this.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // Use the Foundation Model API endpoint format.
    // The actual model endpoint is configured via environment or the
    // serving endpoint name. For now, we use ai_query through SQL.
    const payload = {
      messages: this.messages,
      tools: toolDefs,
      tool_choice: 'auto',
      max_tokens: 4096,
    };

    // Execute via ai_query SQL function through the analytics plugin
    const sql = `
      SELECT ai_query(
        'databricks-claude-sonnet-4',
        '${JSON.stringify(payload).replace(/'/g, "''")}'
      ) AS response
    `;

    try {
      const result = await this.appkit.analytics.executeStatement(sql);
      const rows = result?.result?.data_array;
      if (rows && rows.length > 0 && rows[0][0]) {
        return JSON.parse(rows[0][0] as string);
      }
    } catch (err) {
      console.error('[agent] LLM call failed:', err);
    }

    // Fallback response
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'I encountered an error communicating with the language model. Please try again.',
          },
        },
      ],
    };
  }

  private extractToolCalls(completion: Record<string, unknown>): ToolCall[] {
    const choices = completion.choices as Array<{
      message?: { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> };
    }>;

    const toolCalls = choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) return [];

    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  private extractText(completion: Record<string, unknown>): string {
    const choices = completion.choices as Array<{
      message?: { content?: string };
    }>;
    return choices?.[0]?.message?.content ?? '';
  }

  /**
   * Store a message in Lakebase for persistence.
   */
  async persistMessage(message: AgentMessage): Promise<void> {
    const pool = this.appkit.lakebase.pool;
    await pool.query(
      `INSERT INTO app.agent_messages (session_id, role, content, tool_calls, tool_results)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        this.ctx.sessionId,
        message.role,
        message.content,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.toolResults ? JSON.stringify(message.toolResults) : null,
      ]
    );
  }
}
