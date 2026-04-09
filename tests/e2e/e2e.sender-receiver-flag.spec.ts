import { test, expect } from '../fixtures/outlook.fixture';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { makeToken, makeSubject } from '../../src/utils/testData';

// Receiver flags a received email
test('E2E: receiver can flag a received email', async ({ sender, receiver, receiverEmail }, testInfo) => {
  // Run only once (sender project) to avoid duplicate sends across projects
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');

  test.setTimeout(TIMEOUTS.TEST_E2E);

  const token = makeToken('FLAG');
  const subject = makeSubject(token);
  const body = `Flag test message for ${subject}`;

  // Sender: send an email
  await sender.gotoMail();
  await sender.expectAuthenticated();

  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

  // Receiver: open mail and find the message
  await receiver.gotoMail();
  await receiver.expectAuthenticated();

  await receiver.messages.waitForMessageInInbox(subject, receiver);
  await receiver.messages.openMessageBySubject(subject);

  // Ensure the reading pane / message actions are visible
  // Now find the "Flag / Unflag" action and click it.
  // Try stable role-based locators first, then fall back to visible text if needed.
  let flagAction = receiver.page.getByRole('button', { name: /flag \/ unflag/i }).first();

  if ((await flagAction.count().catch(() => 0)) === 0 || !(await flagAction.isVisible().catch(() => false))) {
    flagAction = receiver.page.getByRole('menuitem', { name: /flag \/ unflag/i }).first();
  }
  if ((await flagAction.count().catch(() => 0)) === 0 || !(await flagAction.isVisible().catch(() => false))) {
    flagAction = receiver.page.getByText(/flag \/ unflag/i).first();
  }

  await expect(flagAction, 'Expected Flag / Unflag action to be visible').toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  await flagAction.click();

  // Some Outlook variants keep the unflag control present but hidden until the message
  // row is visibly selected. Click the message row again (safe no-op) and poll for
  // the accessible unflag control to become visible.
  const messageRow = receiver.page.locator('[role="option"], [role="row"]').filter({ hasText: subject }).first();
  if ((await messageRow.count().catch(() => 0)) > 0) {
    await messageRow.click().catch(() => {});
  }

  // Re-query the message row and scope the assertion to that row. Some Outlook
  // variants render the unflag control inside the selected row rather than
  // globally, so assert within the row first for a reliable check. Do NOT
  // fall back to a global page-level unflag control — scope to the message row.
  const rowUnflag = messageRow.getByLabel('Unflag this message').first();
  const altFlagButton = messageRow.getByRole('button').filter({ hasText: /flag/i }).first();

  await expect
    .poll(
      async () => {
        // 1) visible unflag control inside row
        if (await rowUnflag.isVisible().catch(() => false)) return true;

        // 2) a flag-related button inside the row that indicates a toggled/pressed state
        if ((await altFlagButton.count().catch(() => 0)) > 0) {
          const pressed = await altFlagButton.getAttribute('aria-pressed').catch(() => null);
          const checked = await altFlagButton.getAttribute('aria-checked').catch(() => null);
          const title = (await altFlagButton.getAttribute('title').catch(() => '')) ?? '';
          if (pressed === 'true' || checked === 'true' || /unflag/i.test(title)) return true;
        }

        // 3) any element inside the row with an aria-label mentioning Unflag/Flagged
        const anyUnflag = messageRow.locator('[aria-label*="Unflag" i], [aria-label*="Flagged" i]').first();
        if (await anyUnflag.isVisible().catch(() => false)) return true;

        return false;
      },
      { timeout: TIMEOUTS.UI_LONG }
    )
    .toBe(true);
});
