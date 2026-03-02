import { expect, Locator, Page } from '@playwright/test';

/**
 * Outlook top toolbar actions (New mail, etc.).
 */
export class Toolbar {
  constructor(private readonly page: Page) {}

  newMailButton(): Locator {
    return this.page.getByRole('button', { name: /new mail/i }).first();
  }

  async clickNewMail(): Promise<void> {
    const btn = this.newMailButton();
    await expect(btn, 'Expected "New mail" button to be visible').toBeVisible({ timeout: 30_000 });
    await btn.click();
  }
}