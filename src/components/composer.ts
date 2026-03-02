import { expect, Locator, Page } from '@playwright/test';

export class Composer {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.locator('[id^="docking_InitVisiblePart_"]');
  }

  subjectInput(): Locator {
    return this.root().locator('input[placeholder*="Add a subject"]');
  }

  sendButton(): Locator {
    return this.root().getByRole('button', { name: /^send$/i }).first();
  }

  bodyEditor(): Locator {
    return this.root().getByRole('textbox', { name: /message body/i }).first();
  }

  /**
   * Recipient entry field in the compose header.
   * We intentionally avoid clicking the "To" button because it may open the contacts picker.
   *
   * This targets a textbox-like element associated with recipients entry.
   * In Outlook, this often has aria-label "To" and is contenteditable.
   */
  toInput(): Locator {
    return this.root()
      .locator('[aria-label="To"][contenteditable="true"]')
      .first();
  }

  /**
   * Floating suggestions list that appears when typing an email.
   */
  suggestionForEmail(email: string): Locator {
    // In your DOM: <button id="FloatingSuggestionsItemTo" role="option" aria-label="valcon.test2@outlook.com - ...">
    const escaped = email.replace(/"/g, '\\"');
    return this.page
      .locator('#FloatingSuggestionsList [role="option"]')
      .filter({ has: this.page.locator(`[aria-label*="${escaped}"]`) })
      .first()
      .or(
        this.page
          .locator('#FloatingSuggestionsList [role="option"]')
          .filter({ hasText: email })
          .first()
      );
  }

  async expectReady(): Promise<void> {
    await expect(this.root(), 'Expected composer root to be visible').toBeVisible();
    await expect(this.subjectInput(), 'Expected Subject input to be visible').toBeVisible();
    await expect(this.sendButton(), 'Expected Send button to be visible').toBeVisible();
    await expect(this.bodyEditor(), 'Expected body editor to be visible').toBeVisible();
  }

  async fillTo(recipientEmail: string): Promise<void> {
    // Focus the actual To input (NOT the "To" button that opens contacts picker)
    const input = this.toInput();

    await expect(input, 'Expected To input to be visible').toBeVisible({ timeout: 30_000 });
    await input.scrollIntoViewIfNeeded();
    await input.click();

    // Type email
    await this.page.keyboard.type(recipientEmail, { delay: 10 });

    // Wait for suggestion and select it (more reliable than pressing Enter blind)
    const suggestion = this.suggestionForEmail(recipientEmail);
    await expect(
      suggestion,
      `Expected recipient suggestion to appear for "${recipientEmail}"`
    ).toBeVisible({ timeout: 15_000 });

    await suggestion.click();

    // Small settle to allow pill creation
    await this.page.waitForTimeout(200);
  }

  async fillSubject(subject: string): Promise<void> {
    const input = this.subjectInput();
    await expect(input, 'Expected Subject input to be visible').toBeVisible();
    await input.fill(subject);
  }

  async fillBody(body: string): Promise<void> {
    const editor = this.bodyEditor();
    await expect(editor, 'Expected body editor to be visible').toBeVisible({ timeout: 30_000 });
    await editor.scrollIntoViewIfNeeded();
    await editor.click();
    await this.page.keyboard.type(body, { delay: 5 });
  }

  async clickSend(): Promise<void> {
    const btn = this.sendButton();
    await expect(btn, 'Expected Send button to be visible').toBeVisible();
    await btn.click();
  }

  async sendMail(to: string, subject: string, body: string): Promise<void> {
    await this.expectReady();
    await this.fillTo(to);
    await this.fillSubject(subject);
    await this.fillBody(body);
    await this.clickSend();

    await expect(this.root(), 'Expected composer to close after sending').toBeHidden({
      timeout: 30_000,
    });
  }
}
