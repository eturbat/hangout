import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from './app.module';
import { HangoutEvent } from './events/entities/hangout-event.entity';
import { Participant } from './events/entities/participant.entity';
import { TimeSlot } from './events/entities/time-slot.entity';
import { useTestDatabase } from './testing/test-database';

// Integration test: starts the real AppModule against a real Postgres database
// and checks the tables TypeORM creates from our entities.
//
// Unlike the unit tests, this needs Postgres running. It uses its own database
// ("hangout_test" by default; see testing/test-database.ts) and empties it on
// every run, so your development data in "hangout" is never touched.
//
// Run with: npm run test:e2e

describe('Database tables (integration)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let events: Repository<HangoutEvent>;
  let participants: Repository<Participant>;
  let slots: Repository<TimeSlot>;

  beforeAll(async () => {
    await useTestDatabase(); // AppModule reads DATABASE_URL while starting

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    dataSource = moduleRef.get(DataSource);

    // Drop every table, then create them again from the entity classes,
    // so each run starts with an empty database
    await dataSource.synchronize(true);

    events = dataSource.getRepository(HangoutEvent);
    participants = dataSource.getRepository(Participant);
    slots = dataSource.getRepository(TimeSlot);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  function saveEvent(): Promise<HangoutEvent> {
    return events.save(
      HangoutEvent.create({
        title: 'Study call',
        dates: ['2026-10-08', '2026-10-07'],
        timeZone: 'America/Los_Angeles',
        dayStartMinutes: 540,
        dayEndMinutes: 1020,
      }),
    );
  }

  function saveParticipant(event: HangoutEvent, name: string): Promise<Participant> {
    return participants.save(Participant.create(event.id, name));
  }

  it('creates the three tables', async () => {
    const rows: { table_name: string }[] = await dataSource.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(rows.map((row) => row.table_name)).toEqual(expect.arrayContaining(['events', 'participants', 'time_slots']));
  });

  it('stores slot times as timestamptz and dates as a text array', async () => {
    const columns = await dataSource.query(
      `SELECT table_name, column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE (table_name, column_name) IN (('events', 'dates'), ('time_slots', 'startUtc'))
       ORDER BY table_name`,
    );
    expect(columns).toEqual([
      { table_name: 'events', column_name: 'dates', data_type: 'ARRAY', udt_name: '_text' },
      { table_name: 'time_slots', column_name: 'startUtc', data_type: 'timestamp with time zone', udt_name: 'timestamptz' },
    ]);
  });

  it('gives each event a random UUID and returns its dates as strings', async () => {
    const saved = await saveEvent();
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const loaded = await events.findOneByOrFail({ id: saved.id });
    expect(loaded.dates).toEqual(['2026-10-07', '2026-10-08']);
  });

  it('allows a name once per event, but the same name in a different event', async () => {
    const first = await saveEvent();
    const second = await saveEvent();
    await saveParticipant(first, 'Luca');

    await expect(participants.insert(Participant.create(first.id, 'Luca'))).rejects.toThrow(/duplicate key/);
    await expect(saveParticipant(second, 'Luca')).resolves.toBeInstanceOf(Participant);
  });

  it('rejects marking the same slot twice', async () => {
    const event = await saveEvent();
    const luca = await saveParticipant(event, 'Luca');
    const nineAm = new Date('2026-10-07T16:00:00.000Z');

    await slots.insert(TimeSlot.create(luca, nineAm));
    await expect(slots.insert(TimeSlot.create(luca, nineAm))).rejects.toThrow(/duplicate key/);
  });

  it('loads participants as real Participant objects, so their methods work', async () => {
    const event = await saveEvent();
    const luca = await saveParticipant(event, 'Luca');
    await slots.insert(TimeSlot.create(luca, new Date('2026-10-07T17:00:00.000Z')));
    await slots.insert(TimeSlot.create(luca, new Date('2026-10-07T16:00:00.000Z')));

    const loaded = await participants.findOneOrFail({ where: { id: luca.id }, relations: { slots: true } });
    expect(loaded.isFreeAt(new Date('2026-10-07T16:00:00.000Z'))).toBe(true);
    expect(loaded.savedSlotStarts()).toEqual(['2026-10-07T16:00:00.000Z', '2026-10-07T17:00:00.000Z']);
  });

  it('deletes the participants and their slots when the event is deleted', async () => {
    const event = await saveEvent();
    const luca = await saveParticipant(event, 'Luca');
    await slots.insert(TimeSlot.create(luca, new Date('2026-10-07T16:00:00.000Z')));

    await events.delete(event.id);

    expect(await participants.countBy({ eventId: event.id })).toBe(0);
    expect(await slots.countBy({ eventId: event.id })).toBe(0);
  });
});
