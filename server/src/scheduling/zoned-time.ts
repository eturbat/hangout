/**
 * Timezone primitives for hangout.com.
 *
 * Built on the runtime's Intl API, which carries the IANA timezone database in
 * Node and in every modern browser. This file has no imports on purpose, so the
 * frontend uses it unchanged: hangout/src/lib/zoned-time.ts is a byte-identical
 * copy. A server test fails if they drift; `npm run sync:shared` in hangout/
 * copies this file over again.
 */

/** What a wall clock in some zone reads. `month` is 1-12. */
export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // Throws RangeError for unknown zones. hourCycle 'h23' stops some engines
    // from printing midnight as "24".
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

// IANA names look like "UTC", "Asia/Ulaanbaatar" or "America/Argentina/Buenos_Aires".
// Newer engines also accept fixed offsets such as "+05:30", but those never
// follow DST rules, so we refuse them.
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

/** The runtime's spelling of an IANA zone name (fixes case), or null if it isn't one. */
export function normalizeTimeZone(timeZone: string): string | null {
  if (!IANA_NAME.test(timeZone)) return null;
  try {
    return formatterFor(timeZone).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** What clocks in `timeZone` read at the instant `utcMs`. */
export function wallTimeAt(utcMs: number, timeZone: string): WallTime {
  const fields = new Map<string, number>();
  for (const part of formatterFor(timeZone).formatToParts(utcMs)) {
    if (part.type !== 'literal') fields.set(part.type, Number(part.value));
  }
  const field = (type: string): number => {
    const value = fields.get(type);
    if (value === undefined) throw new Error(`Intl did not return "${type}" for ${timeZone}`);
    return value;
  };
  const hour = field('hour');
  return {
    year: field('year'),
    month: field('month'),
    day: field('day'),
    hour: hour === 24 ? 0 : hour,
    minute: field('minute'),
  };
}

/** Offset of `timeZone` from UTC at `utcMs`, in minutes. PDT is -420, Ulaanbaatar is +480. */
export function offsetMinutesAt(utcMs: number, timeZone: string): number {
  const w = wallTimeAt(utcMs, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const wholeMinute = Math.floor(utcMs / MINUTE_MS) * MINUTE_MS;
  return Math.round((wallAsUtc - wholeMinute) / MINUTE_MS);
}

/**
 * The UTC instant at which clocks in `timeZone` read `wall`.
 *
 * This is the one hard conversion, because at DST transitions the answer is
 * not always a single instant:
 *  - Spring-forward gap: the wall time never happens (02:30 on 2026-03-08 in
 *    America/Los_Angeles). We return the instant it would have been under the
 *    old offset, which clocks display as 03:30.
 *  - Fall-back overlap: it happens twice (01:30 on 2026-11-01 in Los Angeles).
 *    We return the earlier one.
 *
 * `hour` may be 24, meaning midnight at the end of the day.
 */
export function utcFromWallTime(wall: WallTime, timeZone: string): number {
  // Date.UTC rolls hour 24 over to the next day's midnight.
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);

  // The real instant is within 14 hours of wallAsUtc, so the offsets one day
  // either side are the offsets on both sides of any transition that matters.
  const before = offsetMinutesAt(wallAsUtc - DAY_MS, timeZone);
  const after = offsetMinutesAt(wallAsUtc + DAY_MS, timeZone);

  // A candidate is right if the zone really has that offset at that instant.
  const matches: number[] = [];
  for (const offset of new Set([before, after])) {
    const candidate = wallAsUtc - offset * MINUTE_MS;
    if (offsetMinutesAt(candidate, timeZone) === offset) matches.push(candidate);
  }

  if (matches.length > 0) return Math.min(...matches); // 2 matches = overlap
  return wallAsUtc - before * MINUTE_MS; // 0 matches = gap
}

/** Parses "YYYY-MM-DD"; null unless it is a real calendar date. */
export function parseIsoDate(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  return real ? { year, month, day } : null;
}
