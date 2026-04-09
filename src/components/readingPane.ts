import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS, mutableIntervals } from '../constants/timeouts';

export class ReadingPane {
  constructor(private readonly page: Page) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  replyAction(): Locator {
    return this.page
      .locator('[role="menuitem"][aria-label="Reply"]')
      .first();
  }

  replyBodyEditor(): Locator {
    return this.page
      .getByRole('textbox', { name: /message body/i })
      .first();
  }

  sendButton(): Locator {
    // Inline reply send button
    return this.page
      .getByRole('button', { name: /^send$/i })
      .first();
  }

  sentToast(): Locator {
    // Outlook often shows a transient "Sent" confirmation.
    return this.page
      .getByText(/^sent$/i)
      .first();
  }

  async replyAndSend(text: string): Promise<void> {
    const reply = this.replyAction();
    await expect(reply, 'Expected Reply action to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await reply.click();

    const editor = this.replyBodyEditor();
    await expect(editor, 'Expected reply body editor to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await editor.click();
    await this.page.keyboard.type(text, { delay: 5 });

    const send = this.sendButton();
    await expect(send, 'Expected Send button to be visible in reply').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await send.click();

    // Confirm the reply was sent by observing either a transient toast
    // or the inline editor disappearing.
    await expect
      .poll(
        async () => {
          const toast = await this.sentToast().isVisible().catch(() => false);
          const editorGone = await this.replyBodyEditor()
            .isVisible()
            .then(v => !v)
            .catch(() => true);

          return toast || editorGone;
        },
        { timeout: TIMEOUTS.UI_LONG, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(true);
  }

  deleteButton(): Locator {
    return this.page
      .getByRole('button', { name: /^delete$/i })
      .first();
  }

  archiveButton(): Locator {
    return this.page
      .getByRole('button', { name: /^archive$/i })
      .first();
  }

  async deleteOpenMessage(): Promise<void> {
    const btn = this.deleteButton();
    await expect(btn, 'Expected Delete button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await btn.click();
  }

  async archiveOpenMessage(): Promise<void> {
    const btn = this.archiveButton();
    await expect(btn, 'Expected Archive button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await btn.click();
  }

  moveToButton(): Locator {
    // Outlook command bar typically exposes either "Move to" or "Move".
    return this.page
      .getByRole('button', { name: /move to|move/i })
      .or(this.page.locator('[role="button"][aria-label*="move" i]'))
      .first();
  }

  private moveSurface(): Locator {
    // Scope move interactions to the popup/menu/dialog opened by the Move action.
    // This avoids accidentally matching the folder tree in the left sidebar.
    return this.page
      .locator(
        [
          '[role="menu"]',
          '[role="listbox"]',
          '[role="dialog"]',
          '[data-app-section*="Move" i]',
          '[aria-label*="Move" i]',
        ].join(', ')
      )
      .filter({
        has: this.page.locator('[role="menuitem"], [role="option"], [role="searchbox"], input'),
      })
      .last();
  }

  private async waitForMoveSurfaceToOpen(): Promise<void> {
    await expect
      .poll(
        async () => {
          const surface = this.moveSurface();

          const visible = await surface.isVisible().catch(() => false);
          if (visible) return true;

          const searchVisible = await surface
            .getByRole('searchbox')
            .first()
            .isVisible()
            .catch(() => false);

          if (searchVisible) return true;

          const optionVisible = await surface
            .locator('[role="menuitem"], [role="option"]')
            .first()
            .isVisible()
            .catch(() => false);

          return optionVisible;
        },
        { timeout: TIMEOUTS.UI_LONG, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(true);
  }

  moveToMenuFolderItem(folderName: string): Locator {
    const re = new RegExp(this.escapeRegex(folderName), 'i');
    const surface = this.moveSurface();

    return surface
      .getByRole('menuitem', { name: re })
      .or(surface.getByRole('option', { name: re }))
      .or(
        surface
          .locator('[role="menuitem"], [role="option"]')
          .filter({ hasText: re })
          .first()
      )
      .first();
  }

  moveToSearchBox(): Locator {
    const surface = this.moveSurface();

    // Some Outlook variants expose a searchable move dialog.
    return surface
      .getByRole('searchbox')
      .or(surface.getByRole('textbox', { name: /search/i }))
      .or(surface.locator('input[placeholder*="search" i]'))
      .first();
  }

  private async waitForMoveActionToFinish(folderName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const surfaceVisible = await this.moveSurface().isVisible().catch(() => false);
          if (!surfaceVisible) return false;

          const itemStillVisible = await this.moveToMenuFolderItem(folderName)
            .isVisible()
            .catch(() => false);

          return surfaceVisible || itemStillVisible;
        },
        { timeout: TIMEOUTS.UI_LONG, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(false);
  }

  /**
   * Branch 1: folder is already listed in the move surface (menu / listbox variant).
   * Returns true if the move was completed, false if the folder was not visible.
   */
  private async _moveViaDirectItem(folderName: string): Promise<boolean> {
    const item = this.moveToMenuFolderItem(folderName);
    if (!(await item.isVisible().catch(() => false))) return false;
    await item.click();
    await this.waitForMoveActionToFinish(folderName);
    return true;
  }

  /**
   * Branch 2: folder is not directly visible; use the searchable move dialog.
   * Fires when the move surface exposes a search box instead of a flat list.
   */
  private async _moveViaSearch(folderName: string): Promise<void> {
    const search = this.moveToSearchBox();
    await expect(search, 'Expected move-to search input to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await search.click();
    await search.fill(folderName);

    const item = this.moveToMenuFolderItem(folderName);
    await expect(item, `Expected folder option to appear: "${folderName}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await item.click();
    await this.waitForMoveActionToFinish(folderName);
  }

  // -----------------------------------------------
  // Forward
  // -----------------------------------------------

  private forwardAction(): Locator {
    return this.page
      .locator('[role="menuitem"][aria-label="Forward"]')
      .or(this.page.getByRole('button', { name: /^forward$/i }))
      .or(this.page.getByRole('menuitem', { name: /^forward$/i }))
      .first();
  }

  /**
   * Forward the open message to `to`, appending `bodyText` in the compose body.
   * Reuses the inline compose editor that Outlook opens for both reply and forward.
   */
  async forwardAndSend(to: string, bodyText: string): Promise<void> {
    const fwd = this.forwardAction();
    await expect(fwd, 'Expected Forward action to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await fwd.click();

    // Fill recipient in the inline forward compose To field.
    const toInput = this.page
      .locator('[aria-label="To"][contenteditable="true"]')
      .first();
    await expect(toInput, 'Expected To field in forward to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await toInput.click();
    await this.page.keyboard.type(to, { delay: 10 });

    // Accept email suggestion if visible, otherwise commit with Enter.
    const escaped = to.replace(/"/g, '\\"');
    const suggestion = this.page
      .locator('#FloatingSuggestionsList [role="option"]')
      .filter({ has: this.page.locator(`[aria-label*="${escaped}"]`) })
      .first()
      .or(
        this.page
          .locator('#FloatingSuggestionsList [role="option"]')
          .filter({ hasText: to })
          .first()
      );
    if (await suggestion.isVisible().catch(() => false)) {
      await suggestion.click();
    } else {
      await toInput.press('Enter');
    }
    await this.page.waitForTimeout(200); // settle after recipient pill creation

    // Type unique body text so the forwarded message can be found by token.
    if (bodyText) {
      const editor = this.replyBodyEditor();
      await expect(editor, 'Expected body editor in forward to be visible').toBeVisible({
        timeout: TIMEOUTS.UI_LONG,
      });
      await editor.click();
      await this.page.keyboard.type(bodyText, { delay: 5 });
    }

    const send = this.sendButton();
    await expect(send, 'Expected Send button to be visible in forward').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await send.click();

    // Confirm sent via toast or editor disappearing.
    await expect
      .poll(
        async () => {
          const toast = await this.sentToast().isVisible().catch(() => false);
          const editorGone = await this.replyBodyEditor()
            .isVisible()
            .then((v) => !v)
            .catch(() => true);
          return toast || editorGone;
        },
        { timeout: TIMEOUTS.UI_LONG, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(true);
  }

  // -----------------------------------------------
  // Mark as read / unread
  // -----------------------------------------------

  /**
   * "More actions" / "..." overflow button in the reading pane command bar.
   * Some Outlook variants put mark-read/unread here instead of the top-level bar.
   */
  private moreActionsButton(): Locator {
    return this.page
      .locator('[role="main"]')
      .getByRole('button', { name: /more actions|more options/i })
      .or(this.page.locator('[role="main"] [aria-label*="more actions" i]'))
      .first();
  }

  private markReadUnreadAction(namePattern: RegExp): Locator {
    // Scope to the ribbon tab panel to avoid matching "Mark as read" dot buttons
    // inside the message list rows (which share the same aria name but are a
    // different control and cause the wrong message to be toggled).
    // The ribbon always exposes a "Read / Unread" toggle when a message is selected,
    // so prefer that as the primary target regardless of namePattern.
    const ribbon = this.page.locator('[role="tabpanel"]');
    const readingPane = this.page.locator('[role="main"]');
    return ribbon
      .getByRole('button', { name: /^read \/ unread$/i })
      .or(ribbon.getByRole('button', { name: namePattern }))
      .or(ribbon.getByRole('menuitem', { name: namePattern }))
      .or(readingPane.getByRole('button', { name: namePattern }))
      .or(readingPane.getByRole('menuitem', { name: namePattern }))
      .first();
  }

  async markAsUnread(): Promise<void> {
    const action = this.markReadUnreadAction(/mark as unread/i);
    // If not directly visible, try the overflow menu.
    if (!(await action.isVisible().catch(() => false))) {
      const overflow = this.moreActionsButton();
      if (await overflow.isVisible().catch(() => false)) await overflow.click();
    }
    await expect(action, 'Expected "Mark as unread" action to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await action.click();
  }

  async markAsRead(): Promise<void> {
    const action = this.markReadUnreadAction(/mark as read/i);
    // If not directly visible, try the overflow menu.
    if (!(await action.isVisible().catch(() => false))) {
      const overflow = this.moreActionsButton();
      if (await overflow.isVisible().catch(() => false)) await overflow.click();
    }
    await expect(action, 'Expected "Mark as read" action to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await action.click();
  }

  async moveOpenMessageToFolder(folderName: string): Promise<void> {
    const btn = this.moveToButton();
    await expect(btn, 'Expected Move button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await btn.click();

    await this.waitForMoveSurfaceToOpen();

    // Branch 1: folder already visible in the move surface.
    if (await this._moveViaDirectItem(folderName)) return;

    // Branch 2: folder not visible — fall back to the searchable dialog.
    await this._moveViaSearch(folderName);
  }
}