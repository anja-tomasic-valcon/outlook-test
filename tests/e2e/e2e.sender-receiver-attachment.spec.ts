import path from 'path';
import { test } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';
import { TIMEOUTS } from '../../src/constants/timeouts';

const ATTACHMENT_FILENAME = 'test-attachment.txt';
const ATTACHMENT_PATH = path.resolve(__dirname, '../assets', ATTACHMENT_FILENAME);

test('E2E: sender sends email with attachment, receiver sees the attachment', async ({ sender, receiver, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const token = makeToken('ATTACH');
  const subject = makeSubject(token);
  const body = `Attachment scenario :: ${token}`;

  // 1) Sender composes with an attachment.
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.expectReady();
  await sender.composer.fillTo(receiverEmail);
  await sender.composer.fillSubject(subject);
  await sender.composer.fillBody(body);
  await sender.composer.attachFile(ATTACHMENT_PATH);
  await sender.composer.clickSend();

  // 2) Receiver opens the email.
  await receiver.gotoMail();
  await receiver.expectAuthenticated();
  await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
  await receiver.messages.openMessageByText(token);
  await receiver.messages.expectSubjectInReadingPane(subject);

  // 3) Verify the attachment filename is visible in the reading pane.
  //    Outlook renders attachment names as text inside the message body region.
  await receiver.messages.expectBodyInReadingPane(ATTACHMENT_FILENAME);
});
