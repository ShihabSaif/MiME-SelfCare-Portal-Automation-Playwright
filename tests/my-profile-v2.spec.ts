import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { MyProfileV2Page } from '../pages/my-profile-v2.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';

test('navbar profile menu — My Profile and Change Password', async ({ page }) => {
  test.setTimeout(120000);

  const report = new HtmlStepReport('My Profile V2');
  const loginPage = new MyPortalLoginPage(page);
  const profileV2 = new MyProfileV2Page(page);
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
    // await report.addStep(page, 'My Profile V2 landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await profileV2.openUserDropdown();
    await profileV2.expectUserDropdownWithThreeOptions();
    await report.addStepWithBuffer(
      (await profileV2.screenshot()) ?? null,
      page,
      'Navbar avatar menu open (3 options)',
      'success',
    );

    await profileV2.clickDropdownMyProfile();
    await profileV2.expectProfileDetailsPage();
    await report.addStepWithBuffer(
      (await profileV2.screenshot()) ?? null,
      page,
      'My Profile — profile details page',
      'success',
    );

    await profileV2.openUserDropdown();
    await profileV2.expectUserDropdownWithThreeOptions();
    await profileV2.clickDropdownChangePassword();
    await profileV2.expectChangePasswordPage();
    await report.addStepWithBuffer(
      (await profileV2.screenshot()) ?? null,
      page,
      'Change Password page (navbar menu)',
      'success',
    );

    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    logFlowFailure('My Profile V2', error);
    await report.addStep(page, 'My Profile V2 failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
  }
});
