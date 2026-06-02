import { type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { screenshotAfterSettle, waitForPageSettled } from '../utils/page-settle';

export class PaymentHistoryPage {
  constructor(private readonly page: Page) {}

  /**
   * Waits until Payment History has finished loading (card, table, Receipt actions).
   * The page often shows a loader for several seconds before rows appear.
   */
  async waitForPaymentHistoryPageLoaded(): Promise<void> {
    await waitForPageSettled(this.page, { requireAppCard: true, timeoutMs: 15000 });

    await this.page
      .locator('div.content-body .card.mb-0, div.app-content .card.mb-0')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    await this.page
      .locator('div.content-body .card.mb-0 table tbody tr, div.content-body table tbody tr')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => undefined);

    await this.page
      .getByRole('button', { name: /receipt/i })
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    await waitForPageSettled(this.page, { requireAppCard: true, settleMs: 400 });
  }

  /**
   * Clicks the Payment History sidebar/nav link and waits for the page to fully render.
   */
  async openPaymentHistory(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);

    const link = this.page
      .locator('.main-menu span.menu-title')
      .filter({ hasText: /^payment history$/i })
      .first();
    await link.waitFor({ state: 'visible', timeout: 10000 });
    await link.click();
    await this.waitForPaymentHistoryPageLoaded();
  }

  /** Screenshot after `openPaymentHistory()` / `waitForPaymentHistoryPageLoaded()`. */
  async screenshotLoadedPage(): Promise<Buffer | undefined> {
    return screenshotAfterSettle(this.page, { requireAppCard: true, settleMs: 300 });
  }

  /**
   * Clicks the first "Receipt" button in the payment history table.
   * Captures a screenshot immediately after the click (while the browser
   * download bar is still visible), saves the downloaded file to `saveDir`,
   * and returns both the screenshot buffer and the saved file path.
   *
   * Confirmed button selector from live DOM:
   *   div.content-body .card.mb-0 table tbody td button.btn-primary — text "Receipt"
   */
  async clickReceiptAndSave(saveDir: string): Promise<{ screenshot?: Buffer; savedPath: string }> {
    // Use getByRole for reliable matching regardless of CSS class structure
    const receiptBtn = this.page
      .getByRole('button', { name: /receipt/i })
      .first();

    await receiptBtn.waitFor({ state: 'visible', timeout: 10000 });
    await receiptBtn.scrollIntoViewIfNeeded();

    // Set up download listener BEFORE clicking
    const downloadPromise = this.page.waitForEvent('download', { timeout: 15000 });
    await receiptBtn.click();

    await waitForPageSettled(this.page, { settleMs: 400 });
    const screenshot = await screenshotAfterSettle(this.page, { settleMs: 200 });

    const download = await downloadPromise;
    const filename = download.suggestedFilename() || `receipt-${Date.now()}.pdf`;
    fs.mkdirSync(saveDir, { recursive: true });
    const savedPath = path.join(saveDir, filename);
    await download.saveAs(savedPath);

    return { screenshot, savedPath };
  }
}
