import { test, expect } from '@playwright/test';
import path from 'path';
import { OutlookPage } from '../../src/pages/outlookPage';
import { makeToken, makeSubject } from '../../src/utils/testData';

test('E2E: receiver archives message, message appears in Archive', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(240_000);

  const senderStatePath = path.resolve('storage/sender.storageState.json');
  const receiverStatePath = path.resolve('storage/receiver.storageState.json');

  const senderContext = await browser.newContext({ storageState: senderStatePath });
  const receiverContext = await browser.newContext({ storageState: receiverStatePath });

  const senderPage = await senderContext.newPage();
  const receiverPage = await receiverContext.newPage();

  const senderEmail = process.env.SENDER_EMAIL;
  const receiverEmail = process.env.RECEIVER_EMAIL;

  expect(senderEmail, 'SENDER_EMAIL must be set').toBeTruthy();
  expect(receiverEmail, 'RECEIVER_EMAIL must be set').toBeTruthy();

  const sender = new OutlookPage(senderPage, senderEmail as string);
  const receiver = new OutlookPage(receiverPage, receiverEmail as string);

  const token = makeToken('ARC');
  const subject = makeSubject(token);
  const body = `Archive scenario message :: ${token}`;

  try {
    // 1) Sender sends initial mail
    await sender.gotoMail();
    await sender.expectAuthenticated();
    await sender.toolbar.clickNewMail();
    await sender.composer.sendMail(receiverEmail as string, subject, body);

    // 2) Receiver waits and opens it in Inbox (by token)
    await receiver.gotoMail();
    await receiver.expectAuthenticated();
    await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
    await receiver.messages.openMessageByText(token);
    await receiver.messages.expectSubjectInReadingPane(subject);

    // 3) Receiver archives the open message
    await receiver.readingPane.archiveOpenMessage();

    // 4) Verify it disappears from Inbox
    await receiver.messages.waitForMessageNotInFolderByText(token, 'inbox', receiver);

    // 5) Verify it appears in Archive
    await receiver.messages.waitForMessageInFolderByText(token, 'archive', receiver);

    // Optional: open and assert body
    await receiver.messages.openMessageByText(token);
    await receiver.messages.expectBodyInReadingPane(token);
  } finally {
    await senderContext.close().catch(() => {});
    await receiverContext.close().catch(() => {});
  }
});