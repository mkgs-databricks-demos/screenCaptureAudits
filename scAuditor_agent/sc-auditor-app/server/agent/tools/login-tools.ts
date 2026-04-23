/**
 * Login tools for the agent.
 *
 * Supports two credential sources:
 *   1. secret_scope — user-entered credentials, retrieved from Databricks secret scope
 *   2. uc_connection — admin-managed M2M OAuth2 via Unity Catalog Connections API
 */
import type { AppKitServer } from '@databricks/appkit';
import type { BrowserController } from '../../plugins/browser-agent/browser-controller.js';
import type { AgentContext, ToolDefinition } from '../types.js';

export function createLoginTools(
  appkit: AppKitServer,
  browser: BrowserController,
  ctx: AgentContext
): ToolDefinition[] {
  const pool = appkit.lakebase.pool;

  return [
    {
      name: 'login_to_system',
      description:
        'Authenticate to the target system. Looks up stored credentials by target system name. ' +
        'For secret_scope credentials: retrieves username/password from the Databricks secret scope ' +
        'and performs a Playwright form login. For uc_connection credentials: fetches an OAuth2 token ' +
        'via the UC Connections API.',
      parameters: {
        type: 'object',
        properties: {
          target_system: {
            type: 'string',
            description: 'Name of the target system to authenticate to',
          },
          login_url: {
            type: 'string',
            description:
              'Override login URL (if different from stored credential reference)',
          },
          username_selector: {
            type: 'string',
            description: 'CSS selector for the username input field (default: input[type="text"], input[name="username"])',
          },
          password_selector: {
            type: 'string',
            description: 'CSS selector for the password input field (default: input[type="password"])',
          },
          submit_selector: {
            type: 'string',
            description: 'CSS selector for the login submit button (default: button[type="submit"])',
          },
        },
        required: ['target_system'],
      },
      execute: async (args: {
        target_system: string;
        login_url?: string;
        username_selector?: string;
        password_selector?: string;
        submit_selector?: string;
      }) => {
        // Look up credential reference
        const credResult = await pool.query(
          `SELECT * FROM app.credential_references
           WHERE target_system = $1
             AND (user_id = $2 OR user_id IS NULL)
           ORDER BY user_id DESC NULLS LAST
           LIMIT 1`,
          [args.target_system, ctx.userId]
        );

        if (credResult.rows.length === 0) {
          return {
            authenticated: false,
            error: `No credentials found for target system "${args.target_system}". ` +
              'Please add credentials in the Settings page.',
          };
        }

        const cred = credResult.rows[0];
        const loginUrl = args.login_url ?? cred.login_url;

        if (cred.credential_source === 'secret_scope') {
          // Retrieve secrets from Databricks secret scope via the SDK
          // The app's SPN has READ access to the scope
          try {
            // Navigate to the login page
            if (loginUrl) {
              await browser.navigateTo(loginUrl);
            }

            // Note: In production, we'd use the Databricks SDK to retrieve
            // the actual secrets from the scope. For now, we return the
            // credential reference info so the agent knows how to proceed.
            return {
              authenticated: false,
              credential_source: 'secret_scope',
              auth_method: cred.auth_method,
              login_url: loginUrl,
              message:
                'Navigated to login page. Secret scope credential retrieval ' +
                'requires SDK integration. Use the username and password selectors ' +
                'to fill in the form after retrieving credentials.',
              username_selector: args.username_selector ?? 'input[type="text"], input[name="username"]',
              password_selector: args.password_selector ?? 'input[type="password"]',
              submit_selector: args.submit_selector ?? 'button[type="submit"]',
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { authenticated: false, error: message };
          }
        } else if (cred.credential_source === 'uc_connection') {
          // UC Connection — admin-managed M2M OAuth2
          return {
            authenticated: false,
            credential_source: 'uc_connection',
            uc_connection_name: cred.uc_connection_name,
            auth_method: cred.auth_method,
            token_url: cred.token_url,
            scopes: cred.scopes,
            message:
              'UC Connection credential found. Token retrieval via UC Connections API ' +
              'will be implemented with the Databricks SDK integration.',
          };
        }

        return {
          authenticated: false,
          error: `Unknown credential source: ${cred.credential_source}`,
        };
      },
    },
  ];
}
