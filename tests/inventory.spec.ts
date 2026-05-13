import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { InventoryPage } from '../pages/inventory.page';
import { HtmlStepReport } from '../utils/html-step-report';

test('open Inventory section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('test-results', 'Inventory');
  const loginPage = new MyPortalLoginPage(page);
  const inventoryPage = new InventoryPage(page);
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
    await report.addStep(page, 'Inventory landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await inventoryPage.openInventory();
    await report.addStep(page, 'Inventory tab clicked');
    await inventoryPage.expectInventoryVisible();
    await report.addStep(page, 'Inventory section visible', 'success');
    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    await report.addStep(page, 'Inventory failed state', 'failed').catch(() => undefined);
    throw error;
  } finally {
    report.finalize(overall);
  }
});
