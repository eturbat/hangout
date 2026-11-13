import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { useTestDatabase } from './testing/test-database';

// Real-time test: runs the real server against the test database and connects
// with socket.io-client the way hangout/src/realtime.ts does.
// Needs Postgres running. Run with: npm run test:e2e

describe('Real-time updates (integration)', () => {
  let app: INestApplication;
  let origin: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    await useTestDatabase();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
    await app.get(DataSource).synchronize(true);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function call(method: string, path: string, body?: unknown): Promise<any> {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }

  const createEvent = async (): Promise<string> =>
    (
      await call('POST', '/events', {
        title: 'Study call',
        dates: ['2026-10-07'],
        timeZone: 'America/Los_Angeles',
        dayStartMinutes: 540,
        dayEndMinutes: 660,
        slotMinutes: 30,
      })
    ).id;

  // Connects, subscribes to `eventId`, and records every message received afterwards
  async function viewer(eventId: string, name?: string) {
    const socket = io(origin, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    const changed: string[] = [];
    const presence: { names: string[]; guests: number }[] = [];
    socket.on('event:changed', (message: { eventId: string }) => changed.push(message.eventId));
    socket.on('event:presence', (message: { names: string[]; guests: number }) => presence.push(message));
    const ack = await socket.timeout(5000).emitWithAck('event:subscribe', { eventId, name });
    expect(ack).toEqual({ ok: true });
    return { socket, changed, presence };
  }

  // Waits until `check` passes, for messages that arrive a moment after the HTTP response
  async function eventually(check: () => void, ms = 2000): Promise<void> {
    const deadline = Date.now() + ms;
    for (;;) {
      try {
        return check();
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }

  it('tells viewers of an event when someone joins, saves or is removed', async () => {
    const eventId = await createEvent();
    const watcher = await viewer(eventId);

    const luca = await call('POST', `/events/${eventId}/participants`, { name: 'Luca' });
    await eventually(() => expect(watcher.changed).toEqual([eventId]));

    await call('PUT', `/events/${eventId}/participants/${luca.participantId}/availability`, {
      slots: ['2026-10-07T16:00:00.000Z'],
    });
    await eventually(() => expect(watcher.changed).toHaveLength(2));

    await call('DELETE', `/events/${eventId}/participants/${luca.participantId}`);
    await eventually(() => expect(watcher.changed).toHaveLength(3));
  });

  it('does not notify when someone signs back in under an existing name', async () => {
    const eventId = await createEvent();
    await call('POST', `/events/${eventId}/participants`, { name: 'Luca' });
    const watcher = await viewer(eventId);

    await call('POST', `/events/${eventId}/participants`, { name: 'Luca' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(watcher.changed).toEqual([]);
  });

  it('only notifies viewers of the event that changed', async () => {
    const eventA = await createEvent();
    const eventB = await createEvent();
    const watcherA = await viewer(eventA);
    const watcherB = await viewer(eventB);

    await call('POST', `/events/${eventA}/participants`, { name: 'Luca' });
    await eventually(() => expect(watcherA.changed).toEqual([eventA]));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(watcherB.changed).toEqual([]);
  });

  it('rejects a subscription to something that is not an event id', async () => {
    const socket = io(origin, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    const ack = await socket.timeout(5000).emitWithAck('event:subscribe', { eventId: 'not-a-uuid' });
    expect(ack).toEqual({ ok: false, error: expect.any(String) });
  });

  it('shares who is viewing the event right now', async () => {
    const eventId = randomUUID(); // presence works without touching the database
    const ana = await viewer(eventId, 'Ana');
    const ben = await viewer(eventId, 'Ben');
    await viewer(eventId); // a guest who hasn't signed in
    await viewer(eventId, 'Ana'); // Ana's second tab

    await eventually(() => expect(ana.presence.at(-1)).toMatchObject({ names: ['Ana', 'Ben'], guests: 1 }));

    ben.socket.disconnect();
    await eventually(() => expect(ana.presence.at(-1)).toMatchObject({ names: ['Ana'], guests: 1 }));
  });
});
