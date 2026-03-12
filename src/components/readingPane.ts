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

  async moveOpenMessageToFolder(folderName: string): Promise<void> {
    const btn = this.moveToButton();
    await expect(btn, 'Expected Move button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await btn.click();

    await this.waitForMoveSurfaceToOpen();

    // Prefer selecting the folder directly if it is already visible in the move surface.
    const directItem = this.moveToMenuFolderItem(folderName);
    if (await directItem.isVisible().catch(() => false)) {
      await directItem.click();
      await this.waitForMoveActionToFinish(folderName);
      return;
    }

    // Fallback for searchable move dialogs.
    const search = this.moveToSearchBox();
    await expect(search, 'Expected move-to search input to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await search.click();
    await search.fill(folderName);

    const itemAfterSearch = this.moveToMenuFolderItem(folderName);
    await expect(itemAfterSearch, `Expected folder option to appear: "${folderName}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await itemAfterSearch.click();
    await this.waitForMoveActionToFinish(folderName);
  }
}