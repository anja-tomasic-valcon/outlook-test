import { expect, Page } from '@playwright/test';
import { Folders } from '../components/folders';
import * as ToolbarModule from '../components/toolbar';
import type { Toolbar as ToolbarType } from '../components/toolbar';
import { Composer } from '../components/composer';
import { MessageList } from '../components/messageList';
import { ReadingPane } from '../components/readingPane';
import { SearchPanel } from '../components/searchPanel';

/**
 * OutlookPage composes page objects for the Outlook web app.
 * Note: Toolbar export can differ depending on TS module interop (named vs default).
 * This file resolves both to avoid runtime "is not a constructor" issues.
 */
const ToolbarCtor =
  ((ToolbarModule as any).Toolbar ?? (ToolbarModule as any).default) as new (page: Page) => ToolbarType;

export class OutlookPage {
  readonly page: Page;
  readonly folders: Folders;
  readonly toolbar: ToolbarType;
  readonly composer: Composer;
  readonly messages: MessageList;
  readonly readingPane: ReadingPane;
  readonly search: SearchPanel;
  readonly mailPath: string;

  constructor(page: Page, mailboxLabel: string, mailPath: string = '/mail/') {
    this.page = page;
    this.mailPath = mailPath;
    this.folders = new Folders(page, mailboxLabel);

    // Resolve Toolbar constructor in a module-interop safe way.
    this.toolbar = new ToolbarCtor(page);

    this.composer = new Composer(page);
    this.messages = new MessageList(page);
    this.readingPane = new ReadingPane(page);
    this.search = new SearchPanel(page);
  }

  async gotoMail(): Promise<void> {
    await this.page.goto(this.mailPath);
  }

  async expectAuthenticated(): Promise<void> {
    await this.folders.expectFolderTreePresent();
    await expect(this.page).not.toHaveURL(/login|signin|authorize/i);
  }
}