import { test, expect } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';
import { TIMEOUTS } from '../../src/constants/timeouts';

test('E2E: receiver marks message unread then read', async ({ sender, receiver, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const token = makeToken('MRU');
  const subject = makeSubject(token);
  const body = `Mark read/unread scenario :: ${token}`;

  // Outlook encodes unread state as an "Unread" prefix at the start of the row aria-label.
  // We must not match any random "unread" substring because the subject/body can contain
  // phrases like "read/unread scenario", which would create false positives.
  const unreadPrefix = /^\s*Unread\b/i;

  const getMessageRow = () =>
    receiver.page
      .locator('[role="option"], [role="row"]')
      .filter({ hasText: token })
      .first();

  // 1) Sender sends the message.
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

  // 2) Receiver waits for the message and opens it to confirm receipt.
  await receiver.gotoMail();
  await receiver.expectAuthenticated();
  await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
  await receiver.messages.openMessageByText(token);
  await receiver.messages.expectSubjectInReadingPane(subject);

  // 3) Establish a known READ state before toggling.
  // Opening a message does not reliably mark it as read in all Outlook variants,
  // so make the initial state explicit.
  await receiver.messages.ensureMessageIsRead(token);

  let messageRow = getMessageRow();

  await expect(messageRow, 'Expected message row to be visible after forcing READ state').toBeVisible({
    timeout: TIMEOUTS.UI_LONG,
  });

  await expect(messageRow, 'Expected message row to be in READ state before marking unread').not.toHaveAttribute(
    'aria-label',
    unreadPrefix,
    { timeout: TIMEOUTS.UI_LONG }
  );

  // 4) Mark as unread via the message row context menu.
  // This is more reliable than the reading-pane toggle because the action is explicit.
  await receiver.messages.markAsUnreadViaContextMenu(token);

  // Re-resolve the row after the state change to avoid relying on stale DOM assumptions.
  messageRow = getMessageRow();

  await expect(messageRow, 'Expected message row to show Unread indicator').toHaveAttribute(
    'aria-label',
    unreadPrefix,
    { timeout: TIMEOUTS.UI_LONG }
  );

  // 5) Mark as read via the message row context menu.
  await receiver.messages.markAsReadViaContextMenu(token);

  // Re-resolve again after the second state change.
  messageRow = getMessageRow();

  await expect(messageRow, 'Expected message row to no longer show Unread indicator').not.toHaveAttribute(
    'aria-label',
    unreadPrefix,
    { timeout: TIMEOUTS.UI_LONG }
  );
});