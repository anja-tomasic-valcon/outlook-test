/**
 * Helpers to format dates/times in the same style as the Outlook inputs.
 * Strategy:
 * - read a sample inputValue from the UI
 * - preserve the same token order and separator for dates
 * - preserve 12h / 24h formatting for times
 * - when there is no sample, fall back to 12-hour Outlook-like values
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatNumberLikeSample(value: number, sampleToken: string): string {
  if (sampleToken.length >= 2) {
    return pad2(value);
  }

  return String(value);
}

function formatTwelveHour(date: Date, uppercase = true, includeSpace = true): string {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = pad2(date.getMinutes());
  const meridiem = hours24 >= 12 ? (uppercase ? 'PM' : 'pm') : uppercase ? 'AM' : 'am';

  return `${hours12}:${minutes}${includeSpace ? ' ' : ''}${meridiem}`;
}

export function addMinutes(d: Date, minutes: number): Date {
  const r = new Date(d);
  r.setMinutes(r.getMinutes() + minutes);
  return r;
}

export function formatDateLike(sample: string, date: Date): string {
  const normalizedSample = sample.trim();

  if (!normalizedSample) {
    // No pre-filled value to infer from. Use Intl so the format matches the
    // browser's locale (set via Playwright's context `locale` option) rather
    // than a hard-coded M/D/YYYY that only works for en-US.
    return new Intl.DateTimeFormat(undefined, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  const sepMatch = normalizedSample.match(/[./-]/);
  const sep = sepMatch ? sepMatch[0] : '/';
  const parts = normalizedSample.split(sep);

  if (parts.length !== 3) {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }

  let yearIndex = parts.findIndex((token) => token.length === 4);

  if (yearIndex === -1) {
    yearIndex = 2;
  }

  const remainingIndexes = [0, 1, 2].filter((index) => index !== yearIndex);

  const firstRemainingValue = parseInt(parts[remainingIndexes[0]] || '0', 10) || 0;
  const firstIsDay = firstRemainingValue > 12;

  const yearValue =
    parts[yearIndex].length === 2
      ? String(date.getFullYear()).slice(-2)
      : String(date.getFullYear());

  const formattedParts = new Array<string>(3);
  formattedParts[yearIndex] = yearValue;

  if (firstIsDay) {
    formattedParts[remainingIndexes[0]] = formatNumberLikeSample(
      date.getDate(),
      parts[remainingIndexes[0]]
    );
    formattedParts[remainingIndexes[1]] = formatNumberLikeSample(
      date.getMonth() + 1,
      parts[remainingIndexes[1]]
    );
  } else {
    formattedParts[remainingIndexes[0]] = formatNumberLikeSample(
      date.getMonth() + 1,
      parts[remainingIndexes[0]]
    );
    formattedParts[remainingIndexes[1]] = formatNumberLikeSample(
      date.getDate(),
      parts[remainingIndexes[1]]
    );
  }

  return formattedParts.join(sep);
}

export function formatTimeLike(sample: string, date: Date): string {
  const normalizedSample = sample.replace(/\u202f/g, ' ').trim();

  if (!normalizedSample) {
    // No pre-filled value to infer from. Use Intl so the format matches the
    // browser's locale rather than assuming 12-hour en-US.
    // Normalize the narrow no-break space (\u202f) that some Node.js Intl
    // implementations emit between the time and AM/PM marker.
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date).replace(/\u202f/g, ' ');
  }

  const hasAmPm = /am|pm/i.test(normalizedSample);

  if (hasAmPm) {
    const sampleMeridiem = normalizedSample.match(/\b(am|pm)\b/i)?.[0] ?? 'PM';
    const uppercase = sampleMeridiem === sampleMeridiem.toUpperCase();
    const includeSpace = /\d\s+(?:AM|PM|am|pm)\b/.test(normalizedSample);

    return formatTwelveHour(date, uppercase, includeSpace);
  }

  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}