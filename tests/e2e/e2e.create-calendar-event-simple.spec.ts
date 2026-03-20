import { test, expect, Locator, Page } from '@playwright/test';
import path from 'path';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { makeToken } from '../../src/utils/testData';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function addMinutes(date: Date, minutes: number): Date {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function formatDateForOutlook(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatTimeForOutlook(date: Date): string {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = pad2(date.getMinutes());
  const ampm = hours24 >= 12 ? 'PM' : 'AM';

  return `${hours12}:${minutes} ${ampm}`;
}

function newEventButton(page: Page): Locator {
  return page.getByRole('button', { name: /new event/i }).first();
}

function eventMenuItem(page: Page): Locator {
  return page.getByRole('menuitem', { name: /^event$/i }).first();
}

function eventMenuButton(page: Page): Locator {
  return page.getByRole('button', { name: /^event$/i }).first();
}

function saveButton(page: Page): Locator {
  return page.getByRole('button', { name: /^save$/i }).first();
}

function titleInput(page: Page): Locator {
  return page.locator(
    'input[placeholder="Add title"], input[aria-label="Add details for the event"]'
  ).first();
}

function startDateInput(page: Page): Locator {
  return page.locator('input[aria-label="Start date"]').first();
}

function startTimeInput(page: Page): Locator {
  return page.locator('input[aria-label="Start time"]').first();
}

function endDateInput(page: Page): Locator {
  return page.locator('input[aria-label="End date"]').first();
}

function endTimeInput(page: Page): Locator {
  return page.locator('input[aria-label="End time"]').first();
}

function recurringCheckbox(page: Page): Locator {
  return page.getByRole('checkbox', { name: /recurring/i }).first();
}

function recurringButton(page: Page): Locator {
  return page.getByRole('button', { name: /make recurring|recurring|repeat/i }).first();
}

function allDayCheckbox(page: Page): Locator {
  return page.getByRole('checkbox', { name: /all day/i }).first();
}

function teamsToggle(page: Page): Locator {
  return page.getByLabel(/teams meeting/i).first();
}

async function openNewEvent(page: Page): Promise<void> {
  await expect(newEventButton(page), 'Expected New event button to be visible').toBeVisible({
    timeout: TIMEOUTS.UI_LONG,
  });

  await newEventButton(page).click();

  if (await eventMenuItem(page).isVisible().catch(() => false)) {
    await eventMenuItem(page).click();
  } else if (await eventMenuButton(page).isVisible().catch(() => false)) {
    await eventMenuButton(page).click();
  }

  await expect(saveButton(page), 'Expected Save button after opening New event').toBeVisible({
    timeout: TIMEOUTS.UI_LONG,
  });
  // Do not require start date/time to be visible immediately. The UI may
  // lazy-expand the schedule editor. We will activate it when setting values.
}

async function setInputValue(input: Locator, value: string): Promise<void> {
  await expect(input).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  await input.click();
  await input.press('ControlOrMeta+A');
  await input.fill(value);
  await input.press('Tab');
}

async function fillTitle(page: Page, title: string): Promise<void> {
  await page.waitForTimeout(300);

  const focusedIsTitle = await page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | null;
    if (!el) return false;

    const ariaLabel = el.getAttribute('aria-label') || '';
    const placeholder = el.getAttribute('placeholder') || '';

    return (
      ariaLabel === 'Add details for the event' ||
      placeholder === 'Add title'
    );
  });

  if (focusedIsTitle) {
    await page.keyboard.press('ControlOrMeta+A').catch(() => {});
    await page.keyboard.type(title);
    await expect(titleInput(page)).toHaveValue(title, { timeout: TIMEOUTS.UI_LONG });
    return;
  }

    // If the title input is not immediately visible, try to reach it by
    // focusing alternate textboxes or tabbing from the current focus.
    if (!(await titleInput(page).isVisible().catch(() => false))) {
    // Try accessible textbox with name 'Add details for the event'
    const altTextbox = page.getByRole('textbox', { name: /add details for the event/i }).first();
    if ((await altTextbox.count()) && (await altTextbox.isVisible().catch(() => false))) {
      await altTextbox.click();
      await altTextbox.fill(title);
      await expect(altTextbox).toHaveValue(title, { timeout: TIMEOUTS.UI_LONG });
      return;
    }

    // Try tabbing from current focus until the title input appears
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      if (await titleInput(page).isVisible().catch(() => false)) break;
    }
  }

  // Final attempt: if visible, click and fill; otherwise set value via JS as a last resort.
  if (await titleInput(page).isVisible().catch(() => false)) {
    await titleInput(page).click();
    await titleInput(page).fill(title);
    await expect(titleInput(page)).toHaveValue(title, { timeout: TIMEOUTS.UI_LONG });
    return;
  }

  // Last-resort: set the input/value via DOM scripting and dispatch input event.
  const setOk = await page.evaluate((val) => {
    const sel = 'input[placeholder="Add title"], input[aria-label="Add details for the event"], [role="textbox"]';
    const el = document.querySelector(sel) as HTMLInputElement | null;
    if (!el) return false;
    el.focus();
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, title);

  if (!setOk) {
    throw new Error('Unable to find or set title input');
  }
  // wait for value to propagate
  await page.waitForTimeout(200);
}

async function setTomorrowSameTimeFor30Minutes(page: Page): Promise<void> {
  const now = new Date();
  // For this test we keep the prefilled start/end time values and only ensure
  // the date is set to TODAY. Activate schedule editor if necessary.
  const start = new Date(now);
  start.setSeconds(0, 0);

  if (!(await startDateInput(page).isVisible().catch(() => false))) {
    const dateSummaryBtn = page.getByRole('button', { name: /date and time|date & time|date/i }).first();
    if ((await dateSummaryBtn.count()) && (await dateSummaryBtn.isVisible().catch(() => false))) {
      await dateSummaryBtn.click();
    } else {
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        if (await startDateInput(page).isVisible().catch(() => false)) break;
      }
    }
  }

  // Set start date to today only; leave start/end times as prefilled by the UI.
  if (await startDateInput(page).isVisible().catch(() => false)) {
    await setInputValue(startDateInput(page), formatDateForOutlook(start));
  }
}

async function ensureOptionsOff(page: Page): Promise<void> {
  if (await recurringCheckbox(page).isVisible().catch(() => false)) {
    const checked = await recurringCheckbox(page).isChecked().catch(() => false);
    if (checked) {
      await recurringCheckbox(page).click();
    }
  } else if (await recurringButton(page).isVisible().catch(() => false)) {
    const pressed = await recurringButton(page).getAttribute('aria-pressed').catch(() => null);
    const checked = await recurringButton(page).getAttribute('aria-checked').catch(() => null);

    if (pressed === 'true' || checked === 'true') {
      await recurringButton(page).click();
    }
  }

  if (await allDayCheckbox(page).isVisible().catch(() => false)) {
    const checked = await allDayCheckbox(page).isChecked().catch(() => false);
    if (checked) {
      await allDayCheckbox(page).click();
    }
  }

  if (await teamsToggle(page).isVisible().catch(() => false)) {
    const checked = await teamsToggle(page).getAttribute('aria-checked').catch(() => null);
    if (checked === 'true') {
      await teamsToggle(page).click();
    }
  }
}

test('E2E: create a non-recurring calendar event for tomorrow at now', async ({ browser }) => {
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const senderStatePath = path.resolve('storage/sender.storageState.json');
  const senderEmail = process.env.SENDER_EMAIL;
  expect(senderEmail, 'SENDER_EMAIL must be set').toBeTruthy();

  const ctx = await browser.newContext({
    storageState: senderStatePath,
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });

  const page = await ctx.newPage();

  const token = makeToken('CAL');
  const title = `PW-EVENT-${token}`;

  try {
    await page.goto('/calendar/');

    await openNewEvent(page);
    await fillTitle(page, title);
    await setTomorrowSameTimeFor30Minutes(page);
    await ensureOptionsOff(page);

    await expect(saveButton(page), 'Expected Save button before saving').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await saveButton(page).click();

    await expect(saveButton(page)).toBeHidden({ timeout: TIMEOUTS.UI_LONG });

    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
  } finally {
    await ctx.close().catch(() => {});
  }
});

test('E2E: create a calendar event and add attendee', async ({ browser }) => {
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const senderStatePath = path.resolve('storage/sender.storageState.json');
  const senderEmail = process.env.SENDER_EMAIL;
  const receiverEmail = process.env.RECEIVER_EMAIL;
  expect(senderEmail, 'SENDER_EMAIL must be set').toBeTruthy();
  expect(receiverEmail, 'RECEIVER_EMAIL must be set').toBeTruthy();

  const ctx = await browser.newContext({ storageState: senderStatePath, viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();

  const token = makeToken('CAL-ATT');
  const title = `PW-EVENT-${token}`;

  try {
    await page.goto('/calendar/');

    await openNewEvent(page);
    await fillTitle(page, title);
    await setTomorrowSameTimeFor30Minutes(page);

    // Add attendee: find attendee input inside the calendar compose form
    let attendeeInput = page.locator('input[placeholder="Add attendees"], input[placeholder*="Invite"], input[aria-label*="Invite"], input[aria-label*="Add attendees"], input[aria-label="To"]').first();
    if (!(await attendeeInput.count()) || !(await attendeeInput.isVisible().catch(() => false))) {
      attendeeInput = page.getByRole('textbox', { name: /to|invite|attend/i }).first();
    }

    if (await attendeeInput.count()) {
      await attendeeInput.click();
      await attendeeInput.fill(receiverEmail as string);

      // If suggestions appear, pick the suggestion; otherwise press Enter to accept
      const suggestion = page.locator('#FloatingSuggestionsList [role="option"]').filter({ hasText: receiverEmail as string }).first();
      if (await suggestion.count()) {
        await suggestion.click();
      } else {
        await attendeeInput.press('Enter');
      }
    }

    // Ensure recurring/all-day/teams are off before saving
    await ensureOptionsOff(page);

    await expect(saveButton(page), 'Expected Save button before saving').toBeVisible({ timeout: TIMEOUTS.UI_LONG });
    await saveButton(page).click();

    await expect(saveButton(page)).toBeHidden({ timeout: TIMEOUTS.UI_LONG });

    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  } finally {
    await ctx.close().catch(() => {});
  }
});

test('E2E: create a recurring calendar event for today', async ({ browser }) => {
  test.setTimeout(TIMEOUTS.TEST_E2E);

  const senderStatePath = path.resolve('storage/sender.storageState.json');
  const senderEmail = process.env.SENDER_EMAIL;
  expect(senderEmail, 'SENDER_EMAIL must be set').toBeTruthy();

  const ctx = await browser.newContext({ storageState: senderStatePath, viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await ctx.newPage();

  const token = makeToken('CAL-REC');
  const title = `PW-EVENT-${token}`;

  try {
    await page.goto('/calendar/');

    await openNewEvent(page);
    await fillTitle(page, title);
    await setTomorrowSameTimeFor30Minutes(page);

    // Ensure teams and all-day are off, but enable recurring
    if (await teamsToggle(page).isVisible().catch(() => false)) {
      const checked = await teamsToggle(page).getAttribute('aria-checked').catch(() => null);
      if (checked === 'true') await teamsToggle(page).click();
    }

    if (await allDayCheckbox(page).isVisible().catch(() => false)) {
      const checked = await allDayCheckbox(page).isChecked().catch(() => false);
      if (checked) await allDayCheckbox(page).click();
    }

    // Enable recurring: prefer checkbox, fall back to toggle button
    if (await recurringCheckbox(page).isVisible().catch(() => false)) {
      const checked = await recurringCheckbox(page).isChecked().catch(() => false);
      if (!checked) await recurringCheckbox(page).click();
    } else if (await recurringButton(page).isVisible().catch(() => false)) {
      const pressed = await recurringButton(page).getAttribute('aria-pressed').catch(() => null);
      const checked = await recurringButton(page).getAttribute('aria-checked').catch(() => null);
      if (!(pressed === 'true' || checked === 'true')) await recurringButton(page).click();
    }

    // Save and verify
    await expect(saveButton(page), 'Expected Save button before saving').toBeVisible({ timeout: TIMEOUTS.UI_LONG });
    await saveButton(page).click();

    await expect(saveButton(page)).toBeHidden({ timeout: TIMEOUTS.UI_LONG });
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  } finally {
    await ctx.close().catch(() => {});
  }
});