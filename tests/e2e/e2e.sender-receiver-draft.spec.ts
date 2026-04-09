import { test } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';
import { TIMEOUTS } from '../../src/constants/timeouts';

test('E2E: sender saves draft, reopens it, and sends; receiver receives it', async ({ sender, receiver, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const token = makeToken('DRAFT');
  const subject = makeSubject(token);
  const body = `Draft scenario message :: ${token}`;

  // 1) Sender composes a message but saves it as a draft instead of sending.
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.fillTo(receiverEmail);
  await sender.composer.fillSubject(subject);
  await sender.composer.fillBody(body);
  await sender.composer.saveDraftAndClose();

  // 2) Verify the draft appears in the Drafts folder.
  await sender.messages.waitForMessageInFolderByText(token, 'drafts', sender);

  // 3) Reopen the draft — clicking a draft row opens the compose window, not reading pane.
  await sender.messages.clickMessageByText(token);

  // 4) Composer should re-open with the draft pre-filled; send it.
  await sender.composer.clickSend();
  await sender.composer.root().waitFor({ state: 'hidden', timeout: TIMEOUTS.UI_LONG });

  // 5) Verify the draft disappears from Drafts folder.
  await sender.messages.waitForMessageNotInFolderByText(token, 'drafts', sender);

  // 6) Receiver receives the formerly-draft message.
  await receiver.gotoMail();
  await receiver.expectAuthenticated();
  await receiver.messages.waitForMessageInFolderByText(token, 'inbox', receiver);
  await receiver.messages.openMessageByText(token);
  await receiver.messages.expectSubjectInReadingPane(subject);
  await receiver.messages.expectBodyInReadingPane(token);
});
