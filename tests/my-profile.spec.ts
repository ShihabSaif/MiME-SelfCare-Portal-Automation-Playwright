import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { MyProfilePage } from '../pages/my-profile.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';
import type { StepStatus } from '../utils/html-step-report';

test('open My Profile section', async ({ page }) => {
  test.setTimeout(180000);

  const report = new HtmlStepReport('My Profile');
  const loginPage = new MyPortalLoginPage(page);
  const myProfilePage = new MyProfilePage(page);
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
    await report.addStep(page, 'My Profile landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await myProfilePage.openMyProfile();
    await report.addStep(page, 'My Profile tab clicked');
    await myProfilePage.expectMyProfileVisible();
    // await report.addStep(page, 'My Profile section visible', 'success');

    await myProfilePage.openDetails();
    await myProfilePage.expectDetailsVisible();
    await report.addStep(page, 'Details option clicked and verified', 'success');

    await myProfilePage.openChangePassword();
    await myProfilePage.expectChangePasswordVisible();
    await report.addStep(page, 'Change Password option clicked and verified', 'success');

    const changePasswordValue = process.env.CHANGE_PASSWORD_VALUE || 'Abcd1234#';

    await myProfilePage.expectChangePasswordFormReady();

    await myProfilePage.fillAllChangePasswordFields(changePasswordValue);
    await report.addStepWithBuffer(
      (await myProfilePage.screenshotChangePasswordForm()) ?? null,
      page,
      'Change Password: all fields filled (masked)',
      'success',
    );

    await myProfilePage.clickAllShowPasswordToggles();
    await report.addStepWithBuffer(
      (await myProfilePage.screenshotChangePasswordForm()) ?? null,
      page,
      'Change Password: all fields visible after show-password toggles',
      'success',
    );

    await myProfilePage.clickChangePasswordReset();
    await myProfilePage.expectChangePasswordFieldsEmpty();
    await report.addStepWithBuffer(
      (await myProfilePage.screenshotChangePasswordForm()) ?? null,
      page,
      'Change Password: fields cleared after Reset',
      'success',
    );

    await myProfilePage.fillAllChangePasswordFields(changePasswordValue);
    await myProfilePage.expectAllChangePasswordFieldsFilled(changePasswordValue);
    await report.addStepWithBuffer(
      (await myProfilePage.screenshotChangePasswordForm()) ?? null,
      page,
      'Change Password: all three fields re-filled (masked) before Submit',
      'success',
    );

    await myProfilePage.clickChangePasswordSubmit();
    const submitFeedback = await myProfilePage.waitForChangePasswordSubmitFeedback();
    await report.addStepWithBuffer(
      submitFeedback.screenshot ?? null,
      page,
      `Change Password: Submit — ${submitFeedback.message || submitFeedback.status}`,
      toastStepStatus(submitFeedback.status),
    );
    if (submitFeedback.status === 'failed') {
      logFlowFailure(
        'My Profile',
        new Error(submitFeedback.message || 'Change password submit failed'),
      );
      overall = 'failed';
    }

    if (overall !== 'failed') overall = 'passed';
  } catch (error) {
    overall = 'failed';
    logFlowFailure('My Profile', error);
    await report.addStep(page, 'My Profile failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
  }
});

function toastStepStatus(status: 'success' | 'failed' | 'none'): StepStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'neutral';
}
