# outlook-playwright-framework

Playwright + TypeScript end-to-end test framework for Outlook Web (mail and calendar).

Tests run against real Outlook web sessions using pre-authenticated browser storage state.
There is no mock layer — every test exercises actual Outlook UI behaviour.

---

## Project structure

```
src/
  components/
    calendar.ts         Calendar event compose/save helpers
    composer.ts         Mail compose helpers (To, Subject, Body, Attach, Send)
    folders.ts          Folder navigation (Inbox, Drafts, Sent Items, etc.)
    messageList.ts      Message list interactions (open, wait, context menu, read/unread)
    readingPane.ts      Reading pane actions (reply, forward, move, delete, archive)
    searchPanel.ts      Search bar interactions
    toolbar.ts          Top toolbar (New mail)
  constants/
    timeouts.ts         Centralised timeout and polling interval values
  pages/
    outlookPage.ts      Composed page object (wraps all components)
  utils/
    calendarUtils.ts    Date/time formatting helpers for calendar inputs
    testData.ts         Token and subject generation for unique test data

tests/
  assets/
    test-attachment.txt Static file used by the attachment E2E test
  e2e/
    e2e.create-calendar-event-simple.spec.ts
    e2e.sender-bad-recipient.spec.ts
    e2e.sender-receiver-archive.spec.ts
    e2e.sender-receiver-attachment.spec.ts
    e2e.sender-receiver-delete.spec.ts
    e2e.sender-receiver-draft.spec.ts
    e2e.sender-receiver-flag.spec.ts
    e2e.sender-receiver-forward.spec.ts
    e2e.sender-receiver-mark-read-unread.spec.ts
    e2e.sender-receiver-move-to-custom-folder.spec.ts
    e2e.sender-receiver-reply.spec.ts
    e2e.sender-receiver-search.spec.ts
    e2e.sender-receiver.spec.ts
  fixtures/
    outlook.fixture.ts  Shared sender/receiver context fixture
  setup/
    auth.sender.setup.spec.ts
    auth.receiver.setup.spec.ts
  smoke/
    smoke.outlook.spec.ts

storage/               (git-ignored) Authenticated browser storage state files
  sender.storageState.json
  receiver.storageState.json
```

---

## Prerequisites

- Node.js 18+
- Two Outlook web accounts (sender and receiver)
- Chromium (installed via Playwright)

---

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```
SENDER_EMAIL=your-sender@outlook.com
RECEIVER_EMAIL=your-receiver@outlook.com
BASE_URL=https://outlook.live.com
```

### 3. Authenticate (first time or when sessions expire)

Authentication uses Playwright's `storageState` to reuse sessions across tests.
Run the auth setup specs once per account:

```bash
npx playwright test tests/setup/auth.sender.setup.spec.ts --headed
npx playwright test tests/setup/auth.receiver.setup.spec.ts --headed
```

Each setup test opens a browser, waits for manual login, and saves the session to `storage/`.

If a test starts failing with authentication errors or login redirects, re-run the relevant
auth setup spec to refresh the stored session.

---

## Running tests

### Run all tests

```bash
npx playwright test
```

### Run a specific spec

```bash
npx playwright test tests/e2e/e2e.sender-receiver.spec.ts
```

### Run with the HTML report

```bash
npx playwright test --reporter=html
npx playwright show-report
```

### Run headed (visible browser)

```bash
npx playwright test --headed
```

---

## Implemented test scenarios

### Mail — sender/receiver flows

| Scenario | File |
|---|---|
| Send and receive a basic email | `e2e.sender-receiver.spec.ts` |
| Reply flow | `e2e.sender-receiver-reply.spec.ts` |
| Forward flow | `e2e.sender-receiver-forward.spec.ts` |
| Draft: save, reopen, send | `e2e.sender-receiver-draft.spec.ts` |
| Flag / unflag message | `e2e.sender-receiver-flag.spec.ts` |
| Mark as unread, then read | `e2e.sender-receiver-mark-read-unread.spec.ts` |
| Archive message | `e2e.sender-receiver-archive.spec.ts` |
| Delete message | `e2e.sender-receiver-delete.spec.ts` |
| Move to custom folder | `e2e.sender-receiver-move-to-custom-folder.spec.ts` |
| Send with file attachment | `e2e.sender-receiver-attachment.spec.ts` |

### Mail — sender-only flows

| Scenario | File |
|---|---|
| Malformed recipient address is blocked | `e2e.sender-bad-recipient.spec.ts` |

### Search

| Scenario | File |
|---|---|
| Search by subject | `e2e.sender-receiver-search.spec.ts` |
| Search by sender email | `e2e.sender-receiver-search.spec.ts` |
| Search by receiver email (from Sent Items) | `e2e.sender-receiver-search.spec.ts` |
| Search by unique body token | `e2e.sender-receiver-search.spec.ts` |
| Search from Sent Items folder context | `e2e.sender-receiver-search.spec.ts` |
| Negative search (no results for unknown token) | `e2e.sender-receiver-search.spec.ts` |

### Calendar

| Scenario | File | Status |
|---|---|---|
| Create non-recurring event | `e2e.create-calendar-event-simple.spec.ts` | Passing |
| Create event with attendee | `e2e.create-calendar-event-simple.spec.ts` | Passing with caveats — see limitations |
| Create recurring event | `e2e.create-calendar-event-simple.spec.ts` | Passing with caveats — see limitations |

---

## Architecture notes

### Dual-project setup

Tests run under two Playwright projects: `sender` and `receiver`.
Each project loads a different `storageState` file.

E2E mail tests use a shared fixture (`outlook.fixture.ts`) that provisions both contexts.
Tests guard against double-execution with:

```ts
test.skip(testInfo.project.name !== 'sender', 'Run E2E flow only once (project: sender).');
```

### Unique token strategy

Every test generates a unique token using `makeToken(prefix)` — a timestamp plus a short random suffix.
This token appears in both subject and body, making message identification reliable even in a
noisy shared mailbox.

### Message list locator strategy

The Outlook message list lives under `[role="complementary"]`, not `[role="main"]`.
The `MessageList` component uses a two-level locator strategy: scoped-first (under `messageSurface()`)
with a global fallback (`messageRowGlobalByTextVariants()`). All interaction helpers must use
both levels to be robust.

---

## Known limitations and technical debt

### Calendar coverage — not fully hardened

The calendar tests (`e2e.create-calendar-event-simple.spec.ts`) pass but have known correctness gaps:

- **Attendee test**: the attendee input detection is guarded by a silent `if` — if the attendee
  field is not found, the attendee step is silently skipped and the test still passes. No
  chip/pill assertion confirms the attendee was accepted by the UI before saving.
- **Recurring event test**: enables the recurrence toggle but does not verify a recurrence
  indicator (e.g. repeat icon or label) on the saved event in the calendar grid. The coverage
  is equivalent to the basic event test.
- **Receiver-side invite**: after saving an event with an attendee, the receiver's inbox and
  calendar are not checked. No invite receipt is verified.
- **Date formatting**: the `setTomorrowSameTimeFor30Minutes` helper sets the date to today,
  not tomorrow (the name is misleading). Calendar input formatting is locale-sensitive and
  requires `locale: 'en-US'` in the browser context to work predictably.
- **waitForTimeout usage**: the calendar spec uses `waitForTimeout` in several places as a
  timing crutch. These should be replaced with condition-based waits in a future hardening pass.

These gaps are known and accepted for now. The tests establish that Outlook calendar
event creation works end-to-end. Correctness hardening is tracked in Next steps below.

### Attachment verification

The attachment test asserts the filename is visible inside `[role="main"]` via `expectBodyInReadingPane`.
If Outlook renders the attachment pill outside that region, the assertion will fail.

### Bad recipient scenario

The test asserts the composer remains open after clicking Send with a malformed address.
If Outlook silently discards the bad address or treats it as a display name and allows the
send, the composer may close and the test fails. Outlook enforcement is tenant-configurable.

### Session expiry

Stored sessions expire. When tests fail with auth redirects, re-run the auth setup
specs manually. There is no automatic session refresh mechanism.

### Search — folder scope and date range

Outlook web does not guarantee that search stays scoped to the current folder (it often
defaults to "All Mailboxes"). Folder-scoped search and date-range filtering require the
Outlook search scope UI, which lacks stable selectors in the current layout and is not
covered by this suite.

---

## Next steps / future improvements

- **Harden calendar attendee test**: add attendee chip assertion before save; verify the
  receiver's inbox for a calendar invite email using a second browser context (same pattern
  as the mail E2E tests)
- **Harden recurring event test**: assert a recurrence indicator is visible on the saved
  calendar event (icon, tooltip, or accessible label) before treating the test as valid
  coverage
- **Fix calendar date naming and correctness**: rename `setTomorrowSameTimeFor30Minutes`
  to reflect actual behaviour; fix it to set tomorrow's date; replace `waitForTimeout`
  calls with condition-based waits
- **Receiver-side calendar invite verification**: open receiver's inbox after sender saves
  an event with attendee; wait for and open the invite email; verify the calendar item in
  receiver's calendar
- **Date-range search**: Outlook's date filter UI is variant-specific; add once stable
  selectors are identified
- **Automatic session refresh**: add a pre-test hook that detects expired sessions and
  prompts for re-auth before the full suite runs
