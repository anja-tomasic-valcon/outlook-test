import { test } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';

test('E2E: create custom folder and move message into it', async ({ sender, receiver, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(300_000);

  const token = makeToken('MOVE');
  const subject = makeSubject(token);
  const body = `Move-to-custom-folder scenario :: ${token}`;

  const customFolderName = `PW-${token}-FOLDER`;

  // 1) Sender sends an email to receiver.
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

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
});
