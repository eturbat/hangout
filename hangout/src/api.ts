// Typed client for the hangout server. Shapes mirror server/src/events/events.service.ts.
// Every time the server sends is a UTC ISO string; convert to the viewer's zone only for display.

export type EventMode = 'dates' | 'weekdays'

export interface SlotSummary {
  /** Slot start, UTC ISO string. */
  start: string
  count: number
  /** Who is free in this slot, alphabetically. */
  names: string[]
}

export interface EventView {
  id: string
  title: string
  description: string
  mode: EventMode
  /** IANA zone the event was created in. */
  timeZone: string
  dates: string[]
  dayStartMinutes: number
  dayEndMinutes: number
  slotMinutes: number
  createdAt: string
  participants: string[]
  maxCount: number
  /** Every slot in chronological order. */
  slots: SlotSummary[]
}

export interface CreateEventInput {
  title: string
  description?: string
  mode?: EventMode
  /** "YYYY-MM-DD" dates in `timeZone`. */
  dates: string[]
  timeZone: string
  /** Minutes after local midnight, e.g. 540 for 09:00. */
  dayStartMinutes: number
  /** Exclusive; 1440 means end of day. */
  dayEndMinutes: number
  slotMinutes?: 15 | 30 | 60
}

/** Returned when someone signs in under a name. Keep it to save or delete their availability. */
export interface Session {
  participantId: string
  name: string
  editToken: string
  /** Their saved slots (UTC ISO), to pre-fill the grid. */
  slots: string[]
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const BASE: string = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? null : JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { message?: string | string[] } | null
    const message = payload?.message
    throw new ApiError(res.status, Array.isArray(message) ? message.join('; ') : message ?? res.statusText)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  createEvent: (input: CreateEventInput) => request<{ id: string }>('POST', '/events', input),

  getEvent: (eventId: string) => request<EventView>('GET', `/events/${eventId}`),

  /** Creates the name the first time; a name saved with a password needs it again. */
  join: (eventId: string, name: string, password?: string) =>
    request<Session>('POST', `/events/${eventId}/participants`, { name, password: password || undefined }),

  /** Replaces this participant's whole selection. Returns the refreshed event. */
  saveAvailability: (eventId: string, session: Session, slots: string[]) =>
    request<EventView>('PUT', `/events/${eventId}/participants/${session.participantId}/availability`,
      { slots }, { 'X-Edit-Token': session.editToken }),

  removeMe: (eventId: string, session: Session) =>
    request<void>('DELETE', `/events/${eventId}/participants/${session.participantId}`,
      undefined, { 'X-Edit-Token': session.editToken }),
}

// Remember who you signed in as, per event, so a reload keeps your edits possible.
const sessionKey = (eventId: string) => `hangout:session:${eventId}`

export function saveSession(eventId: string, session: Session): void {
  try {
    localStorage.setItem(sessionKey(eventId), JSON.stringify(session))
  } catch {
    // Private mode or storage full: the session just won't survive a reload.
  }
}

export function forgetSession(eventId: string): void {
  try {
    localStorage.removeItem(sessionKey(eventId))
  } catch {
    // Nothing stored, or storage unavailable.
  }
}

export function loadSession(eventId: string): Session | null {
  try {
    const raw = localStorage.getItem(sessionKey(eventId))
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}
