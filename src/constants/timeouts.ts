/**
 * Centralized timeouts for the whole framework.
 * Keep numbers here, keep intent in names.
 */
export const TIMEOUTS = {
  // Test-level timeouts
  TEST_DEFAULT: 60_000,
  TEST_E2E: 240_000,

  // UI-level waits
  UI_SHORT: 5_000,
  UI_MEDIUM: 15_000,
  UI_LONG: 30_000,

  // Business-level latency (email delivery can be slow/unpredictable)
  MAIL_DELIVERY_MAX: 120_000,

  // Search-specific waits (Outlook UI variants)
  SEARCH_VISIBLE: 30_000,

  // Polling intervals (keep readonly to avoid accidental mutation)
  POLL_INTERVALS_SHORT: [500, 1000, 1500, 2000] as readonly number[],
  POLL_INTERVALS_MEDIUM: [2000, 3000, 5000, 8000] as readonly number[],
} as const;

/**
 * Returns a mutable copy of polling intervals.
 * Playwright's expect.poll expects a mutable number[].
 */
export function mutableIntervals(intervals: readonly number[]): number[] {
  return [...intervals];
}