import type { Page } from '@playwright/test';

/**
 * Takes a screenshot silently via CDP (Page.captureScreenshot) without any
 * DOM manipulation, so the page never blinks or flickers during capture.
 *
 * Playwright's built-in page.screenshot({ animations: 'disabled' }) injects
 * and then removes a CSS rule to freeze animations — that injection is what
 * causes the visible flash. CDP captures the already-composited frame directly.
 *
 * Falls back to a standard page.screenshot() if CDP is unavailable (e.g.
 * non-Chromium browsers or a detached page).
 */
export async function silentScreenshot(page: Page): Promise<Buffer | undefined> {
  try {
    const client = await page.context().newCDPSession(page);
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    await client.detach();
    return Buffer.from(data, 'base64');
  } catch {
    // Fallback for non-Chromium or detached page
    return page.screenshot({ fullPage: false }).catch(() => undefined);
  }
}
