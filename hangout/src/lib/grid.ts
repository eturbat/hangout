// Lays an event's slots out as a grid in the viewer's timezone: one column per
// local date, one row per local time of day. Pure logic, no Vue, so it can be
// unit tested (see grid.test.ts).

import { wallTimeAt } from './zoned-time.ts'

export interface GridCell {
  /** Slot start, UTC ISO string, exactly as the server sent it. */
  start: string
  col: number
  row: number
  /** e.g. "Wed, Oct 7, 9:00 AM", in the viewer's zone. */
  description: string
}

export interface GridColumn {
  /** Local date in the viewer's zone, "YYYY-MM-DD". */
  date: string
  weekday: string
  /** e.g. "Oct 7"; empty for a general-week event, which has no real dates. */
  dayLabel: string
}

export interface GridRow {
  key: string
  /** Shown on the first row of each hour, else null. */
  label: string | null
  /** Rows above aren't the previous slot: hours outside the event, or the clocks went back. */
  gapBefore: boolean
}

export interface GridModel {
  columns: GridColumn[]
  rows: GridRow[]
  /** cells[row][col]; null where that local date has no slot at that local time. */
  cells: (GridCell | null)[][]
  cellByStart: Map<string, GridCell>
}

export interface GridOptions {
  locale?: string
  /** For a general-week event: label columns by weekday only. */
  weekdaysOnly?: boolean
}

interface Placed {
  start: string
  ms: number
  date: string
  minutes: number
  /** 0 normally; 1 for the second time a clock time happens on a fall-back day. */
  occurrence: number
  rowKey: string
}

interface RowInfo {
  key: string
  minutes: number
  occurrence: number
  sampleMs: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export function buildGrid(
  slotStarts: readonly string[],
  timeZone: string,
  slotMinutes: number,
  options: GridOptions = {},
): GridModel {
  const sorted = [...slotStarts].sort((a, b) => Date.parse(a) - Date.parse(b))

  // 1. Where does each slot land on the viewer's wall clock?
  const placed: Placed[] = []
  const timesSeen = new Map<string, number>()
  for (const start of sorted) {
    const ms = Date.parse(start)
    const w = wallTimeAt(ms, timeZone)
    const date = `${w.year}-${pad(w.month)}-${pad(w.day)}`
    const minutes = w.hour * 60 + w.minute
    const seenKey = `${date} ${minutes}`
    const occurrence = timesSeen.get(seenKey) ?? 0
    timesSeen.set(seenKey, occurrence + 1)
    placed.push({ start, ms, date, minutes, occurrence, rowKey: `${minutes}#${occurrence}` })
  }

  // 2. Columns: the local dates, in order.
  const dates = [...new Set(placed.map((p) => p.date))].sort()
  const colOf = new Map(dates.map((d, i) => [d, i]))

  // 3. Rows: every local time that occurs on any date, in an order that is
  // chronological within every column (see orderRows).
  const rowInfos = orderRows(placed, dates)
  const rowOf = new Map(rowInfos.map((r, i) => [r.key, i]))
  const repeatedMinutes = new Set(rowInfos.filter((r) => r.occurrence > 0).map((r) => r.minutes))

  const timeFormat = new Intl.DateTimeFormat(options.locale, { timeZone, hour: 'numeric', minute: '2-digit' })
  const timeWithZone = new Intl.DateTimeFormat(options.locale, {
    timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const rows: GridRow[] = rowInfos.map((info, i) => {
    const prev = rowInfos[i - 1]
    // A break: hours outside the event were skipped, or the clocks went back
    // (the time is the same or earlier than the row above, as on a fall-back day).
    const gapBefore = prev !== undefined &&
      (info.minutes - prev.minutes > slotMinutes || info.minutes <= prev.minutes)
    const newHour = prev === undefined || gapBefore ||
      Math.floor(info.minutes / 60) !== Math.floor(prev.minutes / 60)
    // When a clock time repeats, say which one: "1:00 AM PDT" vs "1:00 AM PST".
    const format = repeatedMinutes.has(info.minutes) ? timeWithZone : timeFormat
    return { key: info.key, label: newHour ? format.format(info.sampleMs) : null, gapBefore }
  })

  // 4. Cells.
  const describe = new Intl.DateTimeFormat(options.locale, {
    timeZone,
    weekday: 'short',
    ...(options.weekdaysOnly ? {} : { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  })
  const cells: (GridCell | null)[][] = rows.map(() => dates.map(() => null))
  const cellByStart = new Map<string, GridCell>()
  for (const p of placed) {
    const row = rowOf.get(p.rowKey)!
    const col = colOf.get(p.date)!
    const cell: GridCell = { start: p.start, col, row, description: describe.format(p.ms) }
    cells[row]![col] = cell
    cellByStart.set(p.start, cell)
  }

  // Column labels come from the local date itself, formatted in UTC so the
  // formatter can't shift it to a neighbouring day.
  const weekday = new Intl.DateTimeFormat(options.locale, { timeZone: 'UTC', weekday: 'short' })
  const monthDay = new Intl.DateTimeFormat(options.locale, { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const columns: GridColumn[] = dates.map((date) => {
    const [y, m, d] = date.split('-').map(Number)
    const noonUtc = Date.UTC(y!, m! - 1, d!, 12)
    return {
      date,
      weekday: weekday.format(noonUtc),
      dayLabel: options.weekdaysOnly ? '' : monthDay.format(noonUtc),
    }
  })

  return { columns, rows, cells, cellByStart }
}

/**
 * Orders rows so that, read top to bottom, every column is chronological.
 *
 * Sorting by clock time alone breaks on a fall-back day: "1:00 PDT, 1:15 PDT,
 * ..., 1:45 PDT" must come before the second "1:00 PST", which must come before
 * 2:00. Each column says "row a comes right before row b"; a topological sort
 * (Kahn's algorithm) honours all of them, breaking ties by clock time.
 */
function orderRows(placed: Placed[], dates: string[]): RowInfo[] {
  const infos = new Map<string, RowInfo>()
  const next = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()

  for (const p of placed) {
    if (!infos.has(p.rowKey)) {
      infos.set(p.rowKey, { key: p.rowKey, minutes: p.minutes, occurrence: p.occurrence, sampleMs: p.ms })
      next.set(p.rowKey, new Set())
      inDegree.set(p.rowKey, 0)
    }
  }
  for (const date of dates) {
    const column = placed.filter((p) => p.date === date) // already chronological
    for (let i = 1; i < column.length; i++) {
      const a = column[i - 1]!.rowKey
      const b = column[i]!.rowKey
      const edges = next.get(a)!
      if (a !== b && !edges.has(b)) {
        edges.add(b)
        inDegree.set(b, inDegree.get(b)! + 1)
      }
    }
  }

  const byClock = (a: RowInfo, b: RowInfo) => a.minutes - b.minutes || a.occurrence - b.occurrence
  const ready = [...infos.values()].filter((r) => inDegree.get(r.key) === 0)
  const ordered: RowInfo[] = []
  while (ready.length > 0) {
    ready.sort(byClock)
    const row = ready.shift()!
    ordered.push(row)
    for (const b of next.get(row.key)!) {
      const remaining = inDegree.get(b)! - 1
      inDegree.set(b, remaining)
      if (remaining === 0) ready.push(infos.get(b)!)
    }
  }
  // Columns can't actually disagree, but never drop a row if they somehow do.
  if (ordered.length < infos.size) {
    const placedKeys = new Set(ordered.map((r) => r.key))
    ordered.push(...[...infos.values()].filter((r) => !placedKeys.has(r.key)).sort(byClock))
  }
  return ordered
}
