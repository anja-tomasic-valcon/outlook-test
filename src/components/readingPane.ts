import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../constants/timeouts';

export class ReadingPane {
  constructor(private readonly page: Page) {}

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

    // Confirm it was actually sent: either toast appears OR editor disappears.
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
        { timeout: TIMEOUTS.UI_LONG, intervals: [500, 1000, 1500, 2000] }
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
    // Outlook command bar typically has "Move to" or "Move" button.
    return this.page
      .getByRole('button', { name: /move to|move/i })
      .or(this.page.locator('[role="button"][aria-label*="move" i]'))
      .first();
  }

  moveToMenuFolderItem(folderName: string): Locator {
    const re = new RegExp(folderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return this.page
      .getByRole('menuitem', { name: re })
      .or(this.page.getByRole('option', { name: re }))
      .or(this.page.getByText(re).first());
  }

  moveToSearchBox(): Locator {
    // Some UIs show a searchable move dialog
    return this.page
      .getByRole('searchbox')
      .or(this.page.getByRole('textbox', { name: /search/i }))
      .or(this.page.locator('input[placeholder*="search" i]'))
      .first();
  }

  async moveOpenMessageToFolder(folderName: string): Promise<void> {
    const btn = this.moveToButton();
    await expect(btn, 'Expected Move button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await btn.click();

    // Try direct menu item click first
    const item = this.moveToMenuFolderItem(folderName);
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      return;
    }

    // Fallback: searchable move dialog (type folder and select)
    const search = this.moveToSearchBox();
    await expect(search, 'Expected move-to search input to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await search.fill(folderName);

    const itemAfterSearch = this.moveToMenuFolderItem(folderName);
    await expect(itemAfterSearch, `Expected folder option to appear: "${folderName}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await itemAfterSearch.click();
  }
}