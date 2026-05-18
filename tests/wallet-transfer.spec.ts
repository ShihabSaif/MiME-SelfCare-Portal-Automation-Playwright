import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { WalletTransferPage } from '../pages/wallet-transfer.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';

test('open Wallet Transfer section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('test-results', 'Wallet Transfer');
  const loginPage = new MyPortalLoginPage(page);
  const walletTransferPage = new WalletTransferPage(page);
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
    await report.addStep(page, 'Wallet Transfer landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await walletTransferPage.openWalletTransfer();
    await report.addStep(page, 'Wallet Transfer tab clicked');
    await walletTransferPage.expectWalletTransferVisible();
    await report.addStep(page, 'Wallet Transfer section visible', 'success');
    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    logFlowFailure('Wallet Transfer', error);
    await report.addStep(page, 'Wallet Transfer failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
  }
});
