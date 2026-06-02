import { expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { screenshotAfterSettle, waitForPageSettled } from '../utils/page-settle';
import { silentScreenshot } from '../utils/screenshot';

const RECEIPT_LOADER_SELECTORS = [
  '.spinner-border',
  '.spinner-grow',
  '.vld-overlay',
  '[class*="loading-overlay"]',
  '.pace-active',
  '.v-progress-circular',
  '[class*="page-loader"]',
];

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

  /** After Receipt click: wait until in-page spinners / blocking loaders are gone. */
  async waitForReceiptDownloadLoaderGone(timeoutMs = 30_000): Promise<void> {
    await expect
      .poll(
        async () => {
          for (const selector of RECEIPT_LOADER_SELECTORS) {
            const loader = this.page.locator(selector).first();
            if (await loader.isVisible().catch(() => false)) return false;
          }
          return true;
        },
        { timeout: timeoutMs, intervals: [200, 400, 600] },
      )
      .toBeTruthy();
  }

  /**
   * Clicks the first "Receipt" button, waits for loaders to clear and the PDF
   * download to start, screenshots while the browser save/download UI is visible,
   * then saves the file under `saveDir`.
   */
  async clickReceiptAndSave(saveDir: string): Promise<{ screenshot?: Buffer; savedPath: string }> {
    const receiptBtn = this.page.getByRole('button', { name: /receipt/i }).first();

    await receiptBtn.waitFor({ state: 'visible', timeout: 10000 });
    await receiptBtn.scrollIntoViewIfNeeded();

    const downloadPromise = this.page.waitForEvent('download', { timeout: 30_000 });
    await receiptBtn.click();

    const [download] = await Promise.all([downloadPromise, this.waitForReceiptDownloadLoaderGone()]);

    // Brief pause so Chrome’s download / save bar is visible in the capture.
    await this.page.waitForTimeout(700);
    const screenshot = await silentScreenshot(this.page);

    const filename = download.suggestedFilename() || `receipt-${Date.now()}.pdf`;
    fs.mkdirSync(saveDir, { recursive: true });
    const savedPath = path.join(saveDir, filename);
    await download.saveAs(savedPath);

    return { screenshot, savedPath };
  }
}
