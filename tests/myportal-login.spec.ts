import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { HtmlStepReport } from '../utils/html-step-report';

const USERNAME = process.env.MYPORTAL_USERNAME;
const PASSWORD = process.env.MYPORTAL_PASSWORD;

test('standalone login to MiME Self-Care', async ({ page }) => {
  test.setTimeout(60000);

  if (!USERNAME || !PASSWORD) {
    throw new Error('Missing MYPORTAL_USERNAME or MYPORTAL_PASSWORD in environment variables.');
  }

  const report = new HtmlStepReport('Login');
  report.reset();
  const loginPage = new MyPortalLoginPage(page);
  await loginPage.goto();
  await report.addStep(page, 'Login landing page');
  await loginPage.fillCredentials(USERNAME, PASSWORD);
  const credentialsSubmittedShot = await loginPage.captureFilledCredentialsForm();
  await report.addStepWithBuffer(
    credentialsSubmittedShot ?? null,
    page,
    'Credentials submitted',
    'success',
  );
  await loginPage.submitCredentials();
  await loginPage.waitForDashboardAfterLogin();
  await report.addStep(page, 'Dashboard after login');
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
  report.finalize('passed');
});
