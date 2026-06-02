import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { ServicesPage } from '../pages/services.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';
import { silentScreenshot } from '../utils/screenshot';

test('navigate to Services section from dashboard', async ({ page }) => {
  test.setTimeout(120000);

  const report = new HtmlStepReport('Service');
  const loginPage = new MyPortalLoginPage(page);
  const servicesPage = new ServicesPage(page);
  let overall: 'passed' | 'failed' | 'incomplete' = 'incomplete';
  const username = process.env.MYPORTAL_USERNAME;
  const password = process.env.MYPORTAL_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing MYPORTAL_USERNAME or MYPORTAL_PASSWORD in environment variables.');
  }

  try {
    await page.goto(process.env.MYPORTAL_URL || 'https://mctest-myportal.mimebd.com/', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await report.addStep(page, 'Services test landing page');

    // await loginPage.loginIfNeeded(username, password);
    // await page.waitForLoadState('networkidle').catch(() => undefined);
    // await report.addStep(page, 'Services test after login check');

    // await servicesPage.openServices();
    // await report.addStep(page, 'Services tab clicked');

    // await servicesPage.expectServicesVisible();
    // await report.addStep(page, 'Services section visible', 'success');

    await servicesPage.openMimeInternetTab();
    await report.addStep(page, 'MiME Internet tab active', 'success');

    await servicesPage.clickResendPasswordFirstRow();
    const confirmResend1 = await servicesPage.expectConfirmResendModalVisible();
    await report.addStep(page, 'Confirm Resend modal open (first time)', 'success');
    await servicesPage.closeModalWithHeaderCross(confirmResend1);
    await report.addStep(page, 'Confirm Resend modal closed via cross', 'success');

    await servicesPage.clickResendPasswordFirstRow();
    const confirmResend2 = await servicesPage.expectConfirmResendModalVisible();
    await report.addStep(page, 'Confirm Resend modal open (second time)', 'success');
    await servicesPage.clickConfirmResendNo(confirmResend2);
    await report.addStep(page, 'Confirm Resend modal closed via No', 'success');

    await servicesPage.clickResendPasswordFirstRow();
    const confirmResend3 = await servicesPage.expectConfirmResendModalVisible();
    await report.addStep(page, 'Confirm Resend modal open (third time)', 'success');
    await servicesPage.clickConfirmResendYes(confirmResend3);
    await servicesPage.waitForPasswordResendLoaderGone();
    await report.addStep(page, 'Password resent: loader cleared', 'success');

    await servicesPage.clickFirstRowInfoButton();
    const infoModal = await servicesPage.expectTopModalVisible();
    await report.addStep(page, 'Info modal open', 'success');
    await servicesPage.closeModalWithHeaderCross(infoModal);

    await servicesPage.clickFirstRowGraphButton();
    const graphModal = await servicesPage.expectGraphBandwidthModalVisible();
    await report.addStep(page, 'Graph bandwidth modal open', 'success');

    await servicesPage.clickDownloadInGraphModal(graphModal);
    await report.addStep(page, 'Graph modal after Download clicked', 'success');

    await servicesPage.clickUploadInGraphModal(graphModal);
    await report.addStep(page, 'Graph modal after Upload clicked', 'success');

    await servicesPage.closeModalWithHeaderCross(graphModal);
    await report.addStep(page, 'Graph bandwidth modal closed', 'success');

    const serviceTabs = ['MiME Bundle', 'MiME TV', 'Kothon', 'MiME Talk'];
    for (const serviceTab of serviceTabs) {
      await servicesPage.openCategory(serviceTab);
      await servicesPage.expectCategoryActivated(serviceTab);
      await report.addStep(page, `${serviceTab} tab clicked and verified`, 'success');

      if (serviceTab === 'Kothon') {
        await servicesPage.clickKothonBulkOnboard();
        const bulkOnboard1 = await servicesPage.expectBulkOnboardModalVisible();
        await report.addStep(page, 'Kothon: Bulk Onboard modal open (first time)', 'success');

        await servicesPage.closeModalWithHeaderCross(bulkOnboard1);
        await report.addStep(page, 'Kothon: Bulk Onboard modal closed via cross', 'success');

        await servicesPage.clickKothonBulkOnboard();
        const bulkOnboard2 = await servicesPage.expectBulkOnboardModalVisible();
        await report.addStep(page, 'Kothon: Bulk Onboard modal open (second time)', 'success');
        await report.addStep(page, 'Kothon: Download Sample ready to trigger save', 'success');

        const saveDir = path.join('test-results', 'downloads', 'kothon');
        const savedFile = await servicesPage.clickDownloadSampleAndSave(bulkOnboard2, saveDir);
        await report.addStep(page, `Kothon: sample saved to ${savedFile}`, 'success');

        await servicesPage.closeModalWithHeaderCross(bulkOnboard2);
        await report.addStep(page, 'Kothon: Bulk Onboard modal closed after download', 'success');

        const dupName = 'BulkOnboarding_Sample (1).xlsx';
        const dupPath = path.join(saveDir, dupName);
        fs.copyFileSync(savedFile, dupPath);

        await servicesPage.clickKothonBulkOnboard();
        const bulkOnboard3 = await servicesPage.expectBulkOnboardModalVisible();
        await report.addStep(page, 'Kothon: Bulk Onboard modal open (third time)', 'success');

        const browseScreenshot = await servicesPage.chooseBulkOnboardExcelViaBrowse(bulkOnboard3, dupPath);
        await report.addStepWithBuffer(
          browseScreenshot ?? null,
          page,
          `Kothon: Browse — selected ${dupName}`,
          'success',
        );

        const uploadClickScreenshot = await servicesPage.clickBulkOnboardModalUpload(bulkOnboard3);
        await report.addStepWithBuffer(
          uploadClickScreenshot ?? null,
          page,
          'Kothon: Bulk Onboard Upload button clicked',
          'success',
        );

        const uploadFeedback = await servicesPage.waitForBulkOnboardUploadFeedback(bulkOnboard3);
        await report.addStepWithBuffer(
          uploadFeedback.screenshot ?? null,
          page,
          `Kothon: Bulk Onboard Upload — ${uploadFeedback.message || uploadFeedback.status}`,
          uploadFeedback.status,
        );
        if (uploadFeedback.status === 'failed') {
          if (await bulkOnboard3.isVisible().catch(() => false)) {
            await servicesPage.closeModalWithHeaderCross(bulkOnboard3);
            await page.waitForTimeout(400);
            const closedAfterErrorScreenshot = await silentScreenshot(page);
            await report.addStepWithBuffer(
              closedAfterErrorScreenshot ?? null,
              page,
              'Kothon: Bulk Onboard modal closed after upload error',
              'success',
            );
          }
          logFlowFailure('Service', new Error(`Bulk Onboard upload: ${uploadFeedback.message}`));
          overall = 'failed';
        } else if (await bulkOnboard3.isVisible().catch(() => false)) {
          await servicesPage.closeModalWithHeaderCross(bulkOnboard3);
          await report.addStep(page, 'Kothon: Bulk Onboard modal closed after upload', 'success');
        }
      }
    }

    if (overall !== 'failed') overall = 'passed';
  } catch (error) {
    overall = 'failed';
    logFlowFailure('Service', error);
    await report.addStep(page, 'Services section failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
  }
});
