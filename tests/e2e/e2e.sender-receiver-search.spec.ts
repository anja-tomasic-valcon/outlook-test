import { test, expect } from '../fixtures/outlook.fixture';
import { TIMEOUTS, mutableIntervals } from '../../src/constants/timeouts';
import { OutlookPage } from '../../src/pages/outlookPage';
import { makeToken, makeSubject } from '../../src/utils/testData';

async function sendMailAndWaitInReceiverInbox(
  sender: OutlookPage,
  receiver: OutlookPage,
  receiverEmail: string,
  subject: string,
  body: string,
  inboxWaitText: string
): Promise<void> {
  // Send the message from sender to receiver.
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

  // Prove delivery in the receiver Inbox before using search.
  await receiver.gotoMail();
  await receiver.expectAuthenticated();
  await receiver.messages.waitForMessageInFolderByText(inboxWaitText, 'inbox', receiver);
}

test.describe('E2E: Outlook search', () => {
  test('search finds message by subject', async ({ sender, receiver, receiverEmail }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const token = makeToken('SRCH-SUBJ');
    const subject = makeSubject(token);
    const body = `Search by subject scenario :: ${token}`;

    await sendMailAndWaitInReceiverInbox(sender, receiver, receiverEmail, subject, body, token);

    // Search by the full subject and verify the opened result.
    await receiver.search.search(subject);
    await receiver.messages.openMessageByText(subject);
    await receiver.messages.expectSubjectInReadingPane(subject);
    await receiver.messages.expectBodyInReadingPane(token);
  });

  test('search finds message by sender', async ({ sender, receiver, senderEmail, receiverEmail }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const token = makeToken('SRCH-SENDER');
    const subject = makeSubject(token);
    const body = `Search by sender scenario :: ${token}`;

    await sendMailAndWaitInReceiverInbox(sender, receiver, receiverEmail, subject, body, token);

    // Search by sender email address and verify the opened result.
    await receiver.search.search(senderEmail);
    await receiver.messages.openMessageByText(subject);
    await receiver.messages.expectSubjectInReadingPane(subject);
    await receiver.messages.expectBodyInReadingPane(token);
  });

  test('search finds sent message by receiver', async ({ sender, receiverEmail }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const token = makeToken('SRCH-RECEIVER');
    const subject = makeSubject(token);
    const body = `Search by receiver scenario :: ${token}`;

    // Send the message first.
    await sender.gotoMail();
    await sender.expectAuthenticated();
    await sender.toolbar.clickNewMail();
    await sender.composer.sendMail(receiverEmail, subject, body);

    // Prove the message exists in Sent Items before using search there.
    await sender.folders.openSentItems();
    await sender.messages.waitForMessageInFolderByText(token, 'sentitems', sender);

    // Search by receiver email address from the sender side.
    await sender.search.search(receiverEmail);
    await sender.messages.openMessageByText(subject);
    await sender.messages.expectSubjectInReadingPane(subject);
    await sender.messages.expectBodyInReadingPane(token);
  });

  test('search finds message by unique body token', async ({ sender, receiver, receiverEmail }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const subjectToken = makeToken('SRCH-BODY-SUBJ');
    const bodyToken = makeToken('SRCH-BODY-TEXT');
    const subject = makeSubject(subjectToken);
    const body = `Search by body scenario :: ${bodyToken}`;

    await sendMailAndWaitInReceiverInbox(sender, receiver, receiverEmail, subject, body, subjectToken);

    // Search by a token that exists only in the message body.
    await receiver.search.search(bodyToken);
    await receiver.messages.openMessageByText(subject);
    await receiver.messages.expectSubjectInReadingPane(subject);
    await receiver.messages.expectBodyInReadingPane(bodyToken);
  });

  test('search shows no results for a non-existent query', async ({ receiver }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(180_000);

    const missingToken = makeToken('SRCH-NO-RESULT');

    await receiver.gotoMail();
    await receiver.expectAuthenticated();

    // Search for a value that should not exist anywhere in the mailbox.
    await receiver.search.search(missingToken);

    // Primary signal: no message row in the list contains the token.
    await expect
      .poll(
        async () => {
          const row = receiver.page
            .locator('[role="option"], [role="row"]')
            .filter({ hasText: missingToken })
            .first();
          return await row.isVisible().catch(() => false);
        },
        { timeout: 30_000, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(false);
  });

  test('search finds sent message from within Sent Items folder', async ({ sender, receiver, receiverEmail }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const token = makeToken('SRCH-SENT');
    const subject = makeSubject(token);
    const body = `Sent Items folder search scenario :: ${token}`;

    // Send the message.
    await sender.gotoMail();
    await sender.expectAuthenticated();
    await sender.toolbar.clickNewMail();
    await sender.composer.sendMail(receiverEmail, subject, body);

    // Navigate sender to Sent Items and confirm delivery.
    await sender.messages.waitForMessageInFolderByText(token, 'sentitems', sender);

    // Search by unique subject token while in Sent Items folder context.
    await sender.search.search(subject);

    // Verify the sent message appears in results.
    await sender.messages.openMessageByText(subject);
    await sender.messages.expectSubjectInReadingPane(subject);
    await sender.messages.expectBodyInReadingPane(token);

    // Teardown: ensure receiver received it (proves the send was real).
    await receiver.gotoMail();
    await receiver.expectAuthenticated();
    await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
  });
});
