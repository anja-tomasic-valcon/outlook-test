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
    // 1) Sender sends an email to receiver
    await sender.gotoMail();
    await sender.expectAuthenticated();
    await sender.toolbar.clickNewMail();
    await sender.composer.sendMail(receiverEmail as string, subject, body);

    // 1.1) PROOF: verify the message exists in Sender -> Sent Items
    // If this fails, the whole receiver wait is pointless (message was never sent).
    await sender.folders.openSentItems();
    // DEBUG (temporary): prove whether token exists in Sent Items DOM via aria-label
await sender.folders.openSentItems();

const tokenRe = new RegExp(token, 'i');
const byRole = senderPage.getByRole('option', { name: tokenRe });
const count = await byRole.count();

console.log(`[DEBUG] role=option name~token count: ${count}`);

if (count > 0) {
  const first = byRole.first();
  const aria = await first.getAttribute('aria-label');
  console.log('[DEBUG] first match aria-label:', aria);
}

// Pause so you can inspect in headed/ui
await senderPage.waitForTimeout(10_000);
    await sender.messages.waitForMessageInFolderByText(token, 'sentitems', sender);

    // 2) Receiver ensures custom folder exists
    await receiver.gotoMail();
    await receiver.expectAuthenticated();
    await receiver.folders.ensureCustomFolder(customFolderName);

    // 3) Receiver waits for message in Inbox, opens it by token
    // NOTE: messageList has internal retries, but we keep total runtime under test timeout.
    await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
    await receiver.messages.openMessageByText(token);
    await receiver.messages.expectSubjectInReadingPane(subject);

    // 4) Move the open message to the custom folder
    await receiver.readingPane.moveOpenMessageToFolder(customFolderName);

    // 5) Verify it disappears from Inbox
    await receiver.messages.waitForMessageNotInFolderByText(token, 'inbox', receiver);

    // 6) Verify it appears in the custom folder
    await receiver.folders.openCustomFolder(customFolderName);

    await expect
      .poll(
        async () => receiverPage.getByText(token).first().isVisible().catch(() => false),
        { timeout: 120_000, intervals: [2000, 3000, 5000, 8000] }
      )
      .toBe(true);

    // Optional: open and assert body contains token
    await receiver.messages.openMessageByText(token);
    await receiver.messages.expectBodyInReadingPane(token);
  } finally {
    await senderContext.close().catch(() => {});
    await receiverContext.close().catch(() => {});
  }
});