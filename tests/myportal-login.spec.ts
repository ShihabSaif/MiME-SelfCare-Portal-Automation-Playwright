import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { HtmlStepReport } from '../utils/html-step-report';

const USERNAME = process.env.MYPORTAL_USERNAME;
const PASSWORD = process.env.MYPORTAL_PASSWORD;

test('standalone login to MiME Self-Care', async ({ page }) => {
  if (!USERNAME || !PASSWORD) {
    throw new Error('Missing MYPORTAL_USERNAME or MYPORTAL_PASSWORD in environment variables.');
  }

  const report = new HtmlStepReport('Login');
  report.reset();
  const loginPage = new MyPortalLoginPage(page);
  await loginPage.goto();
  await report.addStep(page, 'Login landing page');
  await loginPage.login(USERNAME, PASSWORD);
  await report.addStep(page, 'Credentials submitted');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1200);
  await report.addStep(page, 'Dashboard after login');
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
  report.finalize('passed');
});
