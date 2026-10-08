// Timezone choices for the dropdowns.

import { normalizeTimeZone, offsetMinutesAt } from './zoned-time.ts'

export interface ZoneOption {
  value: string
  /** e.g. "Ulaanbaatar (UTC+8)" */
  label: string
}

export interface ZoneGroup {
  region: string
  zones: ZoneOption[]
}

/** Used only if the browser can't list its zones (very old browsers). */
const FALLBACK_ZONES = [
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Ulaanbaatar',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
]

/** The zone this browser is in, falling back to UTC. */
export function browserTimeZone(): string {
  const detected = new Intl.DateTimeFormat().resolvedOptions().timeZone
  return (detected && normalizeTimeZone(detected)) || 'UTC'
}

/** -420 -> "UTC−7", 345 -> "UTC+5:45", 0 -> "UTC". Uses a real minus sign. */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'UTC'
  const abs = Math.abs(minutes)
  const hours = Math.floor(abs / 60)
  const rest = abs % 60
  return `UTC${minutes > 0 ? '+' : '\u2212'}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`
}

/** "Asia/Ulaanbaatar" -> "Ulaanbaatar (UTC+8)", using the offset in effect at `at`. */
export function zoneLabel(zone: string, at: number = Date.now()): string {
  const offset = formatOffset(offsetMinutesAt(at, zone))
  if (!zone.includes('/')) return zone === 'UTC' ? 'UTC' : `${zone} (${offset})`
  const place = zone.split('/').slice(1).join(' / ').replace(/_/g, ' ')
  return `${place} (${offset})`
}

function regionOf(zone: string): string {
  return zone.includes('/') ? zone.slice(0, zone.indexOf('/')) : 'Other'
}

let cachedBase: { at: number; groups: Map<string, ZoneOption[]> } | null = null

/** Every zone, grouped by region, plus any `extra` zones (e.g. the event's own). */
export function groupedZones(extra: readonly string[] = [], at: number = Date.now()): ZoneGroup[] {
  // Labels carry the current offset, so rebuild at most once an hour.
  if (!cachedBase || Math.abs(at - cachedBase.at) > 3_600_000) {
    const list = (Intl as { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf?.('timeZone')
    const groups = new Map<string, ZoneOption[]>()
    for (const zone of new Set(['UTC', ...(list ?? FALLBACK_ZONES)])) {
      const region = regionOf(zone)
      if (!groups.has(region)) groups.set(region, [])
      groups.get(region)!.push({ value: zone, label: zoneLabel(zone, at) })
    }
    cachedBase = { at, groups }
  }

  const groups = new Map([...cachedBase.groups].map(([region, zones]) => [region, [...zones]]))
  for (const raw of extra) {
    const zone = normalizeTimeZone(raw)
    if (!zone) continue
    const region = regionOf(zone)
    const zones = groups.get(region) ?? []
    if (!zones.some((z) => z.value === zone)) zones.push({ value: zone, label: zoneLabel(zone, at) })
    groups.set(region, zones)
  }

  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, zones]) => ({ region, zones: zones.sort((a, b) => a.label.localeCompare(b.label)) }))
}
