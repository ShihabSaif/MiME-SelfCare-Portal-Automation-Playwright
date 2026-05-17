import fs from 'node:fs';
import { test } from '@playwright/test';
import { RechargeWalletPage } from '../pages/recharge-wallet.page';
import { HtmlStepReport } from '../utils/html-step-report';
import { silentScreenshot } from '../utils/screenshot';

test('click recharge wallet using stored login token', async ({ page }, testInfo) => {
  test.setTimeout(120000);

  const bkashNumber = process.env.BKASH_NUMBER;
  const bkashVerificationCode = process.env.BKASH_VERIFICATION_CODE;
  const bkashPin = process.env.BKASH_PIN;

  if (!bkashNumber || !bkashVerificationCode || !bkashPin) {
    throw new Error(
      'Missing one or more required env vars: BKASH_NUMBER, BKASH_VERIFICATION_CODE, BKASH_PIN.',
    );
  }

  const report = new HtmlStepReport('test-results', 'Recharge');
  const rechargeWalletPage = new RechargeWalletPage(page);
  let pausePage = page;
  let overall: 'passed' | 'failed' | 'incomplete' = 'incomplete';
  let finalStepRecorded = false;

  try {
    await page.goto(process.env.MYPORTAL_URL || 'https://mctest-myportal.mimebd.com/', {
      waitUntil: 'domcontentloaded',
    });
    await report.addStep(page, 'Landing page');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await report.addStep(page, 'After login');

    await rechargeWalletPage.openWalletsAndClickRechargeWallet();
    await report.addStep(page, 'Recharge wallet page');

    const gatewayPage = await rechargeWalletPage.enterAmountAndPayWithBkash('12');
    pausePage = gatewayPage;
    await report.addStep(gatewayPage, 'Amount given and bKash selected');

    await rechargeWalletPage.enterBkashNumberAndSubmit(gatewayPage, bkashNumber);
    await report.addStep(gatewayPage, 'bKash number given');

    await gatewayPage.waitForLoadState('domcontentloaded').catch(() => undefined);
    await gatewayPage.waitForTimeout(500);
    await report.addStep(gatewayPage, 'Confirmation given');

    await rechargeWalletPage.enterVerificationCodeAndConfirm(gatewayPage, bkashVerificationCode);
    await report.addStep(gatewayPage, 'OTP given');

    await rechargeWalletPage.enterPinAndConfirm(gatewayPage, bkashPin);

    const paymentDecision = await rechargeWalletPage.waitForDashboardAndGetPaymentStatus(gatewayPage);
    pausePage = paymentDecision.page;

    const finalStatusLabel =
      paymentDecision.status === 'success'
        ? 'Final: success page'
        : paymentDecision.status === 'failed'
          ? 'Final: failed page'
          : 'Final: unknown payment status';
    const finalBadge = paymentDecision.status === 'success' ? 'success' : paymentDecision.status === 'failed' ? 'failed' : 'neutral';
    await report.addStep(paymentDecision.page, finalStatusLabel, finalBadge);
    finalStepRecorded = true;

    if (paymentDecision.status === 'failed') {
      const failedScreenshotPath = `test-results/payment-status-failed-${Date.now()}.png`;
      const buf = await silentScreenshot(paymentDecision.page);
      if (buf) fs.writeFileSync(failedScreenshotPath, buf);
      await testInfo.attach('payment-status-failed', {
        path: failedScreenshotPath,
        contentType: 'image/png',
      });
      overall = 'failed';
      throw new Error('Payment status is failed/invalid after returning to dashboard.');
    }

    if (paymentDecision.status === 'unknown') {
      overall = 'failed';
      throw new Error('Could not determine payment status after returning to dashboard.');
    }

    overall = 'passed';
  } catch (error) {
    if (!finalStepRecorded) {
      overall = 'failed';
      try {
        await report.addStep(pausePage, 'Failure — state when error occurred', 'failed');
      } catch {
        /* ignore */
      }
    } else if (overall === 'incomplete') {
      overall = 'failed';
    }
    throw error;
  } finally {
    report.finalize(overall);
    if (process.env.PAUSE_AFTER_RECHARGE === '1') {
      await pausePage.pause();
    }
  }
});
