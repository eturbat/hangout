// Real-time updates from the server over Socket.IO (server/src/events/events.gateway.ts).
// The server only says "this event changed"; the page then refetches it with api.getEvent.
// It also shares who is viewing the event right now (presence).

import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

let socket: Socket | null = null

// One connection for the whole page. In development it goes through Vite's
// /socket.io proxy; with VITE_API_URL set, it connects to that server instead.
function sharedSocket(): Socket {
  if (!socket) {
    const apiUrl: string | undefined = import.meta.env.VITE_API_URL
    socket = apiUrl && /^https?:\/\//.test(apiUrl) ? io(new URL(apiUrl).origin) : io()
  }
  return socket
}

/** Who is looking at the event right now. */
export interface Presence {
  /** Signed-in names, alphabetically, each listed once. */
  names: string[]
  /** Viewers who haven't signed in. */
  guests: number
}

export interface EventSubscription {
  /** Call after signing in or out, so others see the right name. */
  updateName(): void
  stop(): void
}

/**
 * Calls `onChanged` whenever the event changes on the server, and after every
 * (re)connect, since changes may have been missed while offline.
 * `onPresence` receives the list of current viewers whenever it changes.
 * `name()` is the signed-in name shown to other viewers, if any.
 */
export function subscribeToEvent(
  eventId: string,
  handlers: { onChanged: () => void; onPresence: (presence: Presence) => void; name: () => string | undefined },
): EventSubscription {
  const s = sharedSocket()

  const announce = () => s.emit('event:subscribe', { eventId, name: handlers.name() })
  // Rooms are forgotten when the connection drops, so subscribe again on every connect
  const subscribe = () => {
    announce()
    handlers.onChanged()
  }
  const changed = (message: { eventId: string }) => {
    if (message.eventId === eventId) handlers.onChanged()
  }
  const presence = (message: Presence & { eventId: string }) => {
    if (message.eventId === eventId) handlers.onPresence({ names: message.names, guests: message.guests })
  }

  s.on('connect', subscribe)
  s.on('event:changed', changed)
  s.on('event:presence', presence)
  if (s.connected) subscribe()

  return {
    updateName: () => {
      if (s.connected) announce()
    },
    stop: () => {
      s.off('connect', subscribe)
      s.off('event:changed', changed)
      s.off('event:presence', presence)
      s.emit('event:unsubscribe')
    },
  }
}
