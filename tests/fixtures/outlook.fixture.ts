import { test as base } from '@playwright/test';
import path from 'path';
import { OutlookPage } from '../../src/pages/outlookPage';

type OutlookFixtures = {
  senderEmail: string;
  receiverEmail: string;
  sender: OutlookPage;
  receiver: OutlookPage;
};

/**
 * Shared fixtures for dual-context Outlook e2e tests.
 *
 * Provides pre-authenticated sender/receiver OutlookPage instances.
 * Each fixture creates its own BrowserContext from the matching storageState
 * and tears it down automatically after the test.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/outlook.fixture';
 *
 * Note: Tests that target only the 'sender' project should still call
 *   test.skip(testInfo.project.name !== 'sender', ...)
 * inside the test body. Playwright fixtures are set up before the test
 * body runs, so the skip is a test-level guard only. The overhead on the
 * 'receiver' project (two context creations + immediate teardown) is
 * negligible at workers: 1.
 */
export const test = base.extend<OutlookFixtures>({
  senderEmail: async ({}, use) => {
    const email = process.env.SENDER_EMAIL;
    if (!email) throw new Error('SENDER_EMAIL must be set');
    await use(email);
  },

  receiverEmail: async ({}, use) => {
    const email = process.env.RECEIVER_EMAIL;
    if (!email) throw new Error('RECEIVER_EMAIL must be set');
    await use(email);
  },

  sender: async ({ browser, senderEmail }, use) => {
    const ctx = await browser.newContext({
      storageState: path.resolve('storage/sender.storageState.json'),
    });
    const page = await ctx.newPage();
    await use(new OutlookPage(page, senderEmail));
    await ctx.close().catch(() => {});
  },

  receiver: async ({ browser, receiverEmail }, use) => {
    const ctx = await browser.newContext({
      storageState: path.resolve('storage/receiver.storageState.json'),
    });
    const page = await ctx.newPage();
    await use(new OutlookPage(page, receiverEmail));
    await ctx.close().catch(() => {});
  },
});

export { expect } from '@playwright/test';
