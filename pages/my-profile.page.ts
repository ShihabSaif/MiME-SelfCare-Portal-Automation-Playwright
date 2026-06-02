import { expect, type Locator, type Page } from '@playwright/test';
import { screenshotAfterSettle, waitForPageSettled } from '../utils/page-settle';
import { captureAndReadToast, type ToastCapture } from '../utils/screenshot';

type ChangePasswordField = 'Old Password' | 'New Password' | 'Confirm Password';

export class MyProfilePage {
  constructor(private readonly page: Page) {}
  private readonly settleMs = 350;

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
    await waitForPageSettled(this.page);
  }

  async openDetails(): Promise<void> {
    await this.openProfileSubTab('Details');
  }

  async expectDetailsVisible(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/details|profile/i, { timeout: 20000 });
    await waitForPageSettled(this.page);
  }

  async openChangePassword(): Promise<void> {
    await this.openProfileSubTab('Change Password');
  }

  async expectChangePasswordVisible(): Promise<void> {
    await expect(this.page.locator('body')).toContainText(/change password|new password|current password/i, {
      timeout: 20000,
    });
    await waitForPageSettled(this.page);
  }

  /** Waits for the change-password form inputs (dynamic BVID ids). */
  async expectChangePasswordFormReady(): Promise<void> {
    await expect(this.passwordInput('Old Password')).toBeVisible({ timeout: 20000 });
    await expect(this.passwordInput('New Password')).toBeVisible();
    await expect(this.passwordInput('Confirm Password')).toBeVisible();
    await this.page.waitForTimeout(this.settleMs);
  }

  private changePasswordForm(): Locator {
    return this.page.locator('form').filter({
      has: this.page.getByPlaceholder('Old Password', { exact: true }),
    });
  }

  private passwordInput(placeholder: ChangePasswordField): Locator {
    return this.changePasswordForm().getByPlaceholder(placeholder, { exact: true });
  }

  private showPasswordToggle(placeholder: ChangePasswordField): Locator {
    const input = this.changePasswordForm().getByPlaceholder(placeholder, { exact: true });
    return input
      .locator('xpath=ancestor::div[contains(@class,"input-group")]//div[contains(@class,"input-group-text")]')
      .first();
  }

  private async fillChangePasswordField(placeholder: ChangePasswordField, value: string): Promise<void> {
    const input = this.passwordInput(placeholder);
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await input.clear();

    await input.pressSequentially(value, { delay: 25 });
    if ((await input.inputValue()) !== value) {
      await input.fill(value);
    }

    await expect(input).toHaveValue(value);
    await input.blur();
    await this.page.waitForTimeout(150);
  }

  async fillAllChangePasswordFields(value: string): Promise<void> {
    for (const field of ['Old Password', 'New Password', 'Confirm Password'] as const) {
      await this.fillChangePasswordField(field, value);
    }
    await this.page.waitForTimeout(this.settleMs);
  }

  async expectAllChangePasswordFieldsFilled(value: string): Promise<void> {
    for (const field of ['Old Password', 'New Password', 'Confirm Password'] as const) {
      await expect(this.passwordInput(field)).toHaveValue(value);
    }
  }

  /** After Reset: fill Old, New, and Confirm, then click Submit. */
  async refillAllChangePasswordFieldsAndSubmit(value: string): Promise<ToastCapture> {
    await this.expectChangePasswordFieldsEmpty();
    await this.fillAllChangePasswordFields(value);
    await this.expectAllChangePasswordFieldsFilled(value);
    await this.clickChangePasswordSubmit();
    return this.waitForChangePasswordSubmitFeedback();
  }

  /** Clicks each show-password control (input-group-text) one by one. */
  async clickAllShowPasswordToggles(): Promise<void> {
    for (const field of ['Old Password', 'New Password', 'Confirm Password'] as const) {
      const toggle = this.showPasswordToggle(field);
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await this.page.waitForTimeout(200);
    }
    await this.page.waitForTimeout(this.settleMs);
  }

  async clickChangePasswordReset(): Promise<void> {
    const reset = this.changePasswordForm().locator('button[type="reset"], button:has-text("Reset")').first();
    await reset.scrollIntoViewIfNeeded();
    await reset.click();
    await this.page.waitForTimeout(this.settleMs);
  }

  async expectChangePasswordFieldsEmpty(): Promise<void> {
    for (const field of ['Old Password', 'New Password', 'Confirm Password'] as const) {
      await expect(this.passwordInput(field)).toHaveValue('');
    }
  }

  async clickChangePasswordSubmit(): Promise<void> {
    const submit = this.changePasswordForm().locator('button[type="submit"], button:has-text("Submit")').first();
    await expect(submit).toBeEnabled({ timeout: 10000 });
    await submit.scrollIntoViewIfNeeded();
    await submit.click();
  }

  async waitForChangePasswordSubmitFeedback(): Promise<ToastCapture> {
    return captureAndReadToast(this.page, 10000);
  }

  async screenshotChangePasswordForm(): Promise<Buffer | undefined> {
    return screenshotAfterSettle(this.page);
  }
}
