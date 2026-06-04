import { test } from '@playwright/test';
import { MyPortalLoginPage } from '../pages/myportal-login.page';
import { ComplainsPage } from '../pages/complains.page';
import { logFlowFailure } from '../utils/flow-test';
import { HtmlStepReport } from '../utils/html-step-report';
import { captureAndReadToast } from '../utils/screenshot';

test('open Complains section', async ({ page }) => {
  test.setTimeout(90000);

  const report = new HtmlStepReport('Complains');
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
    await loginPage.loginIfNeeded(username, password);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const complainsTabOutcome = await complainsPage.openComplains();
    await report.recordToastFeedback(page, 'Complains tab clicked', complainsTabOutcome, {
      defaultForNone: 'success',
      includeMessageInTitle: true,
    });

    if (complainsTabOutcome.status !== 'failed') {
      await complainsPage.expectComplainsVisible();
    }

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
      const ticketFeedback = await complainsPage.expectTicketCreatedSuccessfully();

      const ticketStepTitle =
        ticketFeedback.status === 'failed'
          ? 'Ticket creation failed'
          : 'Ticket created success popup verified';
      await report.recordToastFeedback(page, ticketStepTitle, ticketFeedback, {
        defaultForNone: 'neutral',
        includeMessageInTitle: true,
      });

      if (ticketFeedback.status === 'failed') {
        overall = 'failed';
      } else {
        await complainsPage.expectBackToComplainsList();
        await report.addStep(page, 'Ticket created and back to Complains list', 'success');
      }
    } catch (ticketError) {
      const toast = await captureAndReadToast(page, 1500);
      if (toast.status !== 'none') {
        await report.recordToastFeedback(page, 'Ticket creation failed', toast, {
          defaultForNone: 'failed',
          includeMessageInTitle: true,
        });
      } else {
        await report.addStep(page, 'Ticket creation failed', 'failed');
      }
      logFlowFailure('Complains', ticketError);
      overall = 'failed';
    }

    if (report.toastFailureRecorded || overall === 'failed') overall = 'failed';
    else overall = 'passed';
  } catch (error) {
    overall = 'failed';
    logFlowFailure('Complains', error);
    await report.addStep(page, 'Complains failed state', 'failed').catch(() => undefined);
  } finally {
    report.finalize(overall);
    if (process.env.PAUSE_AFTER_COMPLAINS === '1') {
      await page.pause();
    }
  }
});
