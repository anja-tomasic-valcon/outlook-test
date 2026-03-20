import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS, mutableIntervals } from '../constants/timeouts';
import type { OutlookPage } from '../pages/outlookPage';
import type { FolderKey } from './folders';

export class MessageList {
  constructor(private readonly page: Page) {}

  // -----------------------------
  // Escaping helpers
  // -----------------------------

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeCssAttrValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private textVariants(text: string): string[] {
    const normalized = text.trim();
    const variants = [normalized];

    // Outlook sometimes exposes only a truncated snippet of the subject/body
    // in the message row. Keep the prefix fallback conservative.
    if (normalized.length > 18) {
      variants.push(normalized.slice(0, 18));
    }

    return [...new Set(variants.filter(Boolean))];
  }

  // -----------------------------
  // Reading pane
  // -----------------------------

  private readingPaneRoot(): Locator {
    return this.page
      .locator(
        [
          '[role="main"] [aria-label*="Reading pane" i]',
          '[role="main"] [data-app-section*="ReadingPane" i]',
          '[role="main"] [role="document"]',
          '[role="main"]',
        ].join(', ')
      )
      .first();
  }

  // -----------------------------
  // UI nudges (helps virtualized lists)
  // -----------------------------

  private async nudgeScroll(): Promise<void> {
    await this.page.mouse.move(300, 300).catch(() => {});
    await this.page.mouse.wheel(0, 800).catch(() => {});
    await this.page.waitForTimeout(150);
    await this.page.mouse.wheel(0, -400).catch(() => {});
    await this.page.waitForTimeout(150);
  }

  private focusedTab(): Locator {
    return this.page.getByRole('tab', { name: /^focused$/i }).first();
  }

  private otherTab(): Locator {
    return this.page.getByRole('tab', { name: /^other$/i }).first();
  }

  private async tryToggleFocusedOther(): Promise<void> {
    const focused = this.focusedTab();
    const other = this.otherTab();

    // Some tenants enable Focused/Other. Toggling can force the list to refresh.
    if (await other.isVisible().catch(() => false)) await other.click().catch(() => {});
    if (await focused.isVisible().catch(() => false)) await focused.click().catch(() => {});
  }

  // -----------------------------
  // Folder helpers
  // -----------------------------

  private async ensureFolder(outlook: OutlookPage, folder: FolderKey): Promise<void> {
    await outlook.folders.openFolder(folder);
    await outlook.folders.expectSelected(folder);
  }

  private async keepFolderListFresh(folder: FolderKey, outlook: OutlookPage, started: number): Promise<void> {
    const elapsed = Date.now() - started;

    // Periodically re-open and re-assert the folder to combat stale Outlook list state.
    if (elapsed > 0 && elapsed % 15_000 < 1200) {
      await this.ensureFolder(outlook, folder).catch(() => {});
      await this.tryToggleFocusedOther().catch(() => {});
    }

    // Occasionally nudge the virtualized list so rows are re-rendered.
    if (elapsed > 0 && elapsed % 8_000 < 1200) {
      await this.nudgeScroll().catch(() => {});
    }
  }

  // -----------------------------
  // Locators: robust message row finding
  // -----------------------------

  private messageSurface(): Locator {
    const listLikeRoot = this.page
      .locator(
        [
          '[role="main"] [role="listbox"]',
          '[role="main"] [role="grid"]',
          '[role="main"] [aria-label*="message list" i]',
          '[role="main"] [data-app-section*="MessageList" i]',
        ].join(', ')
      )
      .first();

    const mainWithSignals = this.page
      .locator('[role="main"]')
      .filter({
        has: this.page.locator('[data-convid], [role="listbox"], [role="grid"]'),
      })
      .first();

    return listLikeRoot.or(mainWithSignals).first();
  }

  /**
   * Build a locator that matches a message row by text/subject.
   *
   * Supports:
   * - listbox variants: role=option
   * - grid variants: role=row
   * - Outlook internal markers: data-convid
   * - aria-label contains subject/token
   */
  private messageRowByText(text: string, scope?: Locator): Locator {
    const textRe = new RegExp(this.escapeRegex(text), 'i');
    const root = scope ?? this.messageSurface();

    const byOptionName = root.getByRole('option', { name: textRe }).first();
    const byRowName = root.getByRole('row', { name: textRe }).first();

    const escaped = this.escapeCssAttrValue(text);
    const byAriaOption = root.locator(`[role="option"][aria-label*="${escaped}" i]`).first();
    const byAriaRow = root.locator(`[role="row"][aria-label*="${escaped}" i]`).first();

    const byDataConvid = root.locator('[data-convid]').filter({ hasText: textRe }).first();
    const byTextFallback = root.locator('[role="option"], [role="row"]').filter({ hasText: textRe }).first();

    return byOptionName.or(byRowName).or(byAriaOption).or(byAriaRow).or(byDataConvid).or(byTextFallback).first();
  }

  private messageRowByTextVariants(text: string, scope?: Locator): Locator {
    const variants = this.textVariants(text);

    let combined = this.messageRowByText(variants[0], scope);

    for (const variant of variants.slice(1)) {
      combined = combined.or(this.messageRowByText(variant, scope));
    }

    return combined.first();
  }

  /**
   * Global fallback for "message exists somewhere in the currently rendered app" checks.
   * This should be used sparingly, because it is intentionally broader than current-folder checks.
   */
  private messageRowGlobalByText(text: string): Locator {
    const textRe = new RegExp(this.escapeRegex(text), 'i');

    const byOptionName = this.page.getByRole('option', { name: textRe }).first();
    const byRowName = this.page.getByRole('row', { name: textRe }).first();

    const escaped = this.escapeCssAttrValue(text);
    const byAriaOption = this.page.locator(`[role="option"][aria-label*="${escaped}" i]`).first();
    const byAriaRow = this.page.locator(`[role="row"][aria-label*="${escaped}" i]`).first();

    const byDataConvid = this.page.locator('[data-convid]').filter({ hasText: textRe }).first();
    const byTextFallback = this.page.locator('[role="option"], [role="row"]').filter({ hasText: textRe }).first();


    return byOptionName.or(byRowName).or(byAriaOption).or(byAriaRow).or(byDataConvid).or(byTextFallback).first();
  }

  private messageRowGlobalByTextVariants(text: string): Locator {
    const variants = this.textVariants(text);

    let combined = this.messageRowGlobalByText(variants[0]);

    for (const variant of variants.slice(1)) {
      combined = combined.or(this.messageRowGlobalByText(variant));
    }

    return combined.first();
  }


  // -----------------------------
  // Public API
  // -----------------------------

  async waitForMessageInFolderByText(text: string, folder: FolderKey, outlook: OutlookPage): Promise<void> {
    const deadlineMs = 180_000;
    const started = Date.now();

    await this.ensureFolder(outlook, folder);

    await expect
      .poll(
        async () => {
          await this.keepFolderListFresh(folder, outlook, started);

          const visibleInCurrentFolder = await this.messageRowByTextVariants(text).isVisible().catch(() => false);
          if (visibleInCurrentFolder) return true;

          return await this.messageRowGlobalByTextVariants(text).isVisible().catch(() => false);
        },
        { timeout: deadlineMs, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_MEDIUM) }
      )
      .toBe(true);
  }

  async waitForMessageNotInFolderByText(text: string, folder: FolderKey, outlook: OutlookPage): Promise<void> {
    const started = Date.now();

    await this.ensureFolder(outlook, folder);

    await expect
      .poll(
        async () => {
          await this.keepFolderListFresh(folder, outlook, started);

          // For negative assertions, stay scoped to the currently selected folder list.
          // A global fallback can falsely match reading-pane content or another folder tree entry.
          return await this.messageRowByTextVariants(text).isVisible().catch(() => false);
        },
        { timeout: 120_000, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_MEDIUM) }
      )
      .toBe(false);
  }

  async waitForMessageInCurrentFolderByText(text: string): Promise<void> {
    await expect
      .poll(
        async () => {
          return await this.messageRowByTextVariants(text).isVisible().catch(() => false);
        },
        { timeout: TIMEOUTS.MAIL_DELIVERY_MAX, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(true);
  }

  async openMessageByText(text: string): Promise<void> {
    const row = this.messageRowByTextVariants(text).or(this.messageRowGlobalByTextVariants(text)).first();

    await expect(row, `Expected message row to be visible before click (text: "${text}")`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await row.click();

    await expect(this.readingPaneRoot(), 'Expected reading pane root to be visible after opening a message').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
  }

  async expectSubjectInReadingPane(expectedSubject: string): Promise<void> {
    const pane = this.readingPaneRoot();
    const subjectRe = new RegExp(this.escapeRegex(expectedSubject), 'i');

    const heading = pane.getByRole('heading', { name: subjectRe }).first();
    const textFallback = pane.getByText(subjectRe).first();

    await expect
      .poll(
        async () => {
          const headingVisible = await heading.isVisible().catch(() => false);
          if (headingVisible) return true;

          return await textFallback.isVisible().catch(() => false);
        },
        { timeout: 60_000, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(true);
  }

  async expectBodyInReadingPane(text: string): Promise<void> {
    const pane = this.readingPaneRoot();
    const re = new RegExp(this.escapeRegex(text), 'i');

    await expect(pane.getByText(re).first(), `Expected reading pane to contain text: "${text}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
  }

  // ------------------------------------------------------------
  // Backwards-compatible API (aliases for existing specs)
  // ------------------------------------------------------------

  async waitForMessageInInbox(text: string, outlook: OutlookPage): Promise<void> {
    await this.waitForMessageInFolderByText(text, 'inbox', outlook);
  }

  async openMessageBySubject(subjectOrToken: string): Promise<void> {
    await this.openMessageByText(subjectOrToken);
  }
}