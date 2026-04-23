/**
 * Report generation tool for the agent.
 *
 * Generates an HTML audit report from the current session's findings,
 * screenshots, and extractions, uploads it to a UC Volume, and returns
 * the report path and executive summary.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { AgentContext, ToolDefinition } from '../types.js';
import { generateAuditReport } from '../../services/report-generator.js';

export function createReportTools(
  appkit: AppKitServer,
  ctx: AgentContext
): ToolDefinition[] {
  return [
    {
      name: 'generate_report',
      description:
        'Generate an audit report for the current session. Collects all findings, screenshots, ' +
        'and extractions, generates an executive summary via LLM, and produces an HTML report ' +
        'stored in a UC Volume. Call this at the end of an audit to package results.',
      parameters: {
        type: 'object',
        properties: {
          report_type: {
            type: 'string',
            enum: ['summary', 'detailed', 'compliance', 'custom'],
            description: 'Type of report to generate (default: summary)',
          },
        },
      },
      execute: async (args: { report_type?: string }) => {
        try {
          const result = await generateAuditReport(
            appkit,
            ctx.sessionId,
            args.report_type ?? 'summary'
          );
          return {
            success: true,
            report_id: result.reportId,
            volume_path: result.volumePath,
            summary: result.summary,
            page_count: result.pageCount,
            file_size_bytes: result.fileSizeBytes,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    },
  ];
}
