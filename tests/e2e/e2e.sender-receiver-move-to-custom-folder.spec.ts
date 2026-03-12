import { test, expect } from '@playwright/test';
import path from 'path';
import { OutlookPage } from '../../src/pages/outlookPage';
import { makeToken, makeSubject } from '../../src/utils/testData';

test('E2E: create custom folder and move message into it', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(300_000);

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

  const token = makeToken('MOVE');
  const subject = makeSubject(token);
  const body = `Move-to-custom-folder scenario :: ${token}`;

  const customFolderName = `PW-${token}-FOLDER`;

  try {
    // 1) Sender sends an email to receiver.
    await sender.gotoMail();
    await sender.expectAuthenticated();
    await sender.toolbar.clickNewMail();
    await sender.composer.sendMail(receiverEmail as string, subject, body);

    // 1.1) Prove that the message exists in Sender -> Sent Items before waiting on the receiver side.
    await sender.folders.openSentItems();
    await sender.messages.waitForMessageInFolderByText(token, 'sentitems', sender);

    // 2) Receiver ensures the custom folder exists.
    await receiver.gotoMail();
    await receiver.expectAuthenticated();
    await receiver.folders.ensureCustomFolder(customFolderName);

    // 3) Receiver waits for the message in Inbox and opens it.
    await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
    await receiver.messages.openMessageByText(token);
    await receiver.messages.expectSubjectInReadingPane(subject);

    // 4) Move the open message to the custom folder.
    await receiver.readingPane.moveOpenMessageToFolder(customFolderName);

    // 5) Verify the message disappears from Inbox.
    await receiver.messages.waitForMessageNotInFolderByText(token, 'inbox', receiver);

    // 6) Open the custom folder and open the moved message directly.
    // The subsequent reading-pane assertion is the real proof that the correct message was moved.
    await receiver.folders.openCustomFolder(customFolderName);
    await receiver.messages.openMessageByText(token);

    // 7) Verify the message body in the reading pane.
    await receiver.messages.expectBodyInReadingPane(token);
  } finally {
    await senderContext.close().catch(() => {});
    await receiverContext.close().catch(() => {});
  }
});