import type { Page } from '@playwright/test';

/**
 * Takes a screenshot silently via CDP (Page.captureScreenshot) without any
 * DOM manipulation, so the page never blinks or flickers during capture.
 *
 * Playwright's built-in page.screenshot({ animations: 'disabled' }) injects
 * and then removes a CSS rule to freeze animations — that injection is what
 * causes the visible flash. CDP captures the already-composited frame directly.
 *
 * Falls back to a standard page.screenshot() if CDP is unavailable (e.g.
 * non-Chromium browsers or a detached page).
 */
export async function silentScreenshot(page: Page): Promise<Buffer | undefined> {
  try {
    const client = await page.context().newCDPSession(page);
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    await client.detach();
    return Buffer.from(data, 'base64');
  } catch {
    // Fallback for non-Chromium or detached page
    return page.screenshot({ fullPage: false }).catch(() => undefined);
  }
}

export interface ToastCapture {
  /** 'success' | 'failed' based on toast content; 'none' if no toast detected. */
  status: 'success' | 'failed' | 'none';
  message: string;
  screenshot?: Buffer;
}

const TOAST_SELECTOR = [
  '#b-toaster-top-right .toast',  // Bootstrap-Vue (main portal)
  '.alert-danger',
  '.alert-success',
  '[role="alert"]',
].join(', ');

/**
 * Takes a screenshot that captures any visible toast/alert on the page.
 * Convenience wrapper — returns only the Buffer (use captureAndReadToast
 * when you also need the status).
 */
export async function captureWithToast(
  page: Page,
  toastWaitMs = 800,
): Promise<Buffer | undefined> {
  return (await captureAndReadToast(page, toastWaitMs)).screenshot;
}

/**
 * Waits for a toast/alert to appear, takes a silent screenshot, then reads
 * the toast content to determine success or failure.
 *
 * Detection priority:
 *  1. Bootstrap-Vue toasts  (#b-toaster-top-right) — header text "Error" / "Success"
 *     and outer class b-toast-danger / b-toast-success.
 *  2. Bootstrap alert classes — .alert-danger → failed, .alert-success → success.
 *  3. Generic [role="alert"] — text classified by keywords.
 *
 * If no toast appears within `toastWaitMs`, returns status 'none' with a
 * plain silent screenshot.
 */
export async function captureAndReadToast(
  page: Page,
  toastWaitMs = 800,
): Promise<ToastCapture> {
  try {
    const alreadyVisible = await page.locator(TOAST_SELECTOR).first().isVisible().catch(() => false);
    if (!alreadyVisible) {
      await page.waitForSelector(TOAST_SELECTOR, { state: 'visible', timeout: toastWaitMs });
    }
  } catch {
    // No toast appeared within the window
    return { status: 'none', message: '', screenshot: await silentScreenshot(page) };
  }

  const screenshot = await silentScreenshot(page);

  // ── Bootstrap-Vue toasts ─────────────────────────────────────────────────
  const bvToasts = page.locator('#b-toaster-top-right .toast');
  const bvCount = await bvToasts.count().catch(() => 0);
  for (let i = 0; i < bvCount; i++) {
    const toast = bvToasts.nth(i);
    const headerText = (await toast.locator('header.toast-header').innerText().catch(() => '')).trim();
    const bodyText   = (await toast.locator('.toast-body').innerText().catch(() => '')).trim();
    const outerCls   = (await toast.locator('..').getAttribute('class').catch(() => '')) ?? '';
    const toastCls   = (await toast.getAttribute('class').catch(() => '')) ?? '';
    const message    = bodyText || headerText;
    if (!message) continue;

    const isError   = /error/i.test(headerText) || /b-toast-danger|toast-danger|bg-danger/i.test(`${outerCls} ${toastCls}`);
    const isSuccess = /success/i.test(headerText) || /b-toast-success|toast-success|bg-success/i.test(`${outerCls} ${toastCls}`);

    if (isError)   return { status: 'failed',  message, screenshot };
    if (isSuccess) return { status: 'success', message, screenshot };

    const byText = classifyByText(message);
    if (byText) return { status: byText, message, screenshot };
  }

  // ── Bootstrap alert classes ──────────────────────────────────────────────
  const danger = page.locator('.alert-danger').filter({ visible: true }).first();
  if (await danger.isVisible().catch(() => false)) {
    const message = (await danger.innerText().catch(() => '')).trim();
    if (message) return { status: 'failed', message, screenshot };
  }

  const success = page.locator('.alert-success').filter({ visible: true }).first();
  if (await success.isVisible().catch(() => false)) {
    const message = (await success.innerText().catch(() => '')).trim();
    if (message) return { status: 'success', message, screenshot };
  }

  // ── Generic role="alert" ─────────────────────────────────────────────────
  const alerts = page.locator('[role="alert"]').filter({ visible: true });
  const alertCount = await alerts.count().catch(() => 0);
  for (let i = 0; i < alertCount; i++) {
    const message = (await alerts.nth(i).innerText().catch(() => '')).trim();
    if (!message) continue;
    const byText = classifyByText(message);
    if (byText) return { status: byText, message, screenshot };
  }

  return { status: 'none', message: '', screenshot };
}

function classifyByText(text: string): 'success' | 'failed' | null {
  if (/\b(error|failed|failure|invalid|unable|unsuccessful|wrong|exception)\b/i.test(text)) return 'failed';
  if (/\b(success|successful|completed|saved|uploaded|approved)\b/i.test(text)) return 'success';
  return null;
}
