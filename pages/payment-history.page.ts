import { type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { silentScreenshot } from '../utils/screenshot';

export class PaymentHistoryPage {
  constructor(private readonly page: Page) {}

  /**
   * Clicks the Payment History sidebar/nav link and waits for the page to
   * fully render before returning — so the screenshot is always taken after
   * the content is visible.
   */
  async openPaymentHistory(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);

    // Confirmed DOM: .main-menu span.menu-title containing "Payment History"
    const link = this.page
      .locator('.main-menu span.menu-title')
      .filter({ hasText: /^payment history$/i })
      .first();
    await link.waitFor({ state: 'visible', timeout: 10000 });

    await link.click();

    // The page shows a loader for ~4-5 s before the data card renders.
    // Wait for the confirmed content card (div.content-body .card.mb-0) to
    // appear — this guarantees the table data is fully visible.
    await this.page.waitForSelector(
      'div.content-body .card.mb-0, div.app-content .card.mb-0',
      { state: 'visible', timeout: 20000 },
    );
    await this.page.waitForTimeout(500);
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

    // Take screenshot immediately — browser download bar is visible at this moment
    const screenshot = await silentScreenshot(this.page);

    const download = await downloadPromise;
    const filename = download.suggestedFilename() || `receipt-${Date.now()}.pdf`;
    fs.mkdirSync(saveDir, { recursive: true });
    const savedPath = path.join(saveDir, filename);
    await download.saveAs(savedPath);

    return { screenshot, savedPath };
  }
}
