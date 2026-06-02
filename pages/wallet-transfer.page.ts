import { expect, type Locator, type Page } from '@playwright/test';
import { screenshotAfterSettle, waitForPageSettled } from '../utils/page-settle';

export class WalletTransferPage {
  constructor(private readonly page: Page) {}
  /** Pause on the loaded page after screenshot before the test ends. */
  readonly postScreenshotMs = 2500;

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
      await first.waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('Wallet Transfer navigation element is not visible.');
  }

  async openWalletTransfer(): Promise<void> {
    await waitForPageSettled(this.page);
    const link = await this.firstVisible([
      this.page.getByRole('link', { name: /wallet transfer/i }),
      this.page.locator('a[href="/wallet/transfer"]'),
      this.page.locator('a:has-text("Wallet Transfer")'),
      this.page.locator('.main-menu span.menu-title').filter({ hasText: /^wallet transfer$/i }),
    ]);
    await link.scrollIntoViewIfNeeded();
    await link.click();
  }

  async waitForWalletTransferPageLoaded(): Promise<void> {
    await waitForPageSettled(this.page, {
      urlPattern: /\/wallet\/transfer/i,
      settleMs: 300,
    });
    await expect(this.page.locator('body')).toContainText(/wallet transfer/i, { timeout: 8000 });
  }

  async expectWalletTransferVisible(): Promise<void> {
    await this.waitForWalletTransferPageLoaded();
  }

  async screenshot(): Promise<Buffer | undefined> {
    return screenshotAfterSettle(this.page);
  }

  async pauseAfterScreenshot(): Promise<void> {
    await this.page.waitForTimeout(this.postScreenshotMs);
  }
}
