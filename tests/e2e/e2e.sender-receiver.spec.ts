import { test } from '../fixtures/outlook.fixture';
import { TIMEOUTS } from '../../src/constants/timeouts';

function fullTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

test('E2E: sender sends an email, receiver sees it', async ({ sender, receiver, receiverEmail }, testInfo) => {
  // Run only once to avoid duplicate send/delivery noise.
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');

  // E2E email delivery can be slow; do not use the global default timeout.
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const subject = `PW-E2E-${fullTimestamp()}`;
  const body = `Initial message for ${subject}`;

  // 1) Sender sends initial mail
  await sender.gotoMail();
  await sender.expectAuthenticated();

  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, body);

  // 2) Receiver waits and opens it
  await receiver.gotoMail();
  await receiver.expectAuthenticated();

  await receiver.messages.waitForMessageInInbox(subject, receiver);
  await receiver.messages.openMessageBySubject(subject);
  await receiver.messages.expectSubjectInReadingPane(subject);

  // If your Messages component supports body assertion, keep it.
  // If not, remove the next line.
  await receiver.messages.expectBodyInReadingPane(body);
});
