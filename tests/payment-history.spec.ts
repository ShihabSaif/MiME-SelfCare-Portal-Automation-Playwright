import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { PaymentHistoryPage } from '../pages/payment-history.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';

test('open Payment History section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('Payment History');
  const loginPage = new MyPortalLoginPage(page);
  const paymentHistoryPage = new PaymentHistoryPage(page);
  const username = process.env.MYPORTAL_USERNAME;
  const password = process.env.MYPORTAL_PASSWORD;
  let overall: 'passed' | 'failed' | 'incomplete' = 'incomplete';

  if (!username || !password) {
    throw new Error('Missing MYPORTAL_USERNAME or MYPORTAL_PASSWORD in environment variables.');
  }

  try {
    await page.goto(process.env.MYPORTAL_URL || 'https://mctest-myportal.mimebd.com/', {
      waitUntil: 'domcontentloaded',
    });
    // await report.addStep(page, 'Payment History landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);

    await paymentHistoryPage.openPaymentHistory();
    await report.addStepWithBuffer(
      (await paymentHistoryPage.screenshotLoadedPage()) ?? null,
      page,
      'Payment History page loaded',
      'success',
    );

    const saveDir = 'test-results/downloads/payment-history';
    const { screenshot: receiptShot, savedPath } = await paymentHistoryPage.clickReceiptAndSave(saveDir);
    await report.addStepWithBuffer(
      receiptShot ?? null,
      page,
      `Receipt downloaded — saved to ${savedPath}`,
      'success',
    );

    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    logFlowFailure('Payment History', error);
    await report.addStep(page, 'Payment History failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
  }
});
