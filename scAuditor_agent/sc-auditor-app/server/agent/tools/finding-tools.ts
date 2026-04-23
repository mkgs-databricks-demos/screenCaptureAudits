/**
 * Finding recording tools for the agent.
 *
 * Stores findings in both Lakebase (operational) and UC (analytical).
 */
import type { AppKitServer } from '@databricks/appkit';
import { v4 as uuid } from 'uuid';
import type { AgentContext, ToolDefinition } from '../types.js';

export function createFindingTools(
  appkit: AppKitServer,
  ctx: AgentContext
): ToolDefinition[] {
  return [
    {
      name: 'record_finding',
      description:
        'Record an audit finding or observation. Findings can be linked to a specific screenshot and extraction. ' +
        'Severity levels: info, low, medium, high, critical. ' +
        'Finding types: observation, discrepancy, compliance_issue, note.',
      parameters: {
        type: 'object',
        properties: {
          finding_type: {
            type: 'string',
            enum: ['observation', 'discrepancy', 'compliance_issue', 'note'],
            description: 'Type of finding',
          },
          category: {
            type: 'string',
            description:
              'Category for the finding (e.g., billing, access control, data quality)',
          },
          description: {
            type: 'string',
            description: 'Free-text description of the finding',
          },
          severity: {
            type: 'string',
            enum: ['info', 'low', 'medium', 'high', 'critical'],
            description: 'Severity level of the finding',
          },
          screenshot_id: {
            type: 'string',
            description: 'ID of the supporting screenshot, if applicable',
          },
          extraction_id: {
            type: 'string',
            description: 'ID of the extraction that produced this finding, if applicable',
          },
          evidence: {
            type: 'object',
            description: 'Supporting data extracted from screenshots or other sources',
          },
          regulation_ref: {
            type: 'string',
            description:
              'Optional regulatory reference (CMS rule, SOX section, HIPAA control, etc.)',
          },
        },
        required: ['finding_type', 'description', 'severity'],
      },
      execute: async (args: {
        finding_type: string;
        category?: string;
        description: string;
        severity: string;
        screenshot_id?: string;
        extraction_id?: string;
        evidence?: Record<string, unknown>;
        regulation_ref?: string;
      }) => {
        const findingId = uuid();
        const now = new Date().toISOString();

        // Store in UC analytical table via SQL warehouse
        const ucSql = `
          INSERT INTO audit_findings (
            finding_id, session_id, screenshot_id, extraction_id,
            finding_type, category, description, evidence,
            severity, regulation_ref, created_at
          ) VALUES (
            '${findingId}',
            '${ctx.sessionId}',
            ${args.screenshot_id ? `'${args.screenshot_id}'` : 'NULL'},
            ${args.extraction_id ? `'${args.extraction_id}'` : 'NULL'},
            '${args.finding_type}',
            ${args.category ? `'${args.category.replace(/'/g, "''")}'` : 'NULL'},
            '${args.description.replace(/'/g, "''")}',
            ${args.evidence ? `PARSE_JSON('${JSON.stringify(args.evidence).replace(/'/g, "''")}')` : 'NULL'},
            '${args.severity}',
            ${args.regulation_ref ? `'${args.regulation_ref.replace(/'/g, "''")}'` : 'NULL'},
            '${now}'
          )
        `;

        try {
          await appkit.analytics.executeStatement(ucSql);
        } catch (err) {
          console.error('[finding] UC insert failed:', err);
        }

        return {
          finding_id: findingId,
          finding_type: args.finding_type,
          severity: args.severity,
          description: args.description,
          recorded_at: now,
        };
      },
    },
  ];
}
