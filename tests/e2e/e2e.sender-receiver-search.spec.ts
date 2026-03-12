import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { OutlookPage } from '../../src/pages/outlookPage';
import { makeToken, makeSubject } from '../../src/utils/testData';

type MailboxActors = {
  senderContext: BrowserContext;
  receiverContext: BrowserContext;
  senderPage: Page;
  receiverPage: Page;
  sender: OutlookPage;
  receiver: OutlookPage;
  senderEmail: string;
  receiverEmail: string;
};

async function createMailboxActors(browser: Browser): Promise<MailboxActors> {
  const senderStatePath = path.resolve('storage/sender.storageState.json');
  const receiverStatePath = path.resolve('storage/receiver.storageState.json');

  const senderEmail = process.env.SENDER_EMAIL;
  const receiverEmail = process.env.RECEIVER_EMAIL;

  expect(senderEmail, 'SENDER_EMAIL must be set').toBeTruthy();
  expect(receiverEmail, 'RECEIVER_EMAIL must be set').toBeTruthy();

  const senderContext = await browser.newContext({ storageState: senderStatePath });
  const receiverContext = await browser.newContext({ storageState: receiverStatePath });

  const senderPage = await senderContext.newPage();
  const receiverPage = await receiverContext.newPage();

  const sender = new OutlookPage(senderPage, senderEmail as string);
  const receiver = new OutlookPage(receiverPage, receiverEmail as string);

  return {
    senderContext,
    receiverContext,
    senderPage,
    receiverPage,
    sender,
    receiver,
    senderEmail: senderEmail as string,
    receiverEmail: receiverEmail as string,
  };
}

async function closeMailboxActors(actors: MailboxActors): Promise<void> {
  await actors.senderContext.close().catch(() => {});
  await actors.receiverContext.close().catch(() => {});
}

async function sendMailAndWaitInReceiverInbox(
  actors: MailboxActors,
  subject: string,
  body: string,
  inboxWaitText: string
): Promise<void> {
  // Send the message from sender to receiver.
  await actors.sender.gotoMail();
  await actors.sender.expectAuthenticated();
  await actors.sender.toolbar.clickNewMail();
  await actors.sender.composer.sendMail(actors.receiverEmail, subject, body);

  // Prove delivery in the receiver Inbox before using search.
  await actors.receiver.gotoMail();
  await actors.receiver.expectAuthenticated();
  await actors.receiver.messages.waitForMessageInFolderByText(inboxWaitText, 'inbox', actors.receiver);
}

test.describe('E2E: Outlook search', () => {
  test('search finds message by subject', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const actors = await createMailboxActors(browser);

    const token = makeToken('SRCH-SUBJ');
    const subject = makeSubject(token);
    const body = `Search by subject scenario :: ${token}`;

    try {
      await sendMailAndWaitInReceiverInbox(actors, subject, body, token);

      // Search by the full subject and verify the opened result.
      await actors.receiver.search.search(subject);
      await actors.receiver.messages.openMessageByText(subject);
      await actors.receiver.messages.expectSubjectInReadingPane(subject);
      await actors.receiver.messages.expectBodyInReadingPane(token);
    } finally {
      await closeMailboxActors(actors);
    }
  });

  test('search finds message by sender', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const actors = await createMailboxActors(browser);

    const token = makeToken('SRCH-SENDER');
    const subject = makeSubject(token);
    const body = `Search by sender scenario :: ${token}`;

    try {
      await sendMailAndWaitInReceiverInbox(actors, subject, body, token);

      // Search by sender email address and verify the opened result.
      await actors.receiver.search.search(actors.senderEmail);
      await actors.receiver.messages.openMessageByText(subject);
      await actors.receiver.messages.expectSubjectInReadingPane(subject);
      await actors.receiver.messages.expectBodyInReadingPane(token);
    } finally {
      await closeMailboxActors(actors);
    }
  });

  test('search finds sent message by receiver', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const actors = await createMailboxActors(browser);

    const token = makeToken('SRCH-RECEIVER');
    const subject = makeSubject(token);
    const body = `Search by receiver scenario :: ${token}`;

    try {
      // Send the message first.
      await actors.sender.gotoMail();
      await actors.sender.expectAuthenticated();
      await actors.sender.toolbar.clickNewMail();
      await actors.sender.composer.sendMail(actors.receiverEmail, subject, body);

      // Prove the message exists in Sent Items before using search there.
      await actors.sender.folders.openSentItems();
      await actors.sender.messages.waitForMessageInFolderByText(token, 'sentitems', actors.sender);

      // Search by receiver email address from the sender side.
      await actors.sender.search.search(actors.receiverEmail);
      await actors.sender.messages.openMessageByText(subject);
      await actors.sender.messages.expectSubjectInReadingPane(subject);
      await actors.sender.messages.expectBodyInReadingPane(token);
    } finally {
      await closeMailboxActors(actors);
    }
  });

  test('search finds message by unique body token', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(240_000);

    const actors = await createMailboxActors(browser);

    const subjectToken = makeToken('SRCH-BODY-SUBJ');
    const bodyToken = makeToken('SRCH-BODY-TEXT');
    const subject = makeSubject(subjectToken);
    const body = `Search by body scenario :: ${bodyToken}`;

    try {
      await sendMailAndWaitInReceiverInbox(actors, subject, body, subjectToken);

      // Search by a token that exists only in the message body.
      await actors.receiver.search.search(bodyToken);
      await actors.receiver.messages.openMessageByText(subject);
      await actors.receiver.messages.expectSubjectInReadingPane(subject);
      await actors.receiver.messages.expectBodyInReadingPane(bodyToken);
    } finally {
      await closeMailboxActors(actors);
    }
  });

  test('search shows no results for a non-existent query', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
    test.setTimeout(180_000);

    const actors = await createMailboxActors(browser);
    const missingToken = makeToken('SRCH-NO-RESULT');

    try {
      await actors.receiver.gotoMail();
      await actors.receiver.expectAuthenticated();

      // Search for a value that should not exist anywhere in the mailbox.
      await actors.receiver.search.search(missingToken);

      // Verify that no visible result row matches the missing token.
      await expect
        .poll(
          async () => {
            return await actors.receiverPage.getByText(missingToken).first().isVisible().catch(() => false);
          },
          { timeout: 30_000, intervals: [500, 1000, 1500, 2000] }
        )
        .toBe(false);
    } finally {
      await closeMailboxActors(actors);
    }
  });
});