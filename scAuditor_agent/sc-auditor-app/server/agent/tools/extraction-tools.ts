/**
 * Data extraction tools using ai_parse_document via SQL warehouse.
 *
 * Executes OBO (on-behalf-of) SQL queries through the AppKit analytics
 * plugin to call Databricks' ai_parse_document function on screenshots.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { ToolDefinition } from '../types.js';

export function createExtractionTools(appkit: AppKitServer): ToolDefinition[] {
  return [
    {
      name: 'extract_from_screenshot',
      description:
        'Extract structured data from a screenshot using ai_parse_document. ' +
        'Provide the UC Volume path to the screenshot and a prompt describing what to extract. ' +
        'Returns the extracted data as structured JSON.',
      parameters: {
        type: 'object',
        properties: {
          volume_path: {
            type: 'string',
            description:
              'UC Volume path to the screenshot PNG (e.g., /Volumes/catalog/schema/screenshots/session_id/file.png)',
          },
          extraction_prompt: {
            type: 'string',
            description:
              'Prompt describing what data to extract from the screenshot (e.g., "Extract the claim ID, status, and total amount")',
          },
        },
        required: ['volume_path', 'extraction_prompt'],
      },
      execute: async (args: { volume_path: string; extraction_prompt: string }) => {
        const sql = `
          SELECT ai_parse_document(
            '${args.volume_path.replace(/'/g, "''")}',
            '${args.extraction_prompt.replace(/'/g, "''")}'
          ) AS extracted_data
        `;

        try {
          const result = await appkit.analytics.executeStatement(sql);
          const rows = result?.result?.data_array;
          if (rows && rows.length > 0 && rows[0][0]) {
            return {
              extracted_data: JSON.parse(rows[0][0] as string),
              volume_path: args.volume_path,
            };
          }
          return { extracted_data: null, error: 'No extraction result returned' };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { extracted_data: null, error: message };
        }
      },
    },
  ];
}
