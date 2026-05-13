import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { PaymentHistoryPage } from '../pages/payment-history.page';
import { HtmlStepReport } from '../utils/html-step-report';

test('open Payment History section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('test-results', 'Payment History');
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
    await report.addStep(page, 'Payment History landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await paymentHistoryPage.openPaymentHistory();
    await report.addStep(page, 'Payment History tab clicked');
    await paymentHistoryPage.expectPaymentHistoryVisible();
    await report.addStep(page, 'Payment History section visible', 'success');
    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    await report.addStep(page, 'Payment History failed state', 'failed').catch(() => undefined);
    throw error;
  } finally {
    report.finalize(overall);
  }
});
