import { expect, test } from '@playwright/test';
import { OutlookPage } from '../../src/pages/outlookPage';

function requireEnv(name: 'SENDER_EMAIL' | 'RECEIVER_EMAIL'): string {
  const value = process.env[name];
  expect(value, `${name} must be set in your environment (.env)`).toBeTruthy();
  return value as string;
}

function mailboxLabelFromProject(projectName: string): string {
  if (projectName === 'sender') return requireEnv('SENDER_EMAIL');
  if (projectName === 'receiver') return requireEnv('RECEIVER_EMAIL');
  throw new Error(`Unknown project name "${projectName}". Expected "sender" or "receiver".`);
}

test.describe('SMOKE: outlook core UI', () => {

  test('Authenticated session loads mail UI', async ({ page }, testInfo) => {
    const outlook = new OutlookPage(page, mailboxLabelFromProject(testInfo.project.name));

    await test.step('Navigate to mail UI', async () => {
      await outlook.gotoMail();
    });

    await test.step('Verify authenticated state', async () => {
      await outlook.expectAuthenticated();
    });
  });

  test('Default folders are visible', async ({ page }, testInfo) => {
    const outlook = new OutlookPage(page, mailboxLabelFromProject(testInfo.project.name));

    await outlook.gotoMail();

    await test.step('Verify core folders exist', async () => {
      await outlook.folders.expectDefaultFoldersVisible();
    });
  });

  test('Can open Inbox and Sent Items', async ({ page }, testInfo) => {
    const outlook = new OutlookPage(page, mailboxLabelFromProject(testInfo.project.name));

    await outlook.gotoMail();

    await test.step('Open Inbox', async () => {
      await outlook.folders.openInbox();
      await outlook.folders.expectSelected('inbox');
    });

    await test.step('Open Sent Items', async () => {
      await outlook.folders.openSentItems();
      await outlook.folders.expectSelected('sentitems');
    });
  });

  test('Can open New mail composer', async ({ page }, testInfo) => {
    const outlook = new OutlookPage(page, mailboxLabelFromProject(testInfo.project.name));

    await outlook.gotoMail();

    await test.step('Open composer', async () => {
      await outlook.toolbar.clickNewMail();
      await outlook.composer.expectReady();
    });
  });
});

test.describe('EXTENDED: mailbox inventory (optional)', () => {

  test('All mailbox folders are visible', async ({ page }, testInfo) => {
    const outlook = new OutlookPage(page, mailboxLabelFromProject(testInfo.project.name));

    await outlook.gotoMail();

    await test.step('Verify all mailbox folders render', async () => {
      await outlook.folders.expectAllMailboxFoldersVisible();
    });
  });

});