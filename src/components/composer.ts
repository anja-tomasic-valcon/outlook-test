import path from 'path';
import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../constants/timeouts';

export class Composer {
  constructor(private readonly page: Page) {}

  root(): Locator {
    return this.page.locator('[id^="docking_InitVisiblePart_"]');
  }

  subjectInput(): Locator {
    return this.root().locator('input[placeholder*="Add a subject"]').first();
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
    await expect(this.root(), 'Expected composer root to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await expect(this.subjectInput(), 'Expected Subject input to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await expect(this.sendButton(), 'Expected Send button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await expect(this.bodyEditor(), 'Expected body editor to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
  }

  /**
   * Types text into the To field and commits it with Tab, without waiting for
   * an autocomplete suggestion. Use this for invalid/malformed addresses where
   * no suggestion will appear.
   */
  async fillToRaw(text: string): Promise<void> {
    const input = this.toInput();
    await expect(input, 'Expected To input to be visible').toBeVisible({ timeout: TIMEOUTS.UI_LONG });
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await this.page.keyboard.type(text, { delay: 10 });
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(300);
  }

  async fillTo(recipientEmail: string): Promise<void> {
    const input = this.toInput();

    await expect(input, 'Expected To input to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await input.scrollIntoViewIfNeeded();
    await input.click();

    await this.page.keyboard.type(recipientEmail, { delay: 10 });

    const suggestion = this.suggestionForEmail(recipientEmail);
    await expect(
      suggestion,
      `Expected recipient suggestion to appear for "${recipientEmail}"`
    ).toBeVisible({ timeout: 15_000 });

    await suggestion.click();

    // Small settle to allow recipient pill creation.
    await this.page.waitForTimeout(200);
  }

  async fillSubject(subject: string): Promise<void> {
    const input = this.subjectInput();
    await expect(input, 'Expected Subject input to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await input.fill(subject);
  }

  async fillBody(body: string): Promise<void> {
    const editor = this.bodyEditor();
    await expect(editor, 'Expected body editor to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await editor.scrollIntoViewIfNeeded();
    await editor.click();
    await this.page.keyboard.type(body, { delay: 5 });
  }

  async clickSend(): Promise<void> {
    const btn = this.sendButton();
    await expect(btn, 'Expected Send button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await btn.click();
  }

  /**
   * Close the composer via the discard/close button and confirm the draft was saved.
   * Outlook auto-saves on close; this just triggers the close and waits for the
   * composer to disappear.
   */
  async saveDraftAndClose(): Promise<void> {
    const saveDraftBtn = this.root().getByRole('button', { name: /save draft/i }).first();
    if (await saveDraftBtn.isVisible().catch(() => false)) {
      await saveDraftBtn.click();
      await expect(this.root(), 'Expected composer to close after saving draft').toBeHidden({
        timeout: TIMEOUTS.UI_LONG,
      });
      return;
    }

    await this.page.keyboard.press('Control+S');

    await this.root()
      .getByText(/draft saved/i)
      .first()
      .waitFor({ state: 'visible', timeout: TIMEOUTS.UI_MEDIUM })
      .catch(() => {});

    const composeTabCloseBtn = this.page
      .locator('[role="tablist"] button:not([role="tab"])')
      .last();

    if (await composeTabCloseBtn.isVisible().catch(() => false)) {
      await composeTabCloseBtn.click();

      const discardDialog = this.page.getByRole('dialog', { name: /discard/i });
      if (await discardDialog.isVisible().catch(() => false)) {
        await discardDialog.getByRole('button', { name: /^cancel$/i }).click();
      }
    } else {
      await this.page.keyboard.press('Escape');
    }

    await expect(this.root(), 'Expected composer to close after saving draft').toBeHidden({
      timeout: TIMEOUTS.UI_LONG,
    });
  }

  /**
   * In Outlook web the compose editor lives in the reading pane area,
   * but the attachment action is often rendered in the ribbon above it.
   * Because of that, this locator must not be scoped only to the compose root.
   */
  attachButton(): Locator {
    return this.page
      .getByRole('button', { name: /^Attach file$/i })
      .or(this.page.getByRole('button', { name: /attach/i }))
      .first();
  }

  /**
   * Attaches a local file to the composed message.
   * Handles both direct file chooser opening and the Outlook dropdown variant
   * ("From this device" / "Browse this computer").
   */
  async attachFile(filePath: string): Promise<void> {
    const btn = this.attachButton();

    await expect(btn, 'Expected Attach file button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await btn.click();

    const fromDevice = this.page
      .getByRole('menuitem', { name: /from this device|browse this computer/i })
      .first();

    if (await fromDevice.isVisible().catch(() => false)) {
      await fromDevice.click();
    }

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);

    const fileName = path.basename(filePath);

    // Wait for a simple visible signal that the attachment was actually added.
    await expect(
      this.page.getByText(fileName, { exact: false }).first(),
      `Expected attached filename "${fileName}" to become visible in compose UI`
    ).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
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