import { expect, type Locator, type Page } from '@playwright/test';
import { waitForPageSettled } from '../utils/page-settle';
import { silentScreenshot } from '../utils/screenshot';

const COMPLAINS_LOADER_SELECTORS = [
  '.spinner-border',
  '.spinner-grow',
  '.vld-overlay',
  '.b-overlay-wrap',
  '.b-overlay',
  '[class*="loading-overlay"]',
  '.pace-active',
  '.v-progress-circular',
  '[class*="page-loader"]',
];

export class ComplainsPage {
  constructor(private readonly page: Page) {}

  private async firstVisible(locators: Locator[], perLocatorTimeoutMs = 15000): Promise<Locator> {
    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible().catch(() => false)) return first;
      await first.waitFor({ state: 'visible', timeout: perLocatorTimeoutMs }).catch(() => undefined);
      if (await first.isVisible().catch(() => false)) return first;
    }
    throw new Error('Complains navigation element is not visible.');
  }

  private async areComplainsLoadersVisible(): Promise<boolean> {
    for (const selector of COMPLAINS_LOADER_SELECTORS) {
      const loader = this.page.locator(selector);
      const count = await loader.count();
      for (let i = 0; i < count; i++) {
        if (await loader.nth(i).isVisible().catch(() => false)) return true;
      }
    }
    const progress = this.page.getByRole('progressbar');
    const pc = await progress.count();
    for (let i = 0; i < pc; i++) {
      if (await progress.nth(i).isVisible().catch(() => false)) return true;
    }
    return false;
  }

  /** Loaders must stay hidden for several polls (avoids screenshot before spinner mounts). */
  async waitForComplainsLoadersGone(timeoutMs = 30_000): Promise<void> {
    const stablePolls = 3;
    let clearStreak = 0;

    await expect
      .poll(
        async () => {
          if (await this.areComplainsLoadersVisible()) {
            clearStreak = 0;
            return false;
          }
          clearStreak += 1;
          return clearStreak >= stablePolls;
        },
        { timeout: timeoutMs, intervals: [300, 450, 600] },
      )
      .toBeTruthy();
  }

  /** After Complains tab click: navigation, page content, then loaders cleared. */
  async waitForComplainsPageLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);

    await this.page.waitForURL(/\/customer\/complains/i, { timeout: 20000 }).catch(() => undefined);

    await expect
      .poll(
        async () => {
          const url = this.page.url().toLowerCase();
          if (url.includes('/customer/complains')) return true;
          return this.page
            .getByRole('button', { name: /\+?\s*create ticket/i })
            .first()
            .isVisible()
            .catch(() => false);
        },
        { timeout: 20_000, intervals: [300, 500, 700] },
      )
      .toBeTruthy();

    await this.page
      .locator('div.content-body .card, div.app-content .card')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    const button = await this.createTicketButton();
    await button.waitFor({ state: 'visible', timeout: 20000 });

    await this.page
      .locator('div.content-body table tbody tr, div.app-content table tbody tr')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => undefined);

    await this.waitForComplainsLoadersGone();
    await waitForPageSettled(this.page, { requireAppCard: true, settleMs: 500 });
  }

  /** Click Complains nav, wait for full page load, return screenshot for the report. */
  async openComplains(): Promise<Buffer | undefined> {
    await waitForPageSettled(this.page);
    const link = await this.firstVisible([
      this.page.getByRole('link', { name: /complains?/i }),
      this.page.locator('a[href="/customer/complains"]'),
      this.page.locator('a:has-text("Complains")'),
    ]);
    await link.click();
    await this.waitForComplainsPageLoaded();
    return silentScreenshot(this.page);
  }

  async expectComplainsVisible(): Promise<void> {
    const url = this.page.url().toLowerCase();
    if (url.includes('/customer/complains')) return;
    await expect(this.page.locator('body')).toContainText(/complains?/i, { timeout: 20000 });
  }

  private async createTicketButton(): Promise<Locator> {
    return this.firstVisible([
      this.page.getByRole('button', { name: /\+?\s*create ticket/i }),
      this.page.getByRole('link', { name: /\+?\s*create ticket/i }),
      this.page.locator('button:has-text("Create Ticket")'),
      this.page.locator('a:has-text("Create Ticket")'),
    ]);
  }

  private ticketModal(): Locator {
    return this.page.getByRole('dialog', { name: /create ticket/i }).first();
  }

  private async openComboBoxByLabel(labelPattern: RegExp): Promise<Locator> {
    const modal = this.ticketModal();
    const box = await this.firstVisible(
      [
        modal.getByRole('group').filter({ hasText: labelPattern }).getByRole('combobox').first(),
        modal.locator(`div:has(strong:has-text("${labelPattern.source.replace(/[\\^$]/g, '')}")) [role="combobox"]`).first(),
        modal.locator('[role="combobox"]').first(),
      ],
      4000,
    );
    await box.click();
    await this.page.waitForTimeout(250);
    return box;
  }

  private async pickFirstDropdownOption(): Promise<string> {
    const option = await this.firstVisible(
      [
        this.page.locator('[role="listbox"] [role="option"]').filter({ hasNotText: /no options|no data/i }).first(),
        this.page.locator('.vs__dropdown-menu [role="option"]').filter({ hasNotText: /no options|no data/i }).first(),
        this.page.getByRole('option').filter({ hasNotText: /no options|no data/i }).first(),
      ],
      5000,
    );
    const selectedText = (await option.innerText().catch(() => '')).trim();
    await option.click();
    await this.page.waitForTimeout(400);
    return selectedText;
  }

  async openCreateTicketModal(): Promise<void> {
    const button = await this.createTicketButton();
    await button.click();
    await this.expectTicketModalVisible();
  }

  async expectTicketModalVisible(): Promise<void> {
    const modal = this.ticketModal();
    if (await modal.isVisible().catch(() => false)) return;
    await expect(this.page.locator('body')).toContainText(/create ticket/i, { timeout: 15000 });
  }

  async closeTicketModalWithCross(): Promise<void> {
    const modal = this.ticketModal();
    const closeButton = await this.firstVisible([
      modal.getByRole('button', { name: /close/i }),
      modal.locator('button.close'),
      modal.locator('[aria-label*="close" i]'),
      modal.locator('button:has-text("×")'),
    ]);
    await closeButton.click();
  }

  async expectTicketModalClosed(): Promise<void> {
    const modal = this.ticketModal();
    await expect(modal).toBeHidden({ timeout: 10000 }).catch(async () => {
      await expect(this.page.locator('body')).not.toContainText(/create ticket/i, { timeout: 10000 });
    });
  }

  async selectFirstServiceTypeOption(): Promise<void> {
    const serviceTypeBox = await this.openComboBoxByLabel(/service type/i);
    const selectedOption = await this.pickFirstDropdownOption();
    const valueAfterSelection = ((await serviceTypeBox.innerText().catch(() => '')) || '').trim();
    if (!selectedOption || !valueAfterSelection.toLowerCase().includes(selectedOption.toLowerCase())) {
      throw new Error('Service Type dropdown option was not selected properly.');
    }
  }

  async selectFirstProblemOption(): Promise<void> {
    const modal = this.ticketModal();
    const problemBox = await this.firstVisible(
      [
        modal.getByRole('group').filter({ hasText: /problem/i }).getByRole('combobox').first(),
        modal.locator('[role="combobox"]').nth(1),
      ],
      4000,
    );
    await problemBox.click();
    await this.page.waitForTimeout(250);
    const selectedOption = await this.pickFirstDropdownOption();
    const selectedText = ((await problemBox.innerText().catch(() => '')) || '').trim();
    if (!selectedOption || !selectedText.toLowerCase().includes(selectedOption.toLowerCase())) {
      throw new Error('Problem dropdown option was not selected properly.');
    }
  }

  async selectFirstServiceLineOption(): Promise<void> {
    const modal = this.ticketModal();
    const serviceLineBox = await this.firstVisible(
      [
        modal.getByRole('group').filter({ hasText: /service line|service address/i }).getByRole('combobox').first(),
        modal.locator('[role="combobox"]').nth(2),
      ],
      5000,
    );
    await serviceLineBox.click();
    await this.page.waitForTimeout(250);
    const selectedOption = await this.pickFirstDropdownOption();
    const selectedText = ((await serviceLineBox.innerText().catch(() => '')) || '').trim();
    if (!selectedOption || !selectedText.toLowerCase().includes(selectedOption.toLowerCase())) {
      throw new Error('Service Line dropdown option was not selected properly.');
    }
  }

  async clickClearTicketModal(): Promise<void> {
    const modal = this.ticketModal();
    const clearButton = await this.firstVisible(
      [
        modal.getByRole('button', { name: /^clear$/i }),
        modal.getByRole('button', { name: /clear/i }),
        modal.locator('button:has-text("Clear")'),
      ],
      8000,
    );
    await clearButton.click();
    await this.page.waitForTimeout(400);
  }

  /**
   * Asserts the three ticket modal dropdowns no longer show a concrete selection
   * (placeholder / empty state after Clear).
   */
  async expectTicketModalFieldsCleared(): Promise<void> {
    const modal = this.ticketModal();
    await expect(modal).toBeVisible({ timeout: 10000 });
    await this.page.waitForTimeout(500);

    const norm = (t: string) => t.replace(/\s+/g, ' ').trim();
    const looksCleared = (text: string) => {
      const t = norm(text);
      if (!t) return true;
      if (/^select\b|^choose\b|^please\b|^type\b|^search\b|^\.\.\.$/i.test(t)) return true;
      if (/select|choose|please pick|type to search|no options|field is required/i.test(t) && t.length < 160) return true;
      return false;
    };

    const assertComboCleared = async (label: string, box: Locator) => {
      const raw = ((await box.innerText().catch(() => '')) || '').trim();
      if (!looksCleared(raw)) {
        throw new Error(`${label} was not cleared after Clear button (current value: "${raw.slice(0, 200)}").`);
      }
    };

    const serviceTypeBox = await this.firstVisible(
      [
        modal.getByRole('group').filter({ hasText: /service type/i }).getByRole('combobox').first(),
        modal.locator('[role="combobox"]').first(),
      ],
      8000,
    );
    await assertComboCleared('Service Type', serviceTypeBox);

    const problemBox = await this.firstVisible(
      [
        modal.getByRole('group').filter({ hasText: /problem/i }).getByRole('combobox').first(),
        modal.locator('[role="combobox"]').nth(1),
      ],
      8000,
    );
    await assertComboCleared('Problem', problemBox);

    // After Clear, "Service Line" may be a combobox or the UI may show only a disabled Service Address textbox.
    // Do not use the Nth modal combobox here — that is often "Priority", which Clear does not reset.
    const lineGroup = modal.getByRole('group').filter({ hasText: /service line|service address/i });
    const lineCombo = lineGroup.getByRole('combobox').first();
    if (await lineCombo.isVisible().catch(() => false)) {
      await assertComboCleared('Service Line', lineCombo);
    } else {
      const addrInput = lineGroup.locator('input, textarea').first();
      if (await addrInput.isVisible().catch(() => false)) {
        const val = await addrInput.inputValue().catch(() => '');
        if (norm(val)) {
          throw new Error(`Service Address was not cleared after Clear button (current value: "${val.slice(0, 200)}").`);
        }
      }
    }
  }

  async clickCreateTicket(): Promise<void> {
    const modal = this.ticketModal();
    const createButton = await this.firstVisible([
      modal.getByRole('button', { name: /^create$/i }),
      modal.getByRole('button', { name: /create ticket/i }),
      modal.locator('button:has-text("Create")'),
    ]);
    await createButton.click();
  }

  private successToast(): Locator {
    return this.page
      .locator('.Vue-Toastification__toast')
      .filter({ hasText: /ticket created successfully/i })
      .first();
  }

  /**
   * After Create: wait ~4–5s for submit loader to clear, verify success toast, screenshot.
   */
  async expectTicketCreatedSuccessfully(): Promise<Buffer | undefined> {
    const postCreateWaitMs = 4500;
    const pollMaxMs = 5000;
    const started = Date.now();

    while (Date.now() - started < pollMaxMs) {
      if (!(await this.areComplainsLoadersVisible())) break;
      await this.page.waitForTimeout(400);
    }

    const remaining = postCreateWaitMs - (Date.now() - started);
    if (remaining > 0) {
      await this.page.waitForTimeout(remaining);
    }

    const successToast = this.successToast();
    await expect(successToast).toBeVisible({ timeout: 20000 });
    await expect(successToast).toContainText(/ticket created successfully/i);

    return silentScreenshot(this.page);
  }

  async expectBackToComplainsList(): Promise<void> {
    await waitForPageSettled(this.page);
    await this.expectComplainsVisible();
  }
}
