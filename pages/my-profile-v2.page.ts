import { expect, type Locator, type Page } from '@playwright/test';
import { screenshotAfterSettle, waitForPageSettled } from '../utils/page-settle';

export class MyProfileV2Page {
  constructor(private readonly page: Page) {}
  private readonly settleMs = 400;

  /** Navbar user menu (avatar dropdown). */
  private navbarUserMenu(): Locator {
    return this.page
      .locator('nav.header-navbar li.nav-item')
      .filter({ has: this.page.locator('span.b-avatar.badge-minimal') })
      .first();
  }

  private avatarToggle(): Locator {
    return this.navbarUserMenu().locator('a.dropdown-toggle, a[id*="BV_toggle"]').first();
  }

  private userDropdownMenu(): Locator {
    return this.navbarUserMenu().locator('ul.dropdown-menu.show').first();
  }

  /** Clicks the top-right avatar and waits for the dropdown (3 options). */
  async openUserDropdown(): Promise<void> {
    const toggle = this.avatarToggle();
    await toggle.waitFor({ state: 'visible', timeout: 15000 });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await expect(this.userDropdownMenu()).toBeVisible({ timeout: 10000 });
    await this.page.waitForTimeout(this.settleMs);
  }

  async expectUserDropdownWithThreeOptions(): Promise<void> {
    const items = this.userDropdownMenu().locator('a.dropdown-item');
    await expect(items).toHaveCount(3, { timeout: 10000 });
  }

  async clickDropdownMyProfile(): Promise<void> {
    await this.userDropdownMenu()
      .locator('a.dropdown-item')
      .filter({ hasText: /^my profile$/i })
      .first()
      .click();
    await waitForPageSettled(this.page);
  }

  async clickDropdownChangePassword(): Promise<void> {
    await this.userDropdownMenu()
      .locator('a.dropdown-item')
      .filter({ hasText: /^change password$/i })
      .first()
      .click();
    await waitForPageSettled(this.page);
  }

  async expectProfileDetailsPage(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/details|profile/i, { timeout: 20000 });
    await waitForPageSettled(this.page);
  }

  async expectChangePasswordPage(): Promise<void> {
    await expect(this.page.getByPlaceholder('Old Password', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(this.page.getByPlaceholder('New Password', { exact: true })).toBeVisible();
    await expect(this.page.getByPlaceholder('Confirm Password', { exact: true })).toBeVisible();
    await this.page.waitForTimeout(this.settleMs);
  }

  async screenshot(): Promise<Buffer | undefined> {
    return screenshotAfterSettle(this.page);
  }
}
