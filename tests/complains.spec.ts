import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { ComplainsPage } from '../pages/complains.page';
import { HtmlStepReport } from '../utils/html-step-report';

test('open Complains section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('test-results', 'Complains');
  const loginPage = new MyPortalLoginPage(page);
  const complainsPage = new ComplainsPage(page);
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
    await report.addStep(page, 'Complains landing page');
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await complainsPage.openComplains();
    await report.addStep(page, 'Complains tab clicked');
    await complainsPage.expectComplainsVisible();
    await report.addStep(page, 'Complains section visible', 'success');

    await complainsPage.openCreateTicketModal();
    await report.addStep(page, 'Create Ticket modal opened first time', 'success');

    await complainsPage.closeTicketModalWithCross();
    await complainsPage.expectTicketModalClosed();
    await report.addStep(page, 'Create Ticket modal closed by cross icon', 'success');

    await complainsPage.openCreateTicketModal();
    await report.addStep(page, 'Create Ticket modal opened second time', 'success');

    try {
      await complainsPage.selectFirstServiceTypeOption();
      await report.addStep(page, 'Service Type selected (before Clear test)', 'success');

      await complainsPage.selectFirstProblemOption();
      await report.addStep(page, 'Problem selected (before Clear test)', 'success');

      await complainsPage.selectFirstServiceLineOption();
      await report.addStep(page, 'Service Line selected (before Clear test)', 'success');

      await complainsPage.clickClearTicketModal();
      await complainsPage.expectTicketModalFieldsCleared();
      await report.addStep(page, 'Clear button cleared all dropdown selections', 'success');

      await complainsPage.selectFirstServiceTypeOption();
      await report.addStep(page, 'First Service Type option selected for Create', 'success');

      await complainsPage.selectFirstProblemOption();
      await report.addStep(page, 'First Problem option selected for Create', 'success');

      await complainsPage.selectFirstServiceLineOption();
      await report.addStep(page, 'First Service Line option selected for Create', 'success');

      await complainsPage.clickCreateTicket();
      await complainsPage.expectTicketCreatedSuccessfully();
      await report.addStep(page, 'Ticket created success popup verified (screenshot after loader gone)', 'success');
      await complainsPage.expectBackToComplainsList();
      await report.addStep(page, 'Ticket created and back to Complains list', 'success');
    } catch (ticketError) {
      await report.addStep(page, 'Ticket creation failed', 'failed').catch(() => undefined);
      throw ticketError;
    }

    overall = 'passed';
  } catch (error) {
    overall = 'failed';
    await report.addStep(page, 'Complains failed state', 'failed').catch(() => undefined);
    throw error;
  } finally {
    report.finalize(overall);
    await page.pause();
  }
});
