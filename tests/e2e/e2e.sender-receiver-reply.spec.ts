import { test, expect } from '../fixtures/outlook.fixture';
import { TIMEOUTS, mutableIntervals } from '../../src/constants/timeouts';

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

/**
 * Outlook search differs across UI variants (A/B tests):
 * - role can be searchbox/combobox/textbox
 * - the input can be hidden behind a Search button/icon
 * This helper makes search robust for portfolio-grade E2E stability.
 */
async function getVisibleSearchInput(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  const searchInput = page
    .getByRole('searchbox')
    .or(page.getByRole('combobox', { name: /search/i }))
    .or(page.getByRole('textbox', { name: /search/i }))
    .or(page.locator('input[aria-label*="search" i]'))
    .or(page.locator('input[placeholder*="search" i]'))
    .first();

  const searchButton = page
    .getByRole('button', { name: /search/i })
    .or(page.locator('[role="button"][aria-label*="search" i]'))
    .or(page.locator('button[aria-label*="search" i]'))
    .first();

  // If the input is not visible, try to open it via the Search button/icon.
  const visible = await searchInput.isVisible().catch(() => false);
  if (!visible) {
    const btnVisible = await searchButton.isVisible().catch(() => false);
    if (btnVisible) {
      await searchButton.click();
    }
  }

  await expect(searchInput, 'Expected search input to be visible').toBeVisible({
    timeout: TIMEOUTS.SEARCH_VISIBLE,
  });

  return searchInput;
}

test('E2E: receiver replies, sender receives reply', async ({ sender, receiver, receiverEmail }, testInfo) => {
  test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const subject = `PW-${fullTimestamp()}`;
  const initialBody = `Initial message for ${subject}`;

  // Use a unique token so we can reliably find the reply regardless of "Re:" behavior.
  const replyToken = `REPLY-${fullTimestamp()}`;
  const replyBody = `Reply message for ${subject} :: ${replyToken}`;

  // 1) Sender sends initial mail
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.toolbar.clickNewMail();
  await sender.composer.sendMail(receiverEmail, subject, initialBody);

  // 2) Receiver waits and opens it
  await receiver.gotoMail();
  await receiver.expectAuthenticated();
  await receiver.messages.waitForMessageInInbox(subject, receiver);
  await receiver.messages.openMessageBySubject(subject);
  await receiver.messages.expectSubjectInReadingPane(subject);

  // 3) Receiver replies (with token)
  await receiver.readingPane.replyAndSend(replyBody);

  // 4) Sender finds reply by token using Search (no dependency on "Re:")
  await sender.gotoMail();
  await sender.expectAuthenticated();
  await sender.folders.openInbox();

  const searchInput = await getVisibleSearchInput(sender.page);

  // Clear, type token, submit
  await searchInput.fill('');
  await searchInput.fill(replyToken);
  await sender.page.keyboard.press('Enter');

  // Wait for token to appear in results UI
  await expect
    .poll(
      async () => sender.page.getByText(replyToken).first().isVisible().catch(() => false),
      {
        timeout: TIMEOUTS.MAIL_DELIVERY_MAX,
        intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_MEDIUM),
      }
    )
    .toBe(true);

  // Open the message containing token (subject may be "Re:" or thread)
  await sender.page.getByText(replyToken).first().click();

  // Assert body contains token + full reply
  await sender.messages.expectBodyInReadingPane(replyToken);
  await sender.messages.expectBodyInReadingPane(replyBody);
});
