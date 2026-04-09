import { test } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';

test('E2E: receiver archives message, message appears in Archive', async ({ sender, receiver, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(240_000);

  const token = makeToken('ARC');
  const subject = makeSubject(token);
  const body = `Archive scenario message :: ${token}`;

  // 1) Sender sends initial mail
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

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
});
