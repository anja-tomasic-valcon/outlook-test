import { test, expect } from '../fixtures/outlook.fixture';
import { makeToken, makeSubject } from '../../src/utils/testData';
import { TIMEOUTS } from '../../src/constants/timeouts';

test('E2E: sending to a malformed address is blocked by Outlook', async ({ sender }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run only once (project: sender).');
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const token = makeToken('BAD-RCPT');
  const subject = makeSubject(token);
  const body = `Bad recipient scenario :: ${token}`;

  // A syntactically malformed address (no @ sign) cannot be delivered.
  // Outlook blocks send at the UI level and keeps the composer open.
  const badAddress = `notavalidemail-${token}`;

  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.expectReady();

  // Use fillToRaw: types the address and commits with Tab, no suggestion wait.
  await sender.composer.fillToRaw(badAddress);
  await sender.composer.fillSubject(subject);
  await sender.composer.fillBody(body);
  await sender.composer.clickSend();

  // Primary assertion: the composer must still be visible.
  // If Outlook allowed the send, the composer would close; staying open means send was blocked.
  await expect(
    sender.composer.root(),
    'Expected composer to remain open after attempting to send to a malformed address'
  ).toBeVisible({ timeout: TIMEOUTS.UI_MEDIUM });
});
