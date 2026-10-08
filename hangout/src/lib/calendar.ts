// Small date helpers for the create-event form. Dates are "YYYY-MM-DD" strings
// throughout; they are calendar dates, not instants, so no timezone applies.

import { parseIsoDate } from './zoned-time.ts'

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date on this device, "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(date: string, days: number): string {
  const d = parseIsoDate(date)
  if (!d)
		throw new Error(`Not a date: ${date}`)
  return new Date(Date.UTC(d.year, d.month - 1, d.day + days)).toISOString().slice(0, 10)
}

/** Every date from `from` to `to` inclusive. Empty if either is invalid or `to` is earlier. Stops after `limit`. */
export function datesBetween(from: string, to: string, limit = 366): string[] {
  if (!parseIsoDate(from) || !parseIsoDate(to) || to < from)
		return []
  const dates: string[] = []
  for (let date = from; date <= to && dates.length < limit; date = addDays(date, 1)) {
		dates.push(date)
	}
  return dates
}

/** 9 -> "9 AM" in the user's locale; 0 and 24 are midnight. */
export function hourLabel(hour: number, locale?: string): string {
  if (hour === 24) return 'Midnight (end of day)'
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric' }).format(Date.UTC(2000, 0, 1, hour))
}
