import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { useTestDatabase } from './testing/test-database';

// API test: runs the real server, set up exactly like main.ts, against the
// test database, and calls it with fetch the way hangout/src/api.ts does.
// Needs Postgres running. Run with: npm run test:e2e

describe('Events API (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    await useTestDatabase(); // AppModule reads DATABASE_URL while starting
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1'); // 0 = any free port
    baseUrl = `${await app.getUrl()}/api`;
    await app.get(DataSource).synchronize(true); // start from empty tables
  });

  afterAll(async () => {
    await app?.close();
  });

  // Sends a request and returns the status code and the parsed JSON body (if any)
  async function call(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: any }> {
    const response = await fetch(baseUrl + path, {
      method,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  }

  // 9:00 to 11:00 AM in Los Angeles on Oct 7, in 30-minute slots
  const studyCall = {
    title: 'Study call',
    dates: ['2026-10-07'],
    timeZone: 'America/Los_Angeles',
    dayStartMinutes: 540,
    dayEndMinutes: 660,
    slotMinutes: 30,
  };
  // Those four slots in UTC (Los Angeles is UTC-7 in October)
  const NINE = '2026-10-07T16:00:00.000Z';
  const NINE_THIRTY = '2026-10-07T16:30:00.000Z';
  const TEN = '2026-10-07T17:00:00.000Z';
  const TEN_THIRTY = '2026-10-07T17:30:00.000Z';

  async function createEvent(): Promise<string> {
    const { status, body } = await call('POST', '/events', studyCall);
    expect(status).toBe(201);
    return body.id;
  }

  async function join(eventId: string, name: string): Promise<{ participantId: string; name: string; slots: string[] }> {
    const { status, body } = await call('POST', `/events/${eventId}/participants`, { name });
    expect(status).toBe(201);
    return body;
  }

  function save(eventId: string, participantId: string, slots: string[]) {
    return call('PUT', `/events/${eventId}/participants/${participantId}/availability`, { slots });
  }

  const counts = (event: { slots: { count: number }[] }) => event.slots.map((slot) => slot.count);

  describe('creating and reading events', () => {
    it('returns the new event with every field the frontend reads', async () => {
      const id = await createEvent();
      const { status, body } = await call('GET', `/events/${id}`);

      expect(status).toBe(200);
      expect(Object.keys(body).sort()).toEqual([
        'createdAt', 'dates', 'dayEndMinutes', 'dayStartMinutes', 'description', 'id',
        'maxCount', 'mode', 'participants', 'slotMinutes', 'slots', 'timeZone', 'title',
      ]);
      expect(body).toMatchObject({
        id,
        title: 'Study call',
        description: '',
        mode: 'dates',
        timeZone: 'America/Los_Angeles',
        participants: [],
        maxCount: 0,
      });
      expect(body.slots).toEqual([
        { start: NINE, count: 0, names: [] },
        { start: NINE_THIRTY, count: 0, names: [] },
        { start: TEN, count: 0, names: [] },
        { start: TEN_THIRTY, count: 0, names: [] },
      ]);
    });

    it('answers 400 for events that do not make sense', async () => {
      const unknownZone = await call('POST', '/events', { ...studyCall, timeZone: 'Mars/Olympus_Mons' });
      expect(unknownZone.status).toBe(400);
      expect(JSON.stringify(unknownZone.body.message)).toMatch(/time zone/);

      const endsBeforeStart = await call('POST', '/events', { ...studyCall, dayStartMinutes: 660, dayEndMinutes: 540 });
      expect(endsBeforeStart.status).toBe(400);

      const noDates = await call('POST', '/events', { ...studyCall, dates: [] });
      expect(noDates.status).toBe(400);

      const unknownField = await call('POST', '/events', { ...studyCall, color: 'blue' });
      expect(unknownField.status).toBe(400);
    });

    it('answers 404 for an event that does not exist, and 400 for a malformed id', async () => {
      expect((await call('GET', `/events/${randomUUID()}`)).status).toBe(404);
      expect((await call('GET', '/events/not-a-real-id')).status).toBe(400);
    });
  });

  describe('signing in', () => {
    it('creates a name the first time and signs back in with the same name', async () => {
      const eventId = await createEvent();
      const first = await join(eventId, '  Luca ');
      expect(first).toEqual({ participantId: expect.any(String), name: 'Luca', slots: [] });

      const again = await join(eventId, 'Luca');
      expect(again.participantId).toBe(first.participantId);

      const { body } = await call('GET', `/events/${eventId}`);
      expect(body.participants).toEqual(['Luca']);
    });
  });

  describe('saving availability', () => {
    it('shows each saved time in the heatmap, and in the sign-in response', async () => {
      const eventId = await createEvent();
      const luca = await join(eventId, 'Luca');
      const turbat = await join(eventId, 'Turbat');

      const afterLuca = await save(eventId, luca.participantId, [NINE, NINE_THIRTY]);
      expect(afterLuca.status).toBe(200);
      expect(counts(afterLuca.body)).toEqual([1, 1, 0, 0]);
      expect(afterLuca.body.maxCount).toBe(1);

      const afterTurbat = await save(eventId, turbat.participantId, [NINE_THIRTY, TEN]);
      expect(afterTurbat.status).toBe(200);
      expect(counts(afterTurbat.body)).toEqual([1, 2, 1, 0]);
      expect(afterTurbat.body.slots[1].names).toEqual(['Luca', 'Turbat']);
      expect(afterTurbat.body.maxCount).toBe(2);

      expect((await join(eventId, 'Luca')).slots).toEqual([NINE, NINE_THIRTY]);
    });

    it('replaces the whole selection on every save', async () => {
      const eventId = await createEvent();
      const luca = await join(eventId, 'Luca');

      await save(eventId, luca.participantId, [NINE, NINE_THIRTY]);
      await save(eventId, luca.participantId, [TEN_THIRTY]);
      expect((await join(eventId, 'Luca')).slots).toEqual([TEN_THIRTY]);

      const cleared = await save(eventId, luca.participantId, []);
      expect(counts(cleared.body)).toEqual([0, 0, 0, 0]);
    });

    it('answers 400 for times that are not slots of the event', async () => {
      const eventId = await createEvent();
      const luca = await join(eventId, 'Luca');

      expect((await save(eventId, luca.participantId, ['2026-10-07T18:00:00.000Z'])).status).toBe(400); // 11 AM
      expect((await save(eventId, luca.participantId, ['2026-10-07T16:15:00.000Z'])).status).toBe(400); // 9:15
      expect((await save(eventId, luca.participantId, ['not a time'])).status).toBe(400);
    });

    it('answers 404 when saving for someone who is not part of the event', async () => {
      const eventId = await createEvent();
      expect((await save(eventId, randomUUID(), [NINE])).status).toBe(404);

      const otherEvent = await createEvent();
      const luca = await join(otherEvent, 'Luca');
      expect((await save(eventId, luca.participantId, [NINE])).status).toBe(404);
    });
  });

  describe('removing yourself', () => {
    it('deletes the participant and their times', async () => {
      const eventId = await createEvent();
      const luca = await join(eventId, 'Luca');
      await save(eventId, luca.participantId, [NINE]);

      const removed = await call('DELETE', `/events/${eventId}/participants/${luca.participantId}`);
      expect(removed.status).toBe(204);

      const { body } = await call('GET', `/events/${eventId}`);
      expect(body.participants).toEqual([]);
      expect(counts(body)).toEqual([0, 0, 0, 0]);

      expect((await call('DELETE', `/events/${eventId}/participants/${luca.participantId}`)).status).toBe(404);
    });
  });
});
