import { expect, type Locator, type Page } from '@playwright/test';

export class WalletTransferPage {
  constructor(private readonly page: Page) {}

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
      await first.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('Wallet Transfer navigation element is not visible.');
  }

  async openWalletTransfer(): Promise<void> {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    const link = await this.firstVisible([
      this.page.getByRole('link', { name: /wallet transfer/i }),
      this.page.locator('a[href="/wallet/transfer"]'),
      this.page.locator('a:has-text("Wallet Transfer")'),
    ]);
    await link.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  async expectWalletTransferVisible(): Promise<void> {
    const url = this.page.url().toLowerCase();
    if (url.includes('/wallet/transfer')) return;
    await expect(this.page.locator('body')).toContainText(/wallet transfer/i, { timeout: 20000 });
  }
}
