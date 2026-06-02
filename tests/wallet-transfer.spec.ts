import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { WalletTransferPage } from '../pages/wallet-transfer.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';

test('open Wallet Transfer section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('Wallet Transfer');
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
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);

    await walletTransferPage.openWalletTransfer();
    await walletTransferPage.waitForWalletTransferPageLoaded();
    await report.addStepWithBuffer(
      (await walletTransferPage.screenshot()) ?? null,
      page,
      'Wallet Transfer page loaded',
      'success',
    );
    await walletTransferPage.pauseAfterScreenshot();

    overall = 'passed';
    return;
  } catch (error) {
    overall = 'failed';
    logFlowFailure('Wallet Transfer', error);
    await report.addStep(page, 'Wallet Transfer failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
  }
});
