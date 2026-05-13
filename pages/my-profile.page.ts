import { expect, type Locator, type Page } from '@playwright/test';

export class MyProfilePage {
  constructor(private readonly page: Page) {}

  private async firstVisible(locators: Locator[], perLocatorTimeoutMs = 15000): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
      await first.waitFor({ state: 'visible', timeout: perLocatorTimeoutMs }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('My Profile navigation element is not visible.');
  }

  private async openProfileSubTab(tabName: 'Details' | 'Change Password'): Promise<void> {
    const subTab = await this.firstVisible(
      [
        this.page.getByRole('tab', { name: new RegExp(`^${tabName}$`, 'i') }),
        this.page.getByRole('link', { name: new RegExp(`^${tabName}$`, 'i') }),
        this.page.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') }),
        this.page.locator(`a:has-text("${tabName}")`),
        this.page.locator(`button:has-text("${tabName}")`),
      ],
      2000,
    );

    await subTab.click();
    await this.page.waitForTimeout(120);
  }

  async openMyProfile(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    const link = await this.firstVisible([
      this.page.getByRole('link', { name: /my profile/i }),
      this.page.getByRole('button', { name: /my profile/i }),
      this.page.locator('a:has-text("My Profile")'),
      this.page.locator('button:has-text("My Profile")'),
    ]);
    await link.click();
    await this.page.waitForTimeout(400);
  }

  async expectMyProfileVisible(): Promise<void> {
    const url = this.page.url().toLowerCase();
    if (url.includes('profile')) return;
    await expect(this.page.locator('body')).toContainText(/my profile|profile/i, { timeout: 20000 });
  }

  async openDetails(): Promise<void> {
    await this.openProfileSubTab('Details');
  }

  async expectDetailsVisible(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/details|profile/i, { timeout: 20000 });
  }

  async openChangePassword(): Promise<void> {
    await this.openProfileSubTab('Change Password');
  }

  async expectChangePasswordVisible(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/change password|new password|current password/i, {
      timeout: 20000,
    });
  }
}
