import type { Page } from '@playwright/test';
import { silentScreenshot } from './screenshot';

export interface PageSettleOptions {
  /** Ms to wait after content is ready (default 450). */
  settleMs?: number;
  /** Max wait for URL / critical loaders (default 10000). */
  timeoutMs?: number;
  /** Short wait for optional dashboard card (default 2500). */
  contentTimeoutMs?: number;
  /** When set, wait for navigation to match this pattern. */
  urlPattern?: RegExp;
  /**
   * Wait for dashboard-style content card. Default: auto (skip on login page).
   * Set false on login/landing; true after navigating into the app.
   */
  requireAppCard?: boolean;
}

const LOADER_SELECTORS = [
  '.spinner-border',
  '.spinner-grow',
  '.vld-overlay',
  '[class*="loading-overlay"]',
  '.pace-active',
];

async function isLoginLikePage(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes('/login')) return true;
  const onLoginForm = await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasDashboardCard = await page
    .locator('div.content-body .card, div.app-content .card')
    .first()
    .isVisible()
    .catch(() => false);
  return onLoginForm && !hasDashboardCard;
}

/**
 * Waits until the page looks ready for a report screenshot after a click/navigation.
 * Uses domcontentloaded + visible content + hidden loaders — not networkidle (too slow).
 */
export async function waitForPageSettled(page: Page, options: PageSettleOptions = {}): Promise<void> {
  const settleMs = options.settleMs ?? 450;
  const timeoutMs = options.timeoutMs ?? 10000;
  const contentTimeoutMs = options.contentTimeoutMs ?? 2500;
  const requireAppCard =
    options.requireAppCard ?? !(await isLoginLikePage(page));

  await page.waitForLoadState('domcontentloaded').catch(() => undefined);

  if (options.urlPattern) {
    await page.waitForURL(options.urlPattern, { timeout: timeoutMs }).catch(() => undefined);
  }

  await page
    .locator('div.app-content, div.content-wrapper, .content-body, body')
    .first()
    .waitFor({ state: 'visible', timeout: contentTimeoutMs })
    .catch(() => undefined);

  if (requireAppCard) {
    await page
      .locator('div.content-body .card, div.app-content .card')
      .first()
      .waitFor({ state: 'visible', timeout: contentTimeoutMs })
      .catch(() => undefined);
  }

  for (const selector of LOADER_SELECTORS) {
    const loader = page.locator(selector).first();
    if (await loader.isVisible().catch(() => false)) {
      await loader.waitFor({ state: 'hidden', timeout: contentTimeoutMs }).catch(() => undefined);
    }
  }

  await page.waitForTimeout(settleMs);
}

/** Wait for the page to settle, then capture a silent screenshot. */
export async function screenshotAfterSettle(
  page: Page,
  options?: PageSettleOptions,
): Promise<Buffer | undefined> {
  await waitForPageSettled(page, options);
  return silentScreenshot(page);
}
