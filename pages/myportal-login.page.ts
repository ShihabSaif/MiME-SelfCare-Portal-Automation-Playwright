import { expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import { waitForPageSettled } from '../utils/page-settle';
import { silentScreenshot } from '../utils/screenshot';

export class MyPortalLoginPage {
  private readonly loginUrl = process.env.MYPORTAL_URL;
  private readonly defaultWaitMs = 15000;

  constructor(private readonly page: Page) {}

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
      await first.waitFor({ state: 'visible', timeout: this.defaultWaitMs }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }
    throw new Error('No visible matching locator found.');
  }

  private async runStep<T>(stepName: string, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const safeStepName = stepName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
      const screenshotPath = `test-results/failure-${safeStepName}-${Date.now()}.png`;
      const buf = await silentScreenshot(this.page);
      if (buf) fs.writeFileSync(screenshotPath, buf);
      throw error;
    }
  }

  private async usernameInput(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByLabel(/username|user id|email/i),
      this.page.getByPlaceholder(/username|user id|email/i),
      this.page.locator('input[name="username"]'),
      this.page.locator('input[name="email"]'),
      this.page.locator('input[type="text"]'),
    ]);
  }

  private async passwordInput(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByLabel(/password/i),
      this.page.getByPlaceholder(/password/i),
      this.page.locator('input[name="password"]'),
      this.page.locator('input[type="password"]'),
    ]);
  }

  private async loginButton(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByRole('button', { name: /log ?in|sign ?in/i }),
      this.page.locator('button:has-text("Login")'),
      this.page.locator('input[type="submit"]'),
    ]);
  }

  async goto(): Promise<void> {
    if (!this.loginUrl) {
      throw new Error('Missing MYPORTAL_URL in environment variables.');
    }
    await this.runStep('goto_login_url', async () => {
      await this.page.goto(this.loginUrl!, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(500);
    });
  }

  async fillCredentials(username: string, password: string): Promise<void> {
    const usernameInput = await this.runStep('resolve_username_input', async () => this.usernameInput());
    const passwordInput = await this.runStep('resolve_password_input', async () => this.passwordInput());

    await this.runStep('fill_username', async () => {
      await usernameInput.fill(username);
    });
    await this.runStep('fill_password', async () => {
      await passwordInput.fill(password);
    });
  }

  /** Brief pause after fill, then screenshot of the populated login form (before submit). */
  async captureFilledCredentialsForm(waitMs = 800): Promise<Buffer | undefined> {
    await this.page.waitForTimeout(waitMs);
    return silentScreenshot(this.page);
  }

  async submitCredentials(): Promise<void> {
    const loginButton = await this.runStep('resolve_login_button', async () => this.loginButton());
    await this.runStep('click_login', async () => {
      await loginButton.click();
    });
  }

  async waitForDashboardAfterLogin(): Promise<void> {
    await waitForPageSettled(this.page, { requireAppCard: true, timeoutMs: 15000 });
  }

  async login(username: string, password: string): Promise<void> {
    await this.fillCredentials(username, password);
    await this.submitCredentials();
    await this.waitForDashboardAfterLogin();
  }

  async loginIfNeeded(username: string, password: string): Promise<void> {
    const usernamePromptVisible = await this.page
      .getByLabel(/username|user id|email/i)
      .first()
      .isVisible()
      .catch(() => false);

    const signInButtonVisible = await this.page
      .getByRole('button', { name: /sign in|log ?in/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (usernamePromptVisible || signInButtonVisible) {
      await this.login(username, password);
    }
  }

  async expectLoginFormHidden(): Promise<void> {
    await this.runStep('verify_login_success', async () => {
      await expect(this.page.locator('input[type="password"]')).toHaveCount(0, {
        timeout: 1,
      });
    });
  }
}
