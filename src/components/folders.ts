import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../constants/timeouts';

export type FolderKey =
  | 'inbox'
  | 'junkemail'
  | 'drafts'
  | 'sentitems'
  | 'deleteditems'
  | 'archive'
  | 'conversationhistory'
  | 'notes';

export class Folders {
  static readonly DEFAULT_FOLDERS: readonly FolderKey[] = [
    'inbox',
    'junkemail',
    'drafts',
    'sentitems',
    'deleteditems',
    'archive',
    'conversationhistory',
    'notes',
  ] as const;

  private static readonly DATA_FOLDER_NAME: Record<FolderKey, string> = {
    inbox: 'inbox',
    junkemail: 'junk email',
    drafts: 'drafts',
    sentitems: 'sent items',
    deleteditems: 'deleted items',
    archive: 'archive',
    conversationhistory: 'conversation history',
    notes: 'notes',
  };

  constructor(
    private readonly page: Page,
    private readonly mailboxLabel: string
  ) {}

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private mailboxHeaderByLabel(): Locator {
    const labelRe = new RegExp(this.escapeRegex(this.mailboxLabel), 'i');
    return this.page
      .locator('[id^="primaryMailboxRoot_"][role="treeitem"]')
      .filter({ hasText: labelRe })
      .first();
  }

  private mailboxHeaderFallback(): Locator {
    return this.page
      .locator('[id^="primaryMailboxRoot_"][role="treeitem"]')
      .first();
  }

  private async mailboxHeader(): Promise<Locator> {
    const byLabel = this.mailboxHeaderByLabel();
    if (await byLabel.isVisible().catch(() => false)) return byLabel;

    const fallback = this.mailboxHeaderFallback();
    await expect(fallback, 'Expected mailbox header (fallback) to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    return fallback;
  }

  private async mailboxGroup(): Promise<Locator> {
    const header = await this.mailboxHeader();

    const headerId = await header.getAttribute('id');
    if (!headerId) throw new Error('Mailbox header id not found');

    const group = this.page
      .locator(`div[role="group"][aria-labelledby="${headerId}"]`)
      .first();

    await expect(group, 'Expected mailbox folder group to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    return group;
  }

  async expectFolderTreePresent(): Promise<void> {
    const tree = this.page
      .locator('[role="tree"]')
      .first();

    const anyMailboxRoot = this.page
      .locator('[id^="primaryMailboxRoot_"]')
      .first();

    await expect
      .poll(
        async () => {
          const treeVisible = await tree.isVisible().catch(() => false);
          const rootVisible = await anyMailboxRoot.isVisible().catch(() => false);
          return treeVisible || rootVisible;
        },
        { timeout: TIMEOUTS.UI_LONG, intervals: [500, 1000, 1500, 2000] }
      )
      .toBe(true);
  }

  private dataFolderName(key: FolderKey): string {
    return Folders.DATA_FOLDER_NAME[key];
  }

  async folder(key: FolderKey): Promise<Locator> {
    const group = await this.mailboxGroup();
    return group
      .locator(`[role="treeitem"][data-folder-name="${this.dataFolderName(key)}"]`)
      .first();
  }

  async selectedFolder(key: FolderKey): Promise<Locator> {
    const group = await this.mailboxGroup();
    return group
      .locator(`[role="treeitem"][data-folder-name="${this.dataFolderName(key)}"][aria-selected="true"]`)
      .first();
  }

  async expectDefaultFoldersVisible(): Promise<void> {
    for (const key of Folders.DEFAULT_FOLDERS) {
      const loc = await this.folder(key);
      await expect(loc, `Expected folder to be visible: "${key}"`).toBeVisible({
        timeout: TIMEOUTS.UI_LONG,
      });
    }
  }

  async expectAllMailboxFoldersVisible(): Promise<void> {
    const group = await this.mailboxGroup();
    const items = group.locator('[role="treeitem"][data-folder-name]');

    const count = await items.count();
    expect(count, 'Expected at least one mailbox folder to be present').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(items.nth(i), `Expected mailbox folder item #${i} to be visible`).toBeVisible({
        timeout: TIMEOUTS.UI_LONG,
      });
    }
  }

  async openFolder(key: FolderKey): Promise<void> {
    const loc = await this.folder(key);
    await expect(loc, `Folder not found to click: "${key}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await loc.click();
    await this.expectSelected(key);
  }

  async expectSelected(key: FolderKey): Promise<void> {
    const loc = await this.selectedFolder(key);
    await expect(loc, `Expected folder to be selected: "${key}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
  }

  async openInbox(): Promise<void> {
    await this.openFolder('inbox');
  }

  async openSentItems(): Promise<void> {
    await this.openFolder('sentitems');
  }

  // ----------------------------
  // Custom folders (by name)
  // ----------------------------

  /**
   * Prefer locating custom folders inside the mailbox group.
   * First try data-folder-name exact match; fallback to role/name match.
   */
  private async customFolderTreeItem(folderName: string): Promise<Locator> {
    const group = await this.mailboxGroup();

    const byDataAttr = group
      .locator(`[role="treeitem"][data-folder-name="${folderName}"]`)
      .first();

    if (await byDataAttr.isVisible().catch(() => false)) return byDataAttr;

    const nameRe = new RegExp(this.escapeRegex(folderName), 'i');
    return group
      .getByRole('treeitem', { name: nameRe })
      .first();
  }

  private async selectedCustomFolderTreeItem(folderName: string): Promise<Locator> {
    const group = await this.mailboxGroup();

    const byDataAttr = group
      .locator(`[role="treeitem"][data-folder-name="${folderName}"][aria-selected="true"]`)
      .first();

    if (await byDataAttr.isVisible().catch(() => false)) return byDataAttr;

    const nameRe = new RegExp(this.escapeRegex(folderName), 'i');
    return group
      .locator('[role="treeitem"][aria-selected="true"]')
      .filter({ hasText: nameRe })
      .first();
  }

  /**
   * Wait until the custom folder appears in the mailbox tree.
   */
  private async waitForCustomFolderToAppear(folderName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const item = await this.customFolderTreeItem(folderName);
          return await item.isVisible().catch(() => false);
        },
        { timeout: TIMEOUTS.UI_LONG, intervals: [500, 1000, 2000, 3000, 5000] }
      )
      .toBe(true);
  }

  private createFolderMenuItem(): Locator {
    return this.page
      .getByRole('menuitem', { name: /create new folder|new folder/i })
      .or(this.page.locator('[role="menuitem"][aria-label*="create new folder" i]'))
      .first();
  }

  /**
   * Folder name input must be scoped to the mailbox group so we never type into the global Search box.
   */
  private async folderNameInput(): Promise<Locator> {
    const group = await this.mailboxGroup();

    const scoped = group.locator(
      'input[aria-label*="folder" i], input[placeholder*="folder" i], input[type="text"], input'
    ).first();

    await expect(scoped, 'Expected folder name input (scoped to mailbox group) to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    return scoped;
  }

  private async tryOpenMailboxHeaderOverflowMenu(): Promise<boolean> {
    const header = await this.mailboxHeader();

    await expect(header, 'Expected mailbox header to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    // Hover is required in this Outlook variant to reveal the overflow button.
    await header.hover();

    const overflowButton = header
      .locator('button[aria-label*="more" i], button[title*="more" i], button[aria-label="More options"], button[aria-label="More actions"]')
      .first();

    if (await overflowButton.isVisible().catch(() => false)) {
      await overflowButton.click();
      return true;
    }

    const overflowFallback = this.page
      .locator('[role="treeitem"][id^="primaryMailboxRoot_"] button[aria-label*="more" i]')
      .first();

    if (await overflowFallback.isVisible().catch(() => false)) {
      await overflowFallback.click();
      return true;
    }

    return false;
  }

  /**
   * Creates a custom folder if it does not already exist.
   * Matches the observed UI: hover mailbox header -> click "..." -> "Create new folder".
   */
  async ensureCustomFolder(folderName: string): Promise<void> {
    const existing = await this.customFolderTreeItem(folderName);
    if (await existing.isVisible().catch(() => false)) return;

    const openedOverflow = await this.tryOpenMailboxHeaderOverflowMenu();

    if (!openedOverflow) {
      // Fallback to mailbox-header context menu if the overflow path is not available.
      const header = await this.mailboxHeader();
      await header.click({ button: 'right' });
    }

    const item = this.createFolderMenuItem();
    await expect(item, 'Expected "Create new folder" menu item to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
    await item.click();

    const input = await this.folderNameInput();

    // Typing is more reliable than fill for Outlook inline-rename inputs.
    await input.click();
    await input.press('Control+A').catch(() => {});
    await input.press('Meta+A').catch(() => {});
    await input.type(folderName, { delay: 20 });
    await input.press('Enter');

    await this.waitForCustomFolderToAppear(folderName);
  }

  async expectCustomFolderSelected(folderName: string): Promise<void> {
    const item = await this.selectedCustomFolderTreeItem(folderName);
    await expect(item, `Expected custom folder to be selected: "${folderName}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });
  }

  async openCustomFolder(folderName: string): Promise<void> {
    const item = await this.customFolderTreeItem(folderName);
    await expect(item, `Expected custom folder to be visible: "${folderName}"`).toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await item.click();
    await this.expectCustomFolderSelected(folderName);
  }
}