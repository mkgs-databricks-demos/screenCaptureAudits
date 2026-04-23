/**
 * Browser automation tools for the agent.
 *
 * These tool definitions are passed to the LLM and executed by the agent
 * loop when the model returns tool_use blocks.
 */
import type { BrowserController } from '../../plugins/browser-agent/browser-controller.js';
import type { ToolDefinition } from '../types.js';

export function createBrowserTools(browser: BrowserController): ToolDefinition[] {
  return [
    {
      name: 'navigate_to_url',
      description:
        'Navigate the browser to a URL. Returns the final URL and page title after navigation.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' },
        },
        required: ['url'],
      },
      execute: async (args: { url: string }) => {
        return await browser.navigateTo(args.url);
      },
    },
    {
      name: 'click_element',
      description:
        'Click an element on the page using a CSS selector. Waits for the page to settle after clicking.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click',
          },
        },
        required: ['selector'],
      },
      execute: async (args: { selector: string }) => {
        return await browser.clickElement(args.selector);
      },
    },
    {
      name: 'type_text',
      description:
        'Type text into an input field identified by a CSS selector. Clears existing content first.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input field',
          },
          text: { type: 'string', description: 'The text to type' },
        },
        required: ['selector', 'text'],
      },
      execute: async (args: { selector: string; text: string }) => {
        return await browser.typeText(args.selector, args.text);
      },
    },
    {
      name: 'press_key',
      description:
        'Press a keyboard key (e.g., Enter, Tab, Escape, ArrowDown). Waits for the page to settle.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Key name (e.g., Enter, Tab, Escape)',
          },
        },
        required: ['key'],
      },
      execute: async (args: { key: string }) => {
        return await browser.pressKey(args.key);
      },
    },
    {
      name: 'take_screenshot',
      description:
        'Capture a screenshot of the current browser viewport. Returns the screenshot as a base64-encoded PNG along with viewport dimensions.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const { buffer, width, height } = await browser.takeScreenshot();
        return {
          screenshot_base64: buffer.toString('base64'),
          width,
          height,
          format: 'png',
        };
      },
    },
    {
      name: 'wait_for_element',
      description:
        'Wait for an element matching a CSS selector to appear on the page. Returns whether the element was found within the timeout.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to wait for',
          },
          timeout_ms: {
            type: 'number',
            description: 'Maximum time to wait in milliseconds (default: 10000)',
          },
        },
        required: ['selector'],
      },
      execute: async (args: { selector: string; timeout_ms?: number }) => {
        return await browser.waitForElement(args.selector, args.timeout_ms);
      },
    },
    {
      name: 'get_page_content',
      description:
        'Get the visible text content of the current page along with the URL and title. Useful for understanding what is on screen without a screenshot.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        return await browser.getPageContent();
      },
    },
  ];
}
