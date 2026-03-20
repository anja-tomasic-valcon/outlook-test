import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../constants/timeouts';
import { addMinutes, formatDateLike, formatTimeLike } from '../utils/calendarUtils';

export class Calendar {
  constructor(private readonly page: Page) {}

  // Open Calendar view. Prefer the nav button, fall back to direct navigation.
  async openWorkWeekView(): Promise<void> {
    const navBtn = this.page.getByRole('button', { name: /calendar/i }).first();

    if (await navBtn.isVisible().catch(() => false)) {
      await navBtn.click();
    } else {
      await this.page.goto('/calendar/');
    }

    await expect(
      this.newEventButton(),
      'Expected New event button in calendar view'
    ).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  }

  newEventButton(): Locator {
    return this.page.getByRole('button', { name: /new event/i }).first();
  }

  private newEventMenuItem(): Locator {
    return this.page.getByRole('menuitem', { name: /^event$/i }).first();
  }

  private newEventMenuButton(): Locator {
    return this.page.getByRole('button', { name: /^event$/i }).first();
  }

  /**
   * The actual open composer dialog.
   * Scope every event-form locator to this container.
   */
  composer(): Locator {
    return this.page
      .locator('[role="dialog"]:visible')
      .filter({
        has: this.page.getByRole('button', { name: /^save$/i }),
      })
      .last();
  }

  saveButton(scope?: Locator): Locator {
    const root = scope ?? this.composer();
    return root.getByRole('button', { name: /^save$/i }).first();
  }

  private titleFieldCandidates(scope: Locator): Locator[] {
    return [
      scope.locator('input[placeholder="Add a title"]'),
      scope.locator('input[aria-label="Add details for the event"]'),
      scope.locator('textarea[placeholder="Add a title"]'),
      scope.locator('textarea[aria-label="Add details for the event"]'),
      scope.locator('[role="textbox"][aria-label="Add details for the event"]'),
      scope.locator('[contenteditable="true"][aria-label="Add details for the event"]'),
      scope.locator('[contenteditable="true"][data-text="true"]'),
    ];
  }

  private titleActivatorCandidates(scope: Locator): Locator[] {
    return [
      scope.getByPlaceholder('Add a title'),
      scope.getByLabel(/add details for the event/i),
      scope.getByText(/^Add a title$/i),
      scope.getByText(/add a title/i),
    ];
  }

  private focusedElement(scope: Locator): Locator {
    return scope.locator('*:focus');
  }

  private async isEditable(locator: Locator): Promise<boolean> {
    const tagName = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const role = await locator.getAttribute('role').catch(() => null);
    const contentEditable = await locator.getAttribute('contenteditable').catch(() => null);

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      role === 'textbox' ||
      contentEditable === 'true'
    );
  }

  private async findFirstVisible(candidates: Locator[]): Promise<Locator | null> {
    for (const collection of candidates) {
      const count = await collection.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const candidate = collection.nth(i);

        if (await candidate.isVisible().catch(() => false)) {
          return candidate;
        }
      }
    }

    return null;
  }

  private async resolveVisibleTitleField(scope?: Locator): Promise<Locator | null> {
    // Prefer searching inside provided scope (typically composer), but fall back
    // to page-level stable locators if the composer container is not present.
    const root = scope ?? this.composer();

    let visibleField = await this.findFirstVisible(this.titleFieldCandidates(root));
    if (visibleField) {
      return visibleField;
    }

    // Fallback to page-level candidates (some Outlook variants render title outside the dialog container)
    const pageCandidates: Locator[] = [
      this.page.locator('input[placeholder="Add title"]'),
      this.page.locator('input[aria-label="Add details for the event"]'),
      this.page.locator('textarea[placeholder="Add title"]'),
      this.page.locator('textarea[aria-label="Add details for the event"]'),
      this.page.locator('[role="textbox"][aria-label="Add details for the event"]'),
      this.page.locator('[contenteditable="true"][aria-label="Add details for the event"]'),
    ];

    visibleField = await this.findFirstVisible(pageCandidates);
    if (visibleField) return visibleField;

    // Focused element fallback (scope first, then page)
    const focusedInRoot = this.focusedElement(root);
    if (
      (await focusedInRoot.count().catch(() => 0)) > 0 &&
      (await focusedInRoot.isVisible().catch(() => false)) &&
      (await this.isEditable(focusedInRoot))
    ) {
      return focusedInRoot;
    }

    const focusedGlobal = this.focusedElement(this.page.locator('body'));
    if (
      (await focusedGlobal.count().catch(() => 0)) > 0 &&
      (await focusedGlobal.isVisible().catch(() => false)) &&
      (await this.isEditable(focusedGlobal))
    ) {
      return focusedGlobal;
    }

    return null;
  }

  /**
   * Compact schedule summary inside the composer before schedule editor is expanded.
   * Example: "Fri 3/13/2026 2:00 PM - 2:30 PM"
   */
  scheduleSummary(scope?: Locator): Locator {
    const root = scope ?? this.composer();

    return root
      .getByText(
        /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b.*\d{1,2}\/\d{1,2}\/\d{4}.*\d{1,2}:\d{2}\s?(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s?(?:AM|PM)/i
      )
      .first();
  }

  startDateInput(scope?: Locator): Locator {
    const root = scope ?? this.composer();
    return root.getByRole('combobox', { name: /^start date$/i }).first();
  }

  startTimeInput(scope?: Locator): Locator {
    const root = scope ?? this.composer();
    return root.getByRole('combobox', { name: /^start time$/i }).first();
  }

  endDateInput(scope?: Locator): Locator {
    const root = scope ?? this.composer();
    return root.getByRole('combobox', { name: /^end date$/i }).first();
  }

  endTimeInput(scope?: Locator): Locator {
    const root = scope ?? this.composer();
    return root.getByRole('combobox', { name: /^end time$/i }).first();
  }

  private async areScheduleInputsVisible(scope?: Locator): Promise<boolean> {
    const root = scope ?? this.composer();

    const startDateVisible = await this.startDateInput(root).isVisible().catch(() => false);
    const startTimeVisible = await this.startTimeInput(root).isVisible().catch(() => false);
    const endDateVisible = await this.endDateInput(root).isVisible().catch(() => false);
    const endTimeVisible = await this.endTimeInput(root).isVisible().catch(() => false);

    return startDateVisible && startTimeVisible && endDateVisible && endTimeVisible;
  }

  private async isEventFormOpen(): Promise<boolean> {
    // Detect open form by presence of stable, visible controls anywhere on the page.
    // Do not rely solely on the dialog container (composer) because some UI variants
    // render the inputs without a predictable dialog structure.
    const saveVisible = await this.page.getByRole('button', { name: /^save$/i }).first().isVisible().catch(() => false);
    const titleVisible = await this.page.getByPlaceholder('Add title').first().isVisible().catch(() => false);
    const altTitleVisible = await this.page.getByLabel(/add details for the event/i).first().isVisible().catch(() => false);
    const startDateVisible = await this.page.getByRole('combobox', { name: /^start date$/i }).first().isVisible().catch(() => false);
    const startTimeVisible = await this.page.getByRole('combobox', { name: /^start time$/i }).first().isVisible().catch(() => false);

    // Compact schedule summary is also an indicator; search globally for a date+time pattern
    const summaryVisible = await this.page
      .getByText(/\d{1,2}\/\d{1,2}\/\d{4}.*\d{1,2}:\d{2}/i)
      .first()
      .isVisible()
      .catch(() => false);

    return saveVisible || titleVisible || altTitleVisible || (startDateVisible && startTimeVisible) || summaryVisible;
  }

  private async waitForEventForm(): Promise<void> {
    await expect
      .poll(
        async () => {
          return this.isEventFormOpen();
        },
        {
          timeout: TIMEOUTS.UI_LONG,
          message: 'Expected event form to open',
        }
      )
      .toBeTruthy();

    // After the global indicators pass, prefer to assert on stable elements rather than
    // assuming a dialog container exists. If a composer container is present and visible,
    // assert it; otherwise ensure at least one stable control is visible.
    const composer = this.composer();
    if (await composer.isVisible().catch(() => false)) {
      await expect(composer, 'Expected visible New event composer dialog').toBeVisible({ timeout: TIMEOUTS.UI_LONG });
      return;
    }

    // Composer not present; ensure Save or title or start-date is visible as a safety net.
    await expect(this.page.getByRole('button', { name: /^save$/i }).first()).toBeVisible({ timeout: TIMEOUTS.UI_LONG }).catch(async () => {
      await expect(this.page.getByPlaceholder('Add title').first()).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
    });
  }

  private async setInputValue(input: Locator, value: string): Promise<void> {
    await expect(input).toBeVisible({ timeout: TIMEOUTS.UI_MEDIUM });
    await input.click();
    await input.press('ControlOrMeta+A');
    await input.fill(value);
    await input.press('Tab');
  }

  private async fillTitleField(field: Locator, value: string): Promise<void> {
    await expect(field, 'Expected title field to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    const tagName = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    const contentEditable = await field.getAttribute('contenteditable').catch(() => null);
    const role = await field.getAttribute('role').catch(() => null);

    await field.click();

    if (tagName === 'input' || tagName === 'textarea') {
      await field.fill(value);
      return;
    }

    if (contentEditable === 'true' || role === 'textbox') {
      await this.page.keyboard.press('ControlOrMeta+A').catch(() => {});
      await this.page.keyboard.type(value);
      return;
    }

    await field.fill(value);
  }

  /**
   * Click the New event control.
   * Some Outlook variants open the form directly.
   * Some open a split-button menu where Event must be selected.
   */
  async clickNewEvent(): Promise<void> {
    const btn = this.newEventButton();

    await expect(btn, 'Expected New event button to be visible').toBeVisible({
      timeout: TIMEOUTS.UI_MEDIUM,
    });

    await btn.click();
    await this.page.waitForTimeout(400);

    if (!(await this.isEventFormOpen())) {
      const menuItem = this.newEventMenuItem();
      const eventButton = this.newEventMenuButton();

      if (await menuItem.isVisible().catch(() => false)) {
        await menuItem.click();
      } else if (await eventButton.isVisible().catch(() => false)) {
        await eventButton.click();
      }
    }

    await this.waitForEventForm();
  }

  /**
   * Set the event title.
   * Works for input, textarea, role=textbox and contenteditable variants.
   */
  async setTitle(title: string): Promise<void> {
    const composer = this.composer();

    let visibleField = await this.resolveVisibleTitleField(composer);

    if (visibleField) {
      await this.fillTitleField(visibleField, title);
      return;
    }

    const activator = await this.findFirstVisible(this.titleActivatorCandidates(composer));

    if (activator) {
      await activator.click();

      await expect
        .poll(
          async () => {
            return (await this.resolveVisibleTitleField(composer)) !== null;
          },
          {
            timeout: TIMEOUTS.UI_LONG,
            message: 'Expected title field to appear after activating title area',
          }
        )
        .toBeTruthy();

      visibleField = await this.resolveVisibleTitleField(composer);

      if (visibleField) {
        await this.fillTitleField(visibleField, title);
        return;
      }
    }

    throw new Error('Could not find a visible editable title field inside the New event composer');
  }

  /**
   * Outlook often opens the form in compact mode where date/time are shown as a summary row.
   * To edit the actual start/end fields, click the summary row first.
   */
  async openScheduleEditor(): Promise<void> {
    const composer = this.composer();

    if (await this.areScheduleInputsVisible(composer)) {
      return;
    }

    const summary = this.scheduleSummary(composer);

    await expect(
      summary,
      'Expected compact schedule summary to be visible before opening schedule editor'
    ).toBeVisible({ timeout: TIMEOUTS.UI_LONG });

    await summary.click();

    await expect
      .poll(
        async () => {
          return this.areScheduleInputsVisible(composer);
        },
        {
          timeout: TIMEOUTS.UI_LONG,
          message: 'Expected schedule inputs to appear after clicking compact schedule summary',
        }
      )
      .toBeTruthy();
  }

  /**
   * Set start date/time to tomorrow at the current local time.
   * End time is start + durationMinutes.
   */
  async fillScheduleForTomorrowAtNow(
    durationMinutes = 30
  ): Promise<{ titleStart: string; titleEnd: string }> {
    await this.openScheduleEditor();

    const composer = this.composer();

    const now = new Date();

    const start = new Date(now);
    start.setDate(start.getDate() + 1);
    start.setSeconds(0, 0);

    const end = addMinutes(start, durationMinutes);

    const startDateInput = this.startDateInput(composer);
    const startTimeInput = this.startTimeInput(composer);
    const endDateInput = this.endDateInput(composer);
    const endTimeInput = this.endTimeInput(composer);

    await expect(startDateInput, 'Start date input visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await expect(startTimeInput, 'Start time input visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await expect(endDateInput, 'End date input visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    await expect(endTimeInput, 'End time input visible').toBeVisible({
      timeout: TIMEOUTS.UI_LONG,
    });

    const sampleStartDate = await startDateInput.inputValue().catch(() => '');
    const sampleStartTime = await startTimeInput.inputValue().catch(() => '');
    const sampleEndDate = await endDateInput.inputValue().catch(() => '');
    const sampleEndTime = await endTimeInput.inputValue().catch(() => '');

    const formattedStartDate = formatDateLike(sampleStartDate, start);
    const formattedStartTime = formatTimeLike(sampleStartTime, start);
    const formattedEndDate = formatDateLike(sampleEndDate, end);
    const formattedEndTime = formatTimeLike(sampleEndTime, end);

    await this.setInputValue(startDateInput, formattedStartDate);
    await this.setInputValue(startTimeInput, formattedStartTime);
    await this.setInputValue(endDateInput, formattedEndDate);
    await this.setInputValue(endTimeInput, formattedEndTime);

    return {
      titleStart: formattedStartTime,
      titleEnd: formattedEndTime,
    };
  }

  /**
   * Keep recurrence off, Teams meeting off, and All day off when these controls are visible.
   */
  async ensureTogglesOff(): Promise<void> {
    const composer = this.composer();

    const recurringCheckbox = composer.getByRole('checkbox', { name: /recurring/i }).first();
    if (await recurringCheckbox.isVisible().catch(() => false)) {
      const checked = await recurringCheckbox.isChecked().catch(() => false);
      if (checked) {
        await recurringCheckbox.click();
      }
    } else {
      const recurringButton = composer
        .getByRole('button', { name: /make recurring|recurring|repeat/i })
        .first();

      if (await recurringButton.isVisible().catch(() => false)) {
        const pressed = await recurringButton.getAttribute('aria-pressed');
        const checked = await recurringButton.getAttribute('aria-checked');

        if (pressed === 'true' || checked === 'true') {
          await recurringButton.click();
        }
      }
    }

    const teams = composer.getByLabel(/teams meeting/i).first();
    if (await teams.isVisible().catch(() => false)) {
      const checked = await teams.getAttribute('aria-checked');
      if (checked === 'true') {
        await teams.click();
      }
    }

    const allDay = composer.getByRole('checkbox', { name: /all day/i }).first();
    if (await allDay.isVisible().catch(() => false)) {
      const checked = await allDay.isChecked().catch(() => false);
      if (checked) {
        await allDay.click();
      }
    }
  }

  async saveEvent(): Promise<void> {
    const composer = this.composer();
    const save = this.saveButton(composer);

    await expect(save, 'Expected Save button').toBeVisible({
      timeout: TIMEOUTS.UI_MEDIUM,
    });

    await save.click();

    await expect(
      composer,
      'Expected New event composer dialog to close after save'
    ).toBeHidden({ timeout: TIMEOUTS.UI_LONG });
  }

  async expectEventVisible(title: string): Promise<void> {
    const eventLocator = this.page.getByText(title, { exact: false }).first();

    await expect(
      eventLocator,
      `Expected created event '${title}' to be visible in calendar`
    ).toBeVisible({ timeout: TIMEOUTS.UI_LONG });
  }
}