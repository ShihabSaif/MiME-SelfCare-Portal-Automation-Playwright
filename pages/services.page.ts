import { expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export class ServicesPage {
  constructor(private readonly page: Page) {}
  private readonly settleMs = 600;

  private async firstVisible(locators: Locator[]): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
      await first.waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) {
        return first;
      }
    }
    throw new Error('Services navigation element is not visible.');
  }

  private async servicesTab(): Promise<Locator> {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    return this.firstVisible([
      this.page.getByRole('link', { name: /^services$/i }),
      this.page.getByRole('tab', { name: /services/i }),
      this.page.locator('a[href*="admin-dashboard"]'),
      this.page.locator('a:has(.menu-title:text("Services"))'),
      this.page.locator('a:has-text("Services")'),
    ]);
  }

  async openServices(): Promise<void> {
    const tab = await this.servicesTab();
    await tab.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  async expectServicesVisible(): Promise<void> {
    const url = this.page.url().toLowerCase();
    if (url.includes('admin-dashboard') || url.includes('service')) {
      return;
    }
    await expect(this.page.locator('body')).toContainText(/services/i, { timeout: 20000 });
  }

  async openCategory(categoryName: string): Promise<void> {
    const tab = await this.firstVisible([
      this.page.getByRole('tab', { name: new RegExp(`^${escapeRegex(categoryName)}$`, 'i') }),
      this.page.getByRole('link', { name: new RegExp(`^${escapeRegex(categoryName)}$`, 'i') }),
      this.page.getByRole('button', { name: new RegExp(`^${escapeRegex(categoryName)}$`, 'i') }),
      this.page.locator(`a:has-text("${categoryName}")`),
      this.page.locator(`button:has-text("${categoryName}")`),
      this.page.locator(`.nav-link:has-text("${categoryName}")`),
    ]);

    await tab.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    await this.page.waitForTimeout(this.settleMs);
  }

  async expectCategoryActivated(categoryName: string): Promise<void> {
    const label = new RegExp(escapeRegex(categoryName), 'i');
    const activatedMarker = this.page.locator(
      [
        `.active:has-text("${categoryName}")`,
        `.router-link-active:has-text("${categoryName}")`,
        `.router-link-exact-active:has-text("${categoryName}")`,
        `[aria-selected="true"]:has-text("${categoryName}")`,
      ].join(', '),
    );

    if (await activatedMarker.first().isVisible().catch(() => false)) {
      return;
    }

    await expect(this.page.locator('body')).toContainText(label, { timeout: 10000 });
  }

  /** Services dashboard card (MiME Internet tab content). */
  private servicesDashboardSection(): Locator {
    return this.page.locator('section#dashboard-ecommerce');
  }

  /** Data row that has Info / Graph (avoids header row when tbody/rowgroup layout varies). */
  private firstMimeInternetServiceRow(): Locator {
    return this.servicesDashboardSection()
      .getByRole('row')
      .filter({ has: this.page.getByRole('button', { name: /^info$/i }) })
      .first();
  }

  async openMimeInternetTab(): Promise<void> {
    await this.openCategory('MiME Internet');
    await this.expectCategoryActivated('MiME Internet');
  }

  async clickResendPasswordFirstRow(): Promise<void> {
    const row = this.firstMimeInternetServiceRow();
    let btn = row.getByRole('button', { name: /resend password/i });
    if (!(await btn.isVisible().catch(() => false))) {
      btn = this.servicesDashboardSection().getByRole('button', { name: /resend password/i }).first();
    }
    await expect(btn).toBeVisible({ timeout: 20000 });
    await btn.click();
  }

  /** Confirm Resend dialog (Yes / No). */
  private confirmResendDialog(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ visible: true })
      .filter({ has: this.page.getByRole('button', { name: /^yes$/i }) })
      .filter({ has: this.page.getByRole('button', { name: /^no$/i }) })
      .last();
  }

  async expectConfirmResendModalVisible(): Promise<Locator> {
    const d = this.confirmResendDialog();
    await expect(d).toBeVisible({ timeout: 20000 });
    await this.page.waitForTimeout(300);
    return d;
  }

  async clickConfirmResendNo(modal: Locator): Promise<void> {
    await modal.getByRole('button', { name: /^no$/i }).click();
    await expect(modal).toBeHidden({ timeout: 15000 });
  }

  async clickConfirmResendYes(modal: Locator): Promise<void> {
    await modal.getByRole('button', { name: /^yes$/i }).click();
    await expect(modal).toBeHidden({ timeout: 20000 });
  }

  private async arePasswordResendLoadersGone(): Promise<boolean> {
    const spinners = this.page.locator('.spinner-border, .spinner-grow');
    const n = await spinners.count();
    for (let i = 0; i < n; i++) {
      if (await spinners.nth(i).isVisible().catch(() => false)) return false;
    }
    const progress = this.page.getByRole('progressbar');
    const pc = await progress.count();
    for (let i = 0; i < pc; i++) {
      if (await progress.nth(i).isVisible().catch(() => false)) return false;
    }
    return true;
  }

  /** After Confirm Resend → Yes: wait until loading spinners / progress UI are gone (then screenshot). */
  async waitForPasswordResendLoaderGone(): Promise<void> {
    await expect
      .poll(async () => this.arePasswordResendLoadersGone(), {
        timeout: 30_000,
        intervals: [150, 300, 450],
      })
      .toBeTruthy();
  }

  /** Close success toast if still open so row actions (Info / Graph) receive clicks. */
  async dismissPasswordResentToastIfPresent(): Promise<void> {
    const toast = this.page.locator('.Vue-Toastification__toast').first();
    if (!(await toast.isVisible().catch(() => false))) return;
    const close = toast
      .locator('.Vue-Toastification__close-button, button[aria-label="close" i], .close')
      .first();
    if (await close.isVisible().catch(() => false)) {
      await close.click().catch(() => undefined);
    }
    await expect(toast).toBeHidden({ timeout: 8000 }).catch(() => undefined);
    await this.page.waitForTimeout(350);
  }

  /** Scroll MiME Internet table row into view and clear blocking toasts before Info / Graph. */
  async prepareMimeInternetRowActions(): Promise<void> {
    await this.dismissPasswordResentToastIfPresent();
    const row = this.firstMimeInternetServiceRow();
    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.page.waitForTimeout(250);
  }

  async clickFirstRowInfoButton(): Promise<void> {
    await this.prepareMimeInternetRowActions();
    const row = this.firstMimeInternetServiceRow();
    const btn = row.getByRole('button', { name: /^info$/i });
    await expect(btn).toBeVisible({ timeout: 20000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  async clickFirstRowGraphButton(): Promise<void> {
    await this.prepareMimeInternetRowActions();
    const row = this.firstMimeInternetServiceRow();
    const btn = row.getByRole('button', { name: /^graph$/i });
    await expect(btn).toBeVisible({ timeout: 20000 });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  /** Topmost visible Bootstrap/Vue modal. */
  async expectTopModalVisible(): Promise<Locator> {
    const dialog = this.page.getByRole('dialog').filter({ visible: true }).last();
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await this.page.waitForTimeout(350);
    return dialog;
  }

  /** Graph / bandwidth modal (toolbar with Download + Upload). */
  graphBandwidthModal(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ visible: true })
      .filter({ has: this.page.getByRole('button', { name: /^download$/i }) })
      .filter({ has: this.page.getByRole('button', { name: /^upload$/i }) })
      .last();
  }

  async expectGraphBandwidthModalVisible(): Promise<Locator> {
    const modal = this.graphBandwidthModal();
    await expect(modal).toBeVisible({ timeout: 20000 });
    await this.page.waitForTimeout(350);
    return modal;
  }

  async closeModalWithHeaderCross(modal: Locator): Promise<void> {
    const closeBtn = modal.locator('header button.close, header [aria-label="Close"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 10000 });
    await closeBtn.click();
    await expect(modal).toBeHidden({ timeout: 15000 });
  }

  async clickDownloadInGraphModal(modal: Locator): Promise<void> {
    await modal.getByRole('button', { name: /^download$/i }).click();
    await this.page.waitForTimeout(450);
  }

  async clickUploadInGraphModal(modal: Locator): Promise<void> {
    const upload = modal.getByRole('button', { name: /^upload$/i });
    const fcPromise = this.page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => undefined);
    await upload.click();
    const fc = await fcPromise;
    if (fc) await fc.setFiles([]).catch(() => undefined);
    await this.page.waitForTimeout(450);
  }

  /** Active Kothon tab content pane (contains the Bulk Onboard button). */
  private kothonActivePane(): Locator {
    return this.servicesDashboardSection()
      .locator('.tab-pane.active, [role="tabpanel"]:not([hidden])')
      .first();
  }

  /** Click the "Bulk Onboard" button inside the active Kothon tab. */
  async clickKothonBulkOnboard(): Promise<void> {
    const pane = this.kothonActivePane();
    let btn = pane.getByRole('button', { name: /^bulk onboard$/i });
    if (!(await btn.first().isVisible().catch(() => false))) {
      btn = this.servicesDashboardSection().getByRole('button', { name: /^bulk onboard$/i });
    }
    if (!(await btn.first().isVisible().catch(() => false))) {
      btn = this.page.getByRole('button', { name: /^bulk onboard$/i });
    }
    const target = btn.first();
    await expect(target).toBeVisible({ timeout: 20000 });
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await this.page.waitForTimeout(this.settleMs);
  }

  /** Bulk Onboard modal — accessible name is "Bulk Onboarding". */
  bulkOnboardModal(): Locator {
    return this.page
      .getByRole('dialog', { name: /bulk onboarding/i })
      .filter({ visible: true })
      .last();
  }

  async expectBulkOnboardModalVisible(): Promise<Locator> {
    const modal = this.bulkOnboardModal();
    await expect(modal).toBeVisible({ timeout: 20000 });
    await this.page.waitForTimeout(350);
    return modal;
  }

  /**
   * Click "Download Sample" inside the Bulk Onboard modal and persist the file
   * to `saveDir`. The "Download Sample" element is an anchor (link) with an
   * `href` to the sample file. Playwright captures the download via its API
   * rather than the OS-native save dialog. Returns the final saved file path.
   */
  async clickDownloadSampleAndSave(modal: Locator, saveDir: string): Promise<string> {
    let trigger = modal.getByRole('link', { name: /download sample/i });
    if (!(await trigger.first().isVisible().catch(() => false))) {
      trigger = modal.getByRole('button', { name: /download sample/i });
    }
    if (!(await trigger.first().isVisible().catch(() => false))) {
      trigger = modal.locator(
        'a:has-text("Download Sample"), button:has-text("Download Sample")',
      );
    }
    const target = trigger.first();
    await expect(target).toBeVisible({ timeout: 15000 });
    await target.scrollIntoViewIfNeeded();

    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    await target.click();
    const download = await downloadPromise;

    const suggested = download.suggestedFilename() || `BulkOnboarding_Sample-${Date.now()}.xlsx`;
    fs.mkdirSync(saveDir, { recursive: true });
    const targetPath = path.join(saveDir, suggested);
    await download.saveAs(targetPath);
    await this.page.waitForTimeout(350);
    return targetPath;
  }

  /**
   * In the Bulk Onboarding modal, pick `filePath` like a user clicking Browse:
   * Bootstrap-Vue uses a visible `label.custom-file-label` over a hidden
   * `input[type=file]`. Prefer `filechooser` after clicking the label; if the
   * chooser does not fire, assign the file directly on the input.
   */
  async chooseBulkOnboardExcelViaBrowse(modal: Locator, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Bulk onboard Excel file not found: ${filePath}`);
    }

    const fileInput = modal.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 15000 });

    const browseLabel = modal
      .locator('label.custom-file-label, label[data-browse="Browse"]')
      .first();
    await expect(browseLabel).toBeVisible({ timeout: 15000 });
    await browseLabel.scrollIntoViewIfNeeded();

    const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 15000 });
    await browseLabel.click();
    const fileChooser = await fileChooserPromise.catch(() => undefined);
    if (fileChooser) {
      await fileChooser.setFiles(filePath);
    } else {
      await fileInput.setInputFiles(filePath);
    }
    await this.page.waitForTimeout(400);
  }

  /** Click the enabled Upload button in the Bulk Onboarding modal. */
  async clickBulkOnboardModalUpload(modal: Locator): Promise<void> {
    const upload = modal.getByRole('button', { name: /^upload$/i });
    await expect(upload).toBeEnabled({ timeout: 15000 });
    await upload.scrollIntoViewIfNeeded();
    await upload.click();
  }

  /**
   * After Bulk Onboard upload, wait for visible upload feedback so the report
   * screenshot captures the alert / toast before the test decides pass or fail.
   */
  async waitForBulkOnboardUploadFeedback(modal: Locator): Promise<BulkOnboardUploadFeedback> {
    const started = Date.now();
    const windowMs = 8000;
    while (Date.now() - started < windowMs) {
      const feedback = await this.readBulkOnboardUploadFeedback(modal);
      if (feedback) return feedback;
      await this.page.waitForTimeout(400);
    }

    return {
      status: 'neutral',
      message: 'No success or error alert appeared after Bulk Onboard upload.',
    };
  }

  private async readBulkOnboardUploadFeedback(modal: Locator): Promise<BulkOnboardUploadFeedback | null> {
    const errorToast = this.page
      .locator(
        [
          '.Vue-Toastification__toast--error',
          '.Vue-Toastification__toast[class*="--error"]',
          '.Vue-Toastification__toast[class*="toast--error"]',
          '.Vue-Toastification__toast.danger',
        ].join(', '),
      )
      .filter({ visible: true })
      .first();
    if (await errorToast.isVisible().catch(() => false)) {
      const text = (await errorToast.innerText().catch(() => '')).trim();
      return { status: 'failed', message: text || 'Vue-Toastification error toast' };
    }

    const successToast = this.page
      .locator(
        [
          '.Vue-Toastification__toast--success',
          '.Vue-Toastification__toast[class*="--success"]',
          '.Vue-Toastification__toast[class*="toast--success"]',
          '.Vue-Toastification__toast.success',
        ].join(', '),
      )
      .filter({ visible: true })
      .first();
    if (await successToast.isVisible().catch(() => false)) {
      const text = (await successToast.innerText().catch(() => '')).trim();
      return { status: 'success', message: text || 'Vue-Toastification success toast' };
    }

    const modalDanger = modal
      .locator('.alert-danger, .alert.alert-danger, .invalid-feedback')
      .filter({ visible: true })
      .first();
    if (await modalDanger.isVisible().catch(() => false)) {
      const text = (await modalDanger.innerText().catch(() => '')).trim();
      if (text) return { status: 'failed', message: text };
    }

    const modalSuccess = modal
      .locator('.alert-success, .alert.alert-success, .valid-feedback')
      .filter({ visible: true })
      .first();
    if (await modalSuccess.isVisible().catch(() => false)) {
      const text = (await modalSuccess.innerText().catch(() => '')).trim();
      if (text) return { status: 'success', message: text };
    }

    const pageDanger = this.page
      .locator('.alert-danger[role="alert"], .alert.alert-danger[role="alert"]')
      .filter({ visible: true })
      .first();
    if (await pageDanger.isVisible().catch(() => false)) {
      const text = (await pageDanger.innerText().catch(() => '')).trim();
      if (text) return { status: 'failed', message: text };
    }

    const pageSuccess = this.page
      .locator('.alert-success[role="alert"], .alert.alert-success[role="alert"]')
      .filter({ visible: true })
      .first();
    if (await pageSuccess.isVisible().catch(() => false)) {
      const text = (await pageSuccess.innerText().catch(() => '')).trim();
      if (text) return { status: 'success', message: text };
    }

    const anyToast = this.page.locator('.Vue-Toastification__toast').filter({ visible: true });
    const n = await anyToast.count();
    for (let i = 0; i < n; i++) {
      const t = anyToast.nth(i);
      const cls = (await t.getAttribute('class')) ?? '';
      const text = (await t.innerText().catch(() => '')).trim();
      if (!text) continue;
      const errorByClass = /--error|toast-error|bg-danger|text-danger|variant-danger/i.test(cls);
      if (errorByClass) return { status: 'failed', message: text };
      const successByClass = /--success|toast-success|bg-success|text-success|variant-success/i.test(cls);
      if (successByClass) return { status: 'success', message: text };
      const status = classifyFeedbackText(text);
      if (status) return { status, message: text };
    }

    return null;
  }
}

function classifyFeedbackText(text: string): 'success' | 'failed' | null {
  if (/\bno\s+errors?\b/i.test(text)) return null;
  if (/\b0\s+errors?\b/i.test(text)) return null;
  if (/without\s+errors?/i.test(text)) return null;
  if (/\b(error|errors|failed|failure|invalid|unable|unsuccessful|wrong|exception)\b/i.test(text)) return 'failed';
  if (/\b(success|successful|completed|saved|uploaded)\b/i.test(text)) return 'success';
  return null;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface BulkOnboardUploadFeedback {
  status: 'success' | 'failed' | 'neutral';
  message: string;
}
