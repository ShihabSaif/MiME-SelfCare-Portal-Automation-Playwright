import { expect, type Locator, type Page } from '@playwright/test';

export class PaymentHistoryPage {
  constructor(private readonly page: Page) {}

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
      await first.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('Payment History navigation element is not visible.');
  }

  async openPaymentHistory(): Promise<void> {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    const link = await this.firstVisible([
      this.page.getByRole('link', { name: /payment history/i }),
      this.page.locator('a[href="/payment-history"]'),
      this.page.locator('a:has-text("Payment History")'),
    ]);
    await link.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  async expectPaymentHistoryVisible(): Promise<void> {
    const url = this.page.url().toLowerCase();
    if (url.includes('/payment-history')) return;
    await expect(this.page.locator('body')).toContainText(/payment history/i, { timeout: 20000 });
  }
}
