import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../constants/timeouts';
import type { OutlookPage } from '../pages/outlookPage';
import type { FolderKey } from './folders';

export class MessageList {
  constructor(private readonly page: Page) {}

  // -----------------------------
  // Helpers: escaping
  // -----------------------------

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeCssAttrValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
  // Message list root (robust)
  // -----------------------------

  /**
   * Outlook can render multiple "main" regions (e.g., nav, content, overlays).
   * Do NOT rely on `[role="main"].first()`.
   * Instead, pick a main region that actually contains the message list.
   */
  private mainWithMessageList(): Locator {
    return this.page
      .locator('[role="main"]')
      .filter({
        has: this.page.locator('[role="listbox"], [role="grid"]'),
      })
      .first();
  }

  /**
   * Message list can be either a listbox (options) or a grid (rows).
   */
  private messageListRoot(): Locator {
    const main = this.mainWithMessageList();
    return main.locator('[role="listbox"], [role="grid"]').first();
  }

  /**
   * Message rows can be exposed as role=option (listbox) OR role=row (grid).
   */
  private messageRows(root?: Locator): Locator {
    const base = root ?? this.messageListRoot();
    return base.locator('[role="option"], [role="row"]');
  }

  /**
   * GLOBAL locator: use accessible name / text across the whole page.
   * Good for: "message exists somewhere" checks.
   *
   * NOTE: Keep global matching flexible, but still prefer message roles.
   */
  private messageRowGlobalByText(text: string): Locator {
    const textRe = new RegExp(this.escapeRegex(text), 'i');

    // Prefer role-based matching
    const byOptionName = this.page.getByRole('option', { name: textRe }).first();
    const byRowName = this.page.getByRole('row', { name: textRe }).first();

    // Fallback: aria-label contains
    const escaped = this.escapeCssAttrValue(text);
    const byAriaLabelOption = this.page.locator(`[role="option"][aria-label*="${escaped}" i]`).first();
    const byAriaLabelRow = this.page.locator(`[role="row"][aria-label*="${escaped}" i]`).first();

    // Last resort: text within common message row containers
    const byTextFallback = this.page
      .locator('[role="option"], [role="row"], [data-convid]')
      .filter({ hasText: textRe })
      .first();

    return byOptionName.or(byRowName).or(byAriaLabelOption).or(byAriaLabelRow).or(byTextFallback);
  }

  /**
   * Find the active message list container (listbox or grid).
   * Outlook can have multiple in DOM; we pick the one that is visible and has most visible rows.
   */
  private async activeMessageListRoot(): Promise<Locator> {
    const containers = this.page.locator('[role="main"] [role="listbox"], [role="main"] [role="grid"]');
    const count = await containers.count();

    if (count === 0) {
      // Fallback: if Outlook variant doesn't expose listbox/grid, use a main that exists
      return this.page.locator('[role="main"]').first();
    }

    let bestIdx = 0;
    let bestScore = -1;

    for (let i = 0; i < count; i++) {
      const c = containers.nth(i);
      const visible = await c.isVisible().catch(() => false);
      if (!visible) continue;

      const rows = this.messageRows(c);
      // Count is cheap; if virtualization hides rows, we still might see a small count,
      // but this is better than picking an invisible container.
      const rowCount = await rows.count().catch(() => 0);

      if (rowCount > bestScore) {
        bestScore = rowCount;
        bestIdx = i;
      }
    }

    return containers.nth(bestIdx);
  }

  /**
   * SCOPED locator: searches only inside the currently active message list container.
   * Good for: folder-specific assertions like "not in Inbox anymore".
   */
  private async messageRowInActiveListByText(text: string): Promise<Locator> {
    const textRe = new RegExp(this.escapeRegex(text), 'i');
    const root = await this.activeMessageListRoot();

    // Prefer role-based matching inside the active container
    const byOptionName = root.getByRole('option', { name: textRe }).first();
    const byRowName = root.getByRole('row', { name: textRe }).first();

    // aria-label contains fallback
    const escaped = this.escapeCssAttrValue(text);
    const byAriaLabelOption = root.locator(`[role="option"][aria-label*="${escaped}" i]`).first();
    const byAriaLabelRow = root.locator(`[role="row"][aria-label*="${escaped}" i]`).first();

    // text fallback (covers odd DOM shapes)
    const byTextFallback = root
      .locator('[role="option"], [role="row"], [data-convid]')
      .filter({ hasText: textRe })
      .first();

    return byOptionName.or(byRowName).or(byAriaLabelOption).or(byAriaLabelRow).or(byTextFallback);
  }

  // -----------------------------
  // Focused/Other tabs helpers
  // -----------------------------

  private focusedTab(): Locator {
    return this.page.getByRole('tab', { name: /^focused$/i }).first();
  }

  private otherTab(): Locator {
    return this.page.getByRole('tab', { name: /^other$/i }).first();
  }

  private async tryToggleFocusedOther(): Promise<void> {
    const focused = this.focusedTab();
    const other = this.otherTab();

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

  // -----------------------------
  // Small UI nudges
  // -----------------------------

  private async nudgeScroll(): Promise<void> {
    await this.page.mouse.move(300, 300).catch(() => {});
    await this.page.mouse.wheel(0, 800).catch(() => {});
    await this.page.waitForTimeout(150);
    await this.page.mouse.wheel(0, -400).catch(() => {});
    await this.page.waitForTimeout(150);
  }

  /**
   * Wait until at least one message row is rendered in the active container.
   * This guards against cases where Outlook loads the list async or the wrong container is targeted.
   */
  private async expectAnyRowRendered(): Promise<void> {
    const root = await this.activeMessageListRoot();
    const anyRow = this.messageRows(root).first();

    await expect(anyRow, 'Expected at least one message row (role="option" or role="row") to be rendered').toBeVisible({
      timeout: 30_000,
    });
  }

  // -----------------------------
  // Public API
  // -----------------------------

  async waitForMessageInFolderByText(text: string, folder: FolderKey, outlook: OutlookPage): Promise<void> {
    const deadlineMs = 180_000;
    const started = Date.now();

    await this.ensureFolder(outlook, folder);
    await this.expectAnyRowRendered().catch(() => {});

    // For "exists" checks we can be flexible: global match is OK, but we still prefer active list.
    await expect
      .poll(
        async () => {
          const elapsed = Date.now() - started;

          // Periodically re-assert folder selection and toggle Focused/Other.
          if (elapsed > 0 && elapsed % 15_000 < 1200) {
            await this.ensureFolder(outlook, folder).catch(() => {});
            await this.tryToggleFocusedOther().catch(() => {});
          }

          // Periodically nudge scroll to help virtualized lists render.
          if (elapsed > 0 && elapsed % 8_000 < 1200) {
            await this.nudgeScroll().catch(() => {});
          }

          const inActive = await (await this.messageRowInActiveListByText(text)).isVisible().catch(() => false);
          if (inActive) return true;

          // Fallback: global (sometimes active list detection is imperfect early on)
          return await this.messageRowGlobalByText(text).isVisible().catch(() => false);
        },
        { timeout: deadlineMs, intervals: [1000, 2000, 3000, 5000, 8000] }
      )
      .toBe(true);
  }

  async waitForMessageNotInFolderByText(text: string, folder: FolderKey, outlook: OutlookPage): Promise<void> {
    await this.ensureFolder(outlook, folder);
    await this.expectAnyRowRendered().catch(() => {});

    // For "NOT in folder", we MUST scope to active list.
    await expect
      .poll(
        async () => {
          const row = await this.messageRowInActiveListByText(text);
          return await row.isVisible().catch(() => false);
        },
        { timeout: 120_000, intervals: [1000, 2000, 3000, 5000, 8000] }
      )
      .toBe(false);
  }

  async openMessageByText(text: string): Promise<void> {
    const row = await this.messageRowInActiveListByText(text);

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
          const h = await heading.isVisible().catch(() => false);
          if (h) return true;
          return await textFallback.isVisible().catch(() => false);
        },
        { timeout: 60_000, intervals: [500, 1000, 2000, 3000] }
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