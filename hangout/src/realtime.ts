// Real-time updates from the server over Socket.IO (server/src/events/events.gateway.ts).
// The server only says "this event changed"; the page then refetches it with api.getEvent.

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

/**
 * Calls `onChanged` whenever the event changes on the server, and after every
 * (re)connect, since changes may have been missed while offline.
 * Returns a function that stops listening.
 */
export function subscribeToEvent(eventId: string, onChanged: () => void): () => void {
  const s = sharedSocket()

  // Rooms are forgotten when the connection drops, so subscribe again on every connect
  const subscribe = () => {
    s.emit('event:subscribe', { eventId })
    onChanged()
  }
  const changed = (message: { eventId: string }) => {
    if (message.eventId === eventId) onChanged()
  }

  s.on('connect', subscribe)
  s.on('event:changed', changed)
  if (s.connected) subscribe()

  return () => {
    s.off('connect', subscribe)
    s.off('event:changed', changed)
    s.emit('event:unsubscribe')
  }
}
