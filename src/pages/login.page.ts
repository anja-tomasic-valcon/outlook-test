import { Page, expect } from '@playwright/test';
import { APP } from '../constants/app.constants';

/**
 * LoginPage for manual login during storageState generation.
 * We don't automate credentials (MFA/anti-bot friendly).
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    // Start from a stable mail entry point
    await this.page.goto(`${APP.baseUrl}${APP.mailEntryPath}`, { waitUntil: 'domcontentloaded' });

    // Small settle; Outlook is a SPA and keeps doing background work
    await this.page.waitForTimeout(500);
  }

  async assertLoggedIn(): Promise<void> {
    // Best signal: "New mail" visible in mailbox UI
    await expect
      .poll(() => this.page.url(), { timeout: 30_000 })
      .toContain(APP.expectedMailUrlPrefix);

    await expect(this.page.getByRole('button', { name: /new mail/i })).toBeVisible({ timeout: 30_000 });
  }
}
