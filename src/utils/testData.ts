/**
 * Test data helpers.
 * Senior rule: every E2E test should generate uniquely identifiable data (token),
 * and use that token consistently for waiting/searching/assertions.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function fullTimestamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

/**
 * Generates a unique token for identifying test-created artifacts.
 * Includes timestamp + small random suffix to avoid collisions within the same second.
 */
export function makeToken(prefix: string): string {
  const ts = fullTimestamp();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Creates a subject that always contains the token.
 * Keep it short and token-forward so Outlook truncation still includes it.
 */
export function makeSubject(token: string): string {
  return `PW ${token}`;
}