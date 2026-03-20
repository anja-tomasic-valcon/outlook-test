# OUTLOOK-PLAYWRIGHT-FRAMEWORK

A Playwright + TypeScript automation framework for Outlook Web (mail & calendar) flows. This repository contains end-to-end tests (sender/receiver projects), page/component helpers, and smoke/auth setup specs to exercise Outlook mail and calendar features (create events, invite attendees, flag mail, search, etc.).

---

# Outlook Playwright Framework

Playwright + TypeScript automation framework for Outlook Web.

This project automates Outlook mail and calendar flows using authenticated sender/receiver accounts, with support for smoke tests, auth setup flows, and end-to-end scenarios.

---

## Overview

This framework is built for testing Outlook Web features through real UI flows.

It currently covers scenarios such as:

- sender → receiver mail flows
- reply, delete, archive, search, move to custom folder
- flagging messages
- opening the New Event calendar form
- creating calendar events
- recurring calendar event scenarios
- attendee / invite calendar flows
- smoke validation of core Outlook functionality

The project uses separate authenticated Playwright projects for `sender` and `receiver`, each with its own `storageState`.

---

## Tech Stack

- Playwright Test
- TypeScript
- Node.js
- dotenv

---

## Project Structure

OUTLOOK-PLAYWRIGHT-FRAMEWORK
├── src
│   ├── components
│   │   ├── calendar.ts
│   │   ├── composer.ts
│   │   ├── folders.ts
│   │   ├── messageList.ts
│   │   ├── readingPane.ts
│   │   ├── searchPanel.ts
│   │   └── toolbar.ts
│   ├── constants
│   │   ├── app.constants.ts
│   │   └── timeouts.ts
│   ├── pages
│   │   ├── login.page.ts
│   │   └── outlookPage.ts
│   └── utils
│       ├── calendarUtils.ts
│       └── testData.ts
├── storage
│   ├── receiver.storageState.json
│   └── sender.storageState.json
├── tests
│   ├── e2e
│   ├── other
│   ├── setup
│   └── smoke
├── playwright-report
├── test-results
├── .env
├── .env.example
├── package.json
├── playwright.config.ts
└── README.md

--- 

## Prerequisites

- Node.js >= 16 (verify with `node -v`)
- npm (or yarn)
- Playwright browsers installed (see installation steps below)
- Valid Outlook accounts for sender and receiver (used to create storageState files)
- Authenticated storage state files for both users

---

## Installation

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd outlook-playwright-framework
npm install
# then install Playwright browsers if not already present
npx playwright install
```

(If your project already includes Playwright browsers, the install step is optional.)

---

## Required environment variables

- `SENDER_EMAIL` — email address of the sender account used by `sender` project tests.
- `RECEIVER_EMAIL` — email address of the receiver account used by `receiver` project tests.

You can export these in your shell, or use your CI secret store. Example (Windows PowerShell):

```powershell
$env:SENDER_EMAIL = 'sender@example.com'
$env:RECEIVER_EMAIL = 'receiver@example.com'
```

Optional: you may prefer a local `.env` file (not included) and read it in your CI/task runner. This repo uses storageState files for authentication (see next section).

---

## Playwright configuration overview

- `playwright.config.ts` defines projects (sender, receiver), timeouts, retries, and artifact directories.
- Projects:
  - `sender` — runs tests as the sender user using `storage/sender.storageState.json`
  - `receiver` — runs tests as the receiver user using `storage/receiver.storageState.json`

The config also controls artifact collection (traces, screenshots, videos) for failures.

---

## Authentication / storageState setup

This repo uses Playwright storageState JSON files to run tests with pre-authenticated sessions:

- `storage/sender.storageState.json`
- `storage/receiver.storageState.json`

If those files are not present or you need to regenerate them, run the setup specs in `tests/setup/`:

- `tests/setup/auth.sender.setup.spec.ts` — creates `storage/sender.storageState.json`
- `tests/setup/auth.receiver.setup.spec.ts` — creates `storage/receiver.storageState.json`

Run them with the appropriate project context, usually in headed mode to complete interactive login:

```bash
# Example: run sender auth setup in headed mode
npx playwright test tests/setup/auth.sender.setup.spec.ts --project=sender --headed
```

Follow the interactive login flow in the headed browser; the test should save `storage/*.json`. Keep those files safe — they contain authenticated state.

---

## How to run tests

Run the whole test suite:

```bash
npx playwright test
```

Run tests for a specific Playwright project (sender or receiver):

```bash
# Run sender tests
npx playwright test --project=sender

# Run receiver tests
npx playwright test --project=receiver
```

Run a single spec file:

```bash
npx playwright test tests/e2e/e2e.create-calendar-event-simple.spec.ts --project=sender
```

Run a single test by name:

```bash
npx playwright test -t "E2E: create a calendar event and add attendee" --project=sender
```

Run tests in headed (visible) mode:

```bash
npx playwright test --headed --project=sender
```

Run with trace collection (useful for debugging failures):

```bash
npx playwright test tests/e2e/e2e.create-calendar-event-simple.spec.ts --project=sender --trace on --headed
# After run, open trace:
npx playwright show-trace test-results/<run-id>/trace.zip
```

Show only failing runs artifacts with Playwright reporters (HTML report):

```bash
npx playwright show-report
# or open playwright-report/index.html in a browser
```

---

## Available scripts
### General
npm run pw:version
npm run node:version

npm test
npm run test:headed
npm run test:list

npm run report

### Run by Playwright project
npm run test:sender
npm run test:receiver

### Smoke tests
npm run smoke

### Full E2E suite
npm run e2e
npm run e2e:headed
npm run e2e:ui
npm run e2e:debug

### Basic sender → receiver flow
npm run e2e:basic
npm run e2e:basic:headed
npm run e2e:basic:ui
npm run e2e:basic:debug

### Reply flow
npm run e2e:reply
npm run e2e:reply:headed
npm run e2e:reply:ui
npm run e2e:reply:debug

### Delete flow
npm run e2e:delete
npm run e2e:delete:headed
npm run e2e:delete:ui
npm run e2e:delete:debug

### Move to custom folder flow
npm run e2e:move-folder
npm run e2e:move-folder:headed
npm run e2e:move-folder:ui
npm run e2e:move-folder:debug

### Archive flow
npm run e2e:archive
npm run e2e:archive:headed
npm run e2e:archive:ui
npm run e2e:archive:debug

### Search flow
npm run e2e:search
npm run e2e:search:headed
npm run e2e:search:ui
npm run e2e:search:debug

### Flag flow
npm run e2e:flag
npm run e2e:flag:headed
npm run e2e:flag:ui
npm run e2e:flag:debug

### Calendar open / simple calendar event flow
npm run other:open-calendar
npm run other:open-calendar:headed
npm run other:open-calendar:ui
npm run other:open-calendar:debug

npm run e2e:create-calendar-event-simple
npm run e2e:create-calendar-event-simple:headed
npm run e2e:create-calendar-event-simple:ui
npm run e2e:create-calendar-event-simple:debug

## Where reports, traces, screenshots, videos are stored

- HTML report: `playwright-report/index.html`
- Test results and artifacts: `test-results/` (location controlled by Playwright config)
- Storage state files (authenticated contexts): `storage/*.storageState.json`
- On test failure Playwright produces:
  - traces (trace.zip)
  - screenshots
  - video files (if enabled)
These artifacts are stored under test-results or the directories configured in `playwright.config.ts`.

Use `npx playwright show-trace <trace.zip>` to inspect traces.

---

## Sender / Receiver project explanation

- sender project:
  - Runs tests using `storage/sender.storageState.json`
  - Used to create and send events/emails
- receiver project:
  - Runs tests using `storage/receiver.storageState.json`
  - Used to verify the receiver side (inbox/calendar) to ensure invites and mail arrive

Tests that involve both accounts (sender → receiver) typically:
1. Run an action with the `sender` project (create event, send mail).
2. Then create a new Playwright context using the receiver storage state and check the receiver UI (calendar/inbox) for expected artifacts.

This approach avoids live credential login for each test and keeps test flows deterministic.

---

## Project-specific test guidance & known UI differences

Outlook Web UI is complex and occasionally changes. Tests in this repo already handle several flaky areas — important notes:

- People-picker (attendee input) — suggestions may appear and must be clicked to truly resolve a recipient; typing alone may not commit an attendee.
- New event flow can be presented as an inline composer, a dialog, or a split-menu; tests use multiple fallbacks to open and detect the new-event form.
- Recurrence UI often opens a separate panel or toggle; enabling recurrence requires verifying accessible signals (checkbox state or aria-pressed).
- Teams toggle / All-day toggle: tests explicitly disable them before saving when not required.
- Timezone/local time: tests set start time to the local time where the test runs, and explicitly set end time to +30 minutes to avoid off-by-date issues.
- If Outlook UI changes, prefer robust role/label/placeholder locators over CSS classes or brittle selectors.

---

## Common debugging tips

- Use headed + trace to inspect failures:
  - `--headed --trace on` and then `npx playwright show-trace`
- Re-run a single failing spec to isolate the issue:
  - `npx playwright test <spec-path> --project=sender -t "<test title>" --headed --trace on`
- Open the HTML report after a run:
  - `npx playwright show-report` or open `playwright-report/index.html`
- Use `test.only` to run a single test quickly while iterating locally.
- Increase assertion/context granularity when a flaky UI element is suspected (use scoped assertions).
- Use the `storage/*.storageState.json` files to reproduce the exact user session locally.
- If mail delivery seems delayed, add a short poll (bounded) with a small timeout instead of a large hard wait — prefer deterministic conditions.
- If tests break due to UI changes, inspect DOM with the browser's devtools (headed run) and update locators to role/aria/label where available.

---

## How tests ensure invites are actually sent (important)

- Attendee flow:
  - Tests click suggestion if the people-picker suggestion box shows a matching address.
  - Tests verify the attendee area contains a committed recipient "chip" (scoped check) before final action.
  - If `Send` is present (meeting flow detected), the test clicks `Send` — not `Save`. This ensures Outlook sends invites to attendees rather than creating an organizer-only appointment.
  - Tests then open the `receiver` storage context and verify the event appears in the receiver's calendar (or mail inbox), providing an end-to-end verification of invite delivery.

---

## Notes about test stability and Outlook Web differences

- Outlook Web UI may behave differently across accounts, tenants, feature flags, or geographies; expect small adjustments when running against different accounts.
- Tests prefer accessible locators (role/label/placeholder) to improve stability.
- If you see intermittent failures:
  - check if suggestions/people-picker didn't resolve — that often indicates the attendee commit step failed.
  - check for lazy UI expansions (schedule editor, recurrence panel).
  - check storageState validity (expired tokens) — re-run setup auth specs if necessary.

---

## Future improvements / next steps

- Extract commonly used attendee & calendar helpers into a small reusable helper module / POM (keeps tests DRY and easier to maintain).
- Add inbox assertions for invites (verify mail content) in addition to calendar verification.
- Add more robust retry/backoff for mail delivery checks (bounded and deterministic).
- Add more smoke tests and monitoring tests to detect Outlook UI regressions early.

