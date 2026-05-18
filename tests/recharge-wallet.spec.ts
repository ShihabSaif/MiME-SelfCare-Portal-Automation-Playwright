import fs from 'node:fs';
import { test } from '@playwright/test';
import { RechargeWalletPage } from '../pages/recharge-wallet.page';
import { HtmlStepReport } from '../utils/html-step-report';
import { captureAndReadToast, silentScreenshot } from '../utils/screenshot';

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

  try {
    await page.goto(process.env.MYPORTAL_URL || 'https://mctest-myportal.mimebd.com/', {
      waitUntil: 'domcontentloaded',
    });
    await report.addStepWithBuffer(await silentScreenshot(page) ?? null, page, 'Landing page');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await report.addStepWithBuffer(await silentScreenshot(page) ?? null, page, 'After login');

    const rechargeToast = await rechargeWalletPage.openWalletsAndClickRechargeWallet();
    await report.addStepWithBuffer(rechargeToast.screenshot ?? null, page, 'Recharge wallet page', toastBadge(rechargeToast.status, 'success'));
    if (rechargeToast.status === 'failed') throw new Error(`Recharge wallet page error: ${rechargeToast.message}`);

    const { gatewayPage, toast: amountToast } = await rechargeWalletPage.enterAmountAndPayWithBkash('12');
    pausePage = gatewayPage;
    await report.addStepWithBuffer(amountToast.screenshot ?? null, gatewayPage, `Amount given and bKash selected — ${amountToast.message || amountToast.status}`, toastBadge(amountToast.status, 'success'));
    if (amountToast.status === 'failed') throw new Error(`Pay with bKash error: ${amountToast.message}`);

    const bkashNumberToast = await rechargeWalletPage.enterBkashNumberAndSubmit(gatewayPage, bkashNumber);
    await report.addStepWithBuffer(bkashNumberToast.screenshot ?? null, gatewayPage, `bKash number given — ${bkashNumberToast.message || bkashNumberToast.status}`, toastBadge(bkashNumberToast.status, 'success'));
    if (bkashNumberToast.status === 'failed') throw new Error(`bKash number submit error: ${bkashNumberToast.message}`);

    await gatewayPage.waitForLoadState('domcontentloaded').catch(() => undefined);
    await gatewayPage.waitForTimeout(500);
    const confirmToast = await captureAndReadToast(gatewayPage);
    await report.addStepWithBuffer(confirmToast.screenshot ?? null, gatewayPage, 'Confirmation given', toastBadge(confirmToast.status, 'success'));
    if (confirmToast.status === 'failed') throw new Error(`Confirmation error: ${confirmToast.message}`);

    const otpToast = await rechargeWalletPage.enterVerificationCodeAndConfirm(gatewayPage, bkashVerificationCode);
    await report.addStepWithBuffer(otpToast.screenshot ?? null, gatewayPage, `OTP given — ${otpToast.message || otpToast.status}`, toastBadge(otpToast.status, 'success'));
    if (otpToast.status === 'failed') throw new Error(`OTP error: ${otpToast.message}`);

    const pinToast = await rechargeWalletPage.enterPinAndConfirm(gatewayPage, bkashPin);
    await report.addStepWithBuffer(pinToast.screenshot ?? null, gatewayPage, `PIN given — ${pinToast.message || pinToast.status}`, toastBadge(pinToast.status, 'success'));
    if (pinToast.status === 'failed') throw new Error(`PIN error: ${pinToast.message}`);

    const paymentDecision = await rechargeWalletPage.waitForDashboardAndGetPaymentStatus(gatewayPage);
    pausePage = paymentDecision.page;

    const finalStatusLabel =
      paymentDecision.status === 'success' ? 'Final: payment successful' :
      paymentDecision.status === 'failed'  ? 'Final: payment failed'     :
                                             'Final: unknown payment status';
    const finalBadge = paymentDecision.status === 'success' ? 'success' : paymentDecision.status === 'failed' ? 'failed' : 'neutral';
    const finalToast = await captureAndReadToast(paymentDecision.page);
    await report.addStepWithBuffer(finalToast.screenshot ?? null, paymentDecision.page, finalStatusLabel, finalBadge);

    if (paymentDecision.status === 'failed') {
      const failedScreenshotPath = `test-results/payment-status-failed-${Date.now()}.png`;
      const buf = finalToast.screenshot ?? await silentScreenshot(paymentDecision.page);
      if (buf) fs.writeFileSync(failedScreenshotPath, buf);
      await testInfo.attach('payment-status-failed', { path: failedScreenshotPath, contentType: 'image/png' });
      overall = 'failed';
      throw new Error('Payment status is failed/invalid after returning to dashboard.');
    }

    if (paymentDecision.status === 'unknown') {
      overall = 'failed';
      throw new Error('Could not determine payment status after returning to dashboard.');
    }

    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    throw error;
  } finally {
    report.finalize(overall);
    if (process.env.PAUSE_AFTER_RECHARGE === '1') {
      await pausePage.pause();
    }
  }
});

/**
 * Maps a ToastCapture status to an HTML report badge.
 * `defaultForNone` controls what badge to use when no toast was detected:
 *  - 'success' for navigation/action steps where no toast = everything is fine
 *  - 'neutral' for outcome steps where we're explicitly waiting for a result
 */
function toastBadge(
  status: 'success' | 'failed' | 'none',
  defaultForNone: 'success' | 'neutral' = 'neutral',
): 'success' | 'failed' | 'neutral' {
  if (status === 'success') return 'success';
  if (status === 'failed')  return 'failed';
  return defaultForNone;
}
