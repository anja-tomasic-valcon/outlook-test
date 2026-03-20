import { test, expect, Locator, Page } from '@playwright/test';
import path from 'path';
import { TIMEOUTS } from '../../src/constants/timeouts';

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

function titlePlaceholder(page: Page): Locator {
  // Use placeholder locator for the title input (stable and visible)
  return page.getByPlaceholder('Add title').first();
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

  await expect(
    titlePlaceholder(page),
    'Expected Add title placeholder after opening New event'
  ).toBeVisible({
    timeout: TIMEOUTS.UI_LONG,
  });
}

test('E2E: open New event form in calendar', async ({ browser }) => {
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

  try {
    await page.goto('/calendar/');

    await openNewEvent(page);

    await expect(saveButton(page)).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
    await expect(titlePlaceholder(page)).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  } finally {
    await ctx.close().catch(() => {});
  }
});