import { expect, type Page } from '@playwright/test';

export class MyProfilePage {
  constructor(private readonly page: Page) {}

  /**
   * Locates a sidebar menu-title span by exact text within .main-menu.
   * Targets the confirmed DOM structure:
   *   .main-menu > ul.navigation-main > li.nav-item > a > span.menu-title
   */
  private menuTitle(text: string) {
    return this.page
      .locator('.main-menu span.menu-title')
      .filter({ hasText: new RegExp(`^${text}$`, 'i') })
      .first();
  }

  /**
   * Clicks the "My Profile" sidebar nav item which opens the sub-menu.
   * Waits until the "Details" sub-item is visible (confirms sub-menu opened).
   */
  async openMyProfile(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.menuTitle('My Profile').click();

    // Wait for Details sub-item to appear — confirms the sub-menu is open
    await this.menuTitle('Details').waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(200);
  }

  async expectMyProfileVisible(): Promise<void> {
    await expect(this.menuTitle('Details')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Clicks a sidebar sub-item ("Details" or "Change Password") then waits
   * for the destination page to load before returning.
   */
  private async openProfileSubTab(tabName: 'Details' | 'Change Password'): Promise<void> {
    const item = this.menuTitle(tabName);
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.page.waitForTimeout(300);
  }

  async openDetails(): Promise<void> {
    await this.openProfileSubTab('Details');
  }

  async expectDetailsVisible(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/details|profile/i, { timeout: 20000 });
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.page.waitForTimeout(1500);
  }

  async openChangePassword(): Promise<void> {
    await this.openProfileSubTab('Change Password');
  }

  async expectChangePasswordVisible(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/change password|new password|current password/i, {
      timeout: 20000,
    });
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.page.waitForTimeout(1500);
  }
}
