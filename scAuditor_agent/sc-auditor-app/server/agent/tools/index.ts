/**
 * Aggregate all agent tools into a single registry.
 */
import type { AppKitServer } from '@databricks/appkit';
import type { BrowserController } from '../../plugins/browser-agent/browser-controller.js';
import type { AgentContext, ToolDefinition } from '../types.js';

import { createBrowserTools } from './browser-tools.js';
import { createExtractionTools } from './extraction-tools.js';
import { createFindingTools } from './finding-tools.js';
import { createMemoryTools } from './memory-tools.js';
import { createPatternTools } from './pattern-tools.js';
import { createLoginTools } from './login-tools.js';

export function createAllTools(
  appkit: AppKitServer,
  browser: BrowserController,
  ctx: AgentContext
): ToolDefinition[] {
  return [
    ...createBrowserTools(browser),
    ...createExtractionTools(appkit),
    ...createFindingTools(appkit, ctx),
    ...createMemoryTools(appkit, ctx),
    ...createPatternTools(appkit, ctx),
    ...createLoginTools(appkit, browser, ctx),
  ];
}
