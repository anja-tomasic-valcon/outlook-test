import { test, expect } from '@playwright/test';
import { APP } from '../../src/constants/app.constants';
import { LoginPage } from '../../src/pages/login.page';

/**
 * AUTH SETUP (SENDER):
 * - Manual login as valcon.test1@outlook.com
 * - Save storageState to storage/sender.storageState.json
 */
test('AUTH SETUP - sender storageState (manual login)', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();

  // Login manually, then click "Resume" in Playwright Inspector.
  await page.pause();

  await loginPage.assertLoggedIn();

  await page.context().storageState({ path: APP.storage.sender });

  await expect(page.getByRole('button', { name: /new mail/i })).toBeVisible();
});
