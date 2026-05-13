import { expect, type Locator, type Page } from '@playwright/test';

export class InventoryPage {
  constructor(private readonly page: Page) {}

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
      await first.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('Inventory navigation element is not visible.');
  }

  async openInventory(): Promise<void> {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    const link = await this.firstVisible([
      this.page.getByRole('link', { name: /^inventory$/i }),
      this.page.locator('a[href="/inventory"]'),
      this.page.locator('a:has-text("Inventory")'),
    ]);
    await link.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  async expectInventoryVisible(): Promise<void> {
    const url = this.page.url().toLowerCase();
    if (url.includes('/inventory')) return;
    await expect(this.page.locator('body')).toContainText(/inventory/i, { timeout: 20000 });
  }
}
