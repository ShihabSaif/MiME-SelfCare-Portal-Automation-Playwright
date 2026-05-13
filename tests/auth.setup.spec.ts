import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';

const USERNAME = process.env.MYPORTAL_USERNAME;
const PASSWORD = process.env.MYPORTAL_PASSWORD;

test('authenticate and store login state', async ({ page }) => {
  if (!USERNAME || !PASSWORD) {
    throw new Error('Missing MYPORTAL_USERNAME or MYPORTAL_PASSWORD in environment variables.');
  }

  const loginPage = new MyPortalLoginPage(page);
  await loginPage.goto();
  await loginPage.login(USERNAME, PASSWORD);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1200);

  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
