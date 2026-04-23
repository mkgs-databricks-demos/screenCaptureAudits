/**
 * Playwright browser controller for headless Chromium automation.
 *
 * Manages a persistent browser context that the agent uses to navigate
 * target systems, interact with page elements, and capture screenshots.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async launch(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();
    console.log('[browser] Chromium launched');
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('[browser] Chromium closed');
    }
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  async navigateTo(url: string): Promise<{ url: string; title: string }> {
    const page = this.getPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    return { url: page.url(), title: await page.title() };
  }

  async clickElement(selector: string): Promise<{ clicked: boolean }> {
    const page = this.getPage();
    await page.click(selector, { timeout: 10_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    return { clicked: true };
  }

  async typeText(selector: string, text: string): Promise<{ typed: boolean }> {
    const page = this.getPage();
    await page.fill(selector, text, { timeout: 10_000 });
    return { typed: true };
  }

  async pressKey(key: string): Promise<{ pressed: boolean }> {
    const page = this.getPage();
    await page.keyboard.press(key);
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    return { pressed: true };
  }

  async takeScreenshot(): Promise<{ buffer: Buffer; width: number; height: number }> {
    const page = this.getPage();
    const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return { buffer: Buffer.from(buffer), width: viewport.width, height: viewport.height };
  }

  async waitForElement(
    selector: string,
    timeoutMs = 10_000
  ): Promise<{ found: boolean }> {
    const page = this.getPage();
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs });
      return { found: true };
    } catch {
      return { found: false };
    }
  }

  async getPageContent(): Promise<{
    url: string;
    title: string;
    textContent: string;
  }> {
    const page = this.getPage();
    const textContent = await page.evaluate(() => {
      // Get visible text, limiting to a reasonable size for LLM context
      const body = document.body;
      if (!body) return '';
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const texts: string[] = [];
      let totalLength = 0;
      const MAX_LENGTH = 8000;
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent?.trim();
        if (text && text.length > 0) {
          texts.push(text);
          totalLength += text.length;
          if (totalLength > MAX_LENGTH) break;
        }
      }
      return texts.join('\n');
    });

    return {
      url: page.url(),
      title: await page.title(),
      textContent,
    };
  }

  async getPageUrl(): Promise<string> {
    return this.getPage().url();
  }
}
