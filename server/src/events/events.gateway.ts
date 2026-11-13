import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';

// Real-time updates over Socket.IO, served at /socket.io on the same port as the API.
//
// Each browser viewing an event joins that event's "room". When someone joins,
// saves their times, or is removed, EventsService calls notifyChanged() and
// everyone in the room gets a small `event:changed` message. They then refetch
// GET /api/events/:id. The REST response stays the single source of truth, so
// messages arriving late or out of order can never show stale data.
//
// Bonus: the room also tracks who is looking at the page right now
// (`event:presence`). The name a browser sends is only a label for that list.
// It grants nothing, because editing still needs the participantId from a sign-in.

export interface Presence {
  /** Signed-in names viewing the event, alphabetically, each listed once. */
  names: string[];
  /** Viewers who haven't signed in. */
  guests: number;
}

interface ViewerData {
  eventId?: string;
  name?: string;
}

const room = (eventId: string) => `event:${eventId}`;

@WebSocketGateway()
export class EventsGateway implements OnGatewayDisconnect {
  // Set by Nest once the Socket.IO server starts
  @WebSocketServer() private readonly server?: Server;

  // { eventId, name? } -> ack { ok }. Also call it again when the viewer signs in or out, to update their name.
  @SubscribeMessage('event:subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean; error?: string }> {
    const { eventId, name } = (body ?? {}) as { eventId?: unknown; name?: unknown };
    if (typeof eventId !== 'string' || !isUUID(eventId)) {
      return { ok: false, error: 'eventId must be a UUID' };
    }

    const data = client.data as ViewerData;
    const previous = data.eventId;
    if (previous && previous !== eventId) {
      await client.leave(room(previous)); // one event per connection
    }
    data.eventId = eventId;
    data.name = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : undefined;
    await client.join(room(eventId));

    if (previous && previous !== eventId) await this.broadcastPresence(previous);
    await this.broadcastPresence(eventId);
    return { ok: true };
  }

  @SubscribeMessage('event:unsubscribe')
  async unsubscribe(@ConnectedSocket() client: Socket): Promise<{ ok: boolean }> {
    const data = client.data as ViewerData;
    const eventId = data.eventId;
    if (eventId) {
      data.eventId = undefined;
      await client.leave(room(eventId));
      await this.broadcastPresence(eventId);
    }
    return { ok: true };
  }

  // Socket.IO has already removed the socket from its rooms at this point
  handleDisconnect(client: Socket): void {
    const eventId = (client.data as ViewerData).eventId;
    if (eventId) void this.broadcastPresence(eventId);
  }

  // Tells everyone viewing this event to refetch it
  notifyChanged(eventId: string): void {
    this.server?.to(room(eventId)).emit('event:changed', { eventId });
  }

  private async broadcastPresence(eventId: string): Promise<void> {
    if (!this.server) return;
    const sockets = await this.server.in(room(eventId)).fetchSockets();
    const names = new Set<string>();
    let guests = 0;
    for (const socket of sockets) {
      const name = (socket.data as ViewerData).name;
      if (name) names.add(name);
      else guests++;
    }
    const presence: Presence = { names: [...names].sort((a, b) => a.localeCompare(b)), guests };
    this.server.to(room(eventId)).emit('event:presence', { eventId, ...presence });
  }
}
