import { type Locator, type Page } from '@playwright/test';
import { captureAndReadToast, silentScreenshot, type ToastCapture } from '../utils/screenshot';

export type PaymentStatus = 'success' | 'failed' | 'unknown';

export class RechargeWalletPage {
  constructor(private readonly page: Page) {}
  private readonly visualDelayMs = 900;

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      if (await locator.first().isVisible().catch(() => false)) {
        return locator.first();
      }
    }
    throw new Error('Required wallet navigation element is not visible.');
  }

  private async walletsMenu(): Promise<Locator> {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);

    const candidates = [
      this.page.getByRole('link', { name: /^wallets$/i }),
      this.page.locator('a:has(.menu-title:text("Wallets"))'),
      this.page.locator('li.nav-item.has-sub a:has-text("Wallets")'),
    ];

    for (const locator of candidates) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
      await first.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }

    throw new Error('Wallets navigation menu did not become visible after waiting.');
  }

  private async rechargeWalletLink(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByRole('link', { name: /recharge wallet/i }),
      this.page.locator('a[href="/wallet/recharge"]'),
      this.page.locator('a:has-text("Recharge Wallet")'),
      this.page.locator('[data-testid="recharge-wallet"]'),
    ]);
  }

  private async amountInput(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByLabel(/amount/i),
      this.page.getByPlaceholder(/amount/i),
      this.page.locator('input[name="amount"]'),
      this.page.locator('input[id*="amount"]'),
      this.page.locator('input[type="number"]'),
    ]);
  }

  private async payWithBkashButton(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByRole('button', { name: /pay with bkash|bkash/i }),
      this.page.locator('button:has-text("Pay with bKash")'),
      this.page.locator('button:has-text("Pay with bkash")'),
      this.page.locator('[data-testid="pay-with-bkash"]'),
    ]);
  }

  private async bkashNumberInput(gatewayPage: Page): Promise<Locator> {
    const candidates = [
      gatewayPage.getByLabel(/bkash number|mobile number|account number/i),
      gatewayPage.getByPlaceholder(/bkash number|mobile number|account number/i),
      gatewayPage.locator('input[name*="mobile"]'),
      gatewayPage.locator('input[name*="phone"]'),
      gatewayPage.locator('input[name*="number"]'),
      gatewayPage.locator('input[type="tel"]'),
      gatewayPage.locator('input[type="text"]'),
    ];

    for (const locator of candidates) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }

    throw new Error('bKash number input is not visible on gateway page.');
  }

  private async bkashSubmitButton(gatewayPage: Page): Promise<Locator> {
    const candidates = [
      gatewayPage.getByRole('button', { name: /submit|confirm|proceed|next|continue/i }),
      gatewayPage.locator('button[type="submit"]'),
      gatewayPage.locator('input[type="submit"]'),
      gatewayPage.locator('button:has-text("Submit")'),
    ];

    for (const locator of candidates) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }

    throw new Error('Submit button is not visible on bKash gateway page.');
  }

  private async bkashVerificationCodeInput(gatewayPage: Page): Promise<Locator> {
    const candidates = [
      gatewayPage.getByLabel(/verification code|otp|code/i),
      gatewayPage.getByPlaceholder(/verification code|otp|code/i),
      gatewayPage.locator('input[name*="otp"]'),
      gatewayPage.locator('input[name*="verification"]'),
      gatewayPage.locator('input[name*="code"]'),
      gatewayPage.locator('input[inputmode="numeric"]'),
      gatewayPage.locator('input[type="tel"]'),
      gatewayPage.locator('input[type="text"]'),
    ];

    for (const locator of candidates) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }

    throw new Error('Verification code input is not visible on bKash gateway page.');
  }

  private async bkashPinInput(gatewayPage: Page): Promise<Locator> {
    const candidates = [
      gatewayPage.getByLabel(/pin/i),
      gatewayPage.getByPlaceholder(/pin/i),
      gatewayPage.locator('input[name*="pin"]'),
      gatewayPage.locator('input[type="password"]'),
      gatewayPage.locator('input[inputmode="numeric"]'),
      gatewayPage.locator('input[type="tel"]'),
      gatewayPage.locator('input[type="text"]'),
    ];

    for (const locator of candidates) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }

    throw new Error('PIN input is not visible on bKash gateway page.');
  }

  async openWalletsAndClickRechargeWallet(): Promise<ToastCapture> {
    const walletsMenu = await this.walletsMenu();
    await walletsMenu.click();

    const rechargeLink = await this.rechargeWalletLink();
    await rechargeLink.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    await this.page.waitForTimeout(this.visualDelayMs);
    return captureAndReadToast(this.page);
  }

  /**
   * Fills the amount and clicks "Pay with bKash".
   * Waits 1.5 s then reads the main portal page for any error toaster
   * (e.g. minimum amount not met). Returns the gateway page plus a
   * ToastCapture so the spec can immediately fail if an error was shown.
   */
  async enterAmountAndPayWithBkash(amount: string): Promise<{ gatewayPage: Page; toast: ToastCapture }> {
    const amountInput = await this.amountInput();
    await amountInput.fill(amount);
    await this.page.waitForTimeout(this.visualDelayMs);

    const payWithBkash = await this.payWithBkashButton();
    const popupPromise = this.page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
    await payWithBkash.click();

    // Wait 1.5 s then capture — gives error toasters time to appear on the portal
    await this.page.waitForTimeout(1500);
    const toast = await captureAndReadToast(this.page);

    const popupPage = await popupPromise;
    const gatewayPage = popupPage ?? this.page;
    await gatewayPage.waitForLoadState('domcontentloaded').catch(() => undefined);
    return { gatewayPage, toast };
  }

  async enterBkashNumberAndSubmit(gatewayPage: Page, bkashNumber: string): Promise<ToastCapture> {
    await gatewayPage.waitForTimeout(this.visualDelayMs);

    const numberInput = await this.bkashNumberInput(gatewayPage);
    await numberInput.fill(bkashNumber);
    await gatewayPage.waitForTimeout(this.visualDelayMs);

    const submitButton = await this.bkashSubmitButton(gatewayPage);
    await submitButton.click();
    return captureAndReadToast(gatewayPage);
  }

  async enterVerificationCodeAndConfirm(gatewayPage: Page, verificationCode: string): Promise<ToastCapture> {
    await gatewayPage.waitForTimeout(this.visualDelayMs);

    const verificationCodeInput = await this.bkashVerificationCodeInput(gatewayPage);
    await verificationCodeInput.fill(verificationCode);
    await gatewayPage.waitForTimeout(this.visualDelayMs);

    const confirmButton = await this.bkashSubmitButton(gatewayPage);
    await confirmButton.click();
    return captureAndReadToast(gatewayPage);
  }

  async enterPinAndConfirm(gatewayPage: Page, pin: string): Promise<ToastCapture> {
    await gatewayPage.waitForTimeout(this.visualDelayMs);

    const pinInput = await this.bkashPinInput(gatewayPage);
    await pinInput.fill(pin);
    await gatewayPage.waitForTimeout(this.visualDelayMs);

    const confirmButton = await this.bkashSubmitButton(gatewayPage);
    await confirmButton.click();
    return captureAndReadToast(gatewayPage);
  }

  async captureGatewayPage(gatewayPage: Page): Promise<ToastCapture> {
    return captureAndReadToast(gatewayPage);
  }

  private inferStatusFromText(rawText: string): PaymentStatus {
    const pageText = rawText.toLowerCase();

    const hasSuccessStatus =
      pageText.includes('successful') ||
      pageText.includes('payment successful') ||
      pageText.includes('status: success');

    const hasFailedStatus =
      pageText.includes('invalid payment status') ||
      pageText.includes('status failed') ||
      pageText.includes('status: failed') ||
      pageText.includes('payment failed');

    if (hasFailedStatus) return 'failed';
    if (hasSuccessStatus) return 'success';
    return 'unknown';
  }

  async waitForDashboardAndGetPaymentStatus(gatewayPage: Page): Promise<{
    status: PaymentStatus;
    page: Page;
  }> {
    const candidates = [gatewayPage, this.page];
    const deadline = Date.now() + 60000;

    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        const currentUrl = candidate.url().toLowerCase();
        const bodyText = await candidate.locator('body').innerText().catch(() => '');
        const status = this.inferStatusFromText(bodyText || '');
        const isDashboardLike =
          currentUrl.includes('/dashboard') ||
          currentUrl.includes('/wallet') ||
          bodyText.toLowerCase().includes('wallets');

        if (isDashboardLike && status !== 'unknown') {
          return { status, page: candidate };
        }
      }

      await this.page.waitForTimeout(1000);
    }

    return { status: 'unknown', page: gatewayPage };
  }
}
