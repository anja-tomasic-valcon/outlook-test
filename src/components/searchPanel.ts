import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS, mutableIntervals } from '../constants/timeouts';

export class SearchPanel {
  constructor(private readonly page: Page) {}

  searchBox(): Locator {
    return this.page
      .getByRole('searchbox')
      .or(this.page.getByRole('textbox', { name: /search/i }))
      .or(this.page.locator('input[placeholder*="search" i], input[aria-label*="search" i]'))
      .first();
  }

  clearButton(): Locator {
    return this.page
      .getByRole('button', { name: /clear search|clear/i })
      .or(this.page.locator('button[aria-label*="clear" i]'))
      .first();
  }

  private loadingIndicators(): Locator {
    return this.page.locator(
      [
        '[role="progressbar"]',
        '[aria-busy="true"]',
        '[data-automationid*="loading" i]',
        '[data-app-section*="loading" i]',
      ].join(', ')
    );
  }

  private async waitForSearchUiToSettle(): Promise<void> {
    await expect
      .poll(
        async () => {
          const search = this.searchBox();
          const searchVisible = await search.isVisible().catch(() => false);
          if (!searchVisible) return false;

          const loadingVisible = await this.loadingIndicators().first().isVisible().catch(() => false);
          return !loadingVisible;
        },
        { timeout: TIMEOUTS.SEARCH_VISIBLE, intervals: mutableIntervals(TIMEOUTS.POLL_INTERVALS_SHORT) }
      )
      .toBe(true);
  }

  async search(query: string): Promise<void> {
    const box = this.searchBox();

    await expect(box, 'Expected search box to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await box.click();
    await box.press('Control+A').catch(() => {});
    await box.press('Meta+A').catch(() => {});
    await box.fill(query);

    // Some Outlook variants search on typing, some on Enter.
    await box.press('Enter').catch(() => {});

    await expect(box, 'Expected search query to be present in the search box').toHaveValue(query, {
      timeout: TIMEOUTS.SEARCH_VISIBLE,
    });

    await this.waitForSearchUiToSettle().catch(() => {});
  }

  async clearSearch(): Promise<void> {
    const box = this.searchBox();

    await expect(box, 'Expected search box to be visible before clearing').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    const clear = this.clearButton();
    if (await clear.isVisible().catch(() => false)) {
      await clear.click();
    } else {
      await box.click();
      await box.press('Control+A').catch(() => {});
      await box.press('Meta+A').catch(() => {});
      await box.fill('');
      await box.press('Enter').catch(() => {});
    }

    await expect(box, 'Expected search box to be empty after clearing').toHaveValue('', {
      timeout: TIMEOUTS.SEARCH_VISIBLE,
    });
  }
}