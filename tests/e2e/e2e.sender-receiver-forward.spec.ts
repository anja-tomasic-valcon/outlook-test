import { test } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';
import { TIMEOUTS } from '../../src/constants/timeouts';

test('E2E: receiver forwards message, sender receives the forward', async ({ sender, receiver, senderEmail, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const token = makeToken('FWD');
  const subject = makeSubject(token);
  const body = `Forward scenario original message :: ${token}`;

  // Unique token added to the forward body so we can find it on the sender side
  // without relying on "Fw:" subject prefix behaviour.
  const fwdToken = makeToken('FWD-BODY');

  // 1) Sender sends initial mail to receiver.
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

  // 2) Receiver waits for the message, opens it.
  await receiver.gotoMail();
  await receiver.expectAuthenticated();
  await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
  await receiver.messages.openMessageByText(token);
  await receiver.messages.expectSubjectInReadingPane(subject);

  // 3) Receiver forwards the open message back to sender, adding the fwdToken.
  await receiver.readingPane.forwardAndSend(senderEmail, fwdToken);

  // 4) Sender waits for the forwarded message (identified by fwdToken).
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.messages.waitForMessageInFolderByText(fwdToken, 'inbox', sender);
  await sender.messages.openMessageByText(fwdToken);
  await sender.messages.expectBodyInReadingPane(fwdToken);
});
