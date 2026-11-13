import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';

// Real-time updates over Socket.IO, served at /socket.io on the same port as the API.
//
// Each browser viewing an event joins that event's "room". When someone joins,
// saves their times, or is removed, EventsService calls notifyChanged() and
// everyone in the room gets a small `event:changed` message. They then refetch
// GET /api/events/:id. The REST response stays the single source of truth, so
// messages arriving late or out of order can never show stale data.

interface ViewerData {
  eventId?: string;
}

const room = (eventId: string) => `event:${eventId}`;

@WebSocketGateway()
export class EventsGateway {
  // Set by Nest once the Socket.IO server starts
  @WebSocketServer() private readonly server?: Server;

  // { eventId } -> ack { ok }
  @SubscribeMessage('event:subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<{ ok: boolean; error?: string }> {
    const { eventId } = (body ?? {}) as { eventId?: unknown };
    if (typeof eventId !== 'string' || !isUUID(eventId)) {
      return { ok: false, error: 'eventId must be a UUID' };
    }

    const data = client.data as ViewerData;
    const previous = data.eventId;
    if (previous && previous !== eventId) {
      await client.leave(room(previous)); // one event per connection
    }
    data.eventId = eventId;
    await client.join(room(eventId));
    return { ok: true };
  }

  @SubscribeMessage('event:unsubscribe')
  async unsubscribe(@ConnectedSocket() client: Socket): Promise<{ ok: boolean }> {
    const data = client.data as ViewerData;
    if (data.eventId) {
      await client.leave(room(data.eventId));
      data.eventId = undefined;
    }
    return { ok: true };
  }

  // Tells everyone viewing this event to refetch it
  notifyChanged(eventId: string): void {
    this.server?.to(room(eventId)).emit('event:changed', { eventId });
  }
}
