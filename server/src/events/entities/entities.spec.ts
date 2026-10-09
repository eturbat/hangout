import { HangoutEvent } from './hangout-event.entity';
import { Participant } from './participant.entity';
import { TimeSlot } from './time-slot.entity';

describe('HangoutEvent', () => {
  const details = {
    title: 'Study call',
    dates: ['2026-10-08', '2026-10-07', '2026-10-08'],
    timeZone: 'America/Los_Angeles',
    dayStartMinutes: 540, // 9:00 AM
    dayEndMinutes: 1020, // 5:00 PM
  };

  it('create() sorts the dates and removes duplicates', () => {
    expect(HangoutEvent.create(details).dates).toEqual(['2026-10-07', '2026-10-08']);
  });

  it('create() fills in defaults for the optional fields', () => {
    const event = HangoutEvent.create(details);
    expect(event.description).toBe('');
    expect(event.mode).toBe('dates');
    expect(event.slotMinutes).toBe(15);
  });

  it('create() keeps optional fields that were given', () => {
    const event = HangoutEvent.create({ ...details, description: 'Planning', mode: 'weekdays', slotMinutes: 30 });
    expect(event.description).toBe('Planning');
    expect(event.mode).toBe('weekdays');
    expect(event.slotMinutes).toBe(30);
  });

  it('lists participant names, or none if they were not loaded', () => {
    const event = HangoutEvent.create(details);
    expect(event.participantNames()).toEqual([]);
    event.participants = [Participant.create('event-1', 'Luca'), Participant.create('event-1', 'Turbat')];
    expect(event.participantNames()).toEqual(['Luca', 'Turbat']);
  });
});

describe('Participant', () => {
  const nine = new Date('2026-10-07T16:00:00.000Z'); // 9:00 AM in Los Angeles
  const ten = new Date('2026-10-07T17:00:00.000Z');

  function participantFreeAt(...times: Date[]): Participant {
    const participant = Participant.create('event-1', 'Luca');
    participant.id = 'participant-1';
    participant.slots = times.map((time) => TimeSlot.create(participant, time));
    return participant;
  }

  it('create() starts with no times marked', () => {
    const participant = Participant.create('event-1', 'Luca');
    expect(participant.eventId).toBe('event-1');
    expect(participant.name).toBe('Luca');
    expect(participant.savedSlotStarts()).toEqual([]);
  });

  it('knows which times it is free at', () => {
    const participant = participantFreeAt(nine);
    expect(participant.isFreeAt(new Date('2026-10-07T16:00:00.000Z'))).toBe(true);
    expect(participant.isFreeAt(ten)).toBe(false);
  });

  it('lists saved times as sorted UTC strings', () => {
    expect(participantFreeAt(ten, nine).savedSlotStarts()).toEqual([
      '2026-10-07T16:00:00.000Z',
      '2026-10-07T17:00:00.000Z',
    ]);
  });
});

describe('TimeSlot', () => {
  it('create() copies the participant and event ids', () => {
    const participant = Participant.create('event-1', 'Ana');
    participant.id = 'participant-1';
    const slot = TimeSlot.create(participant, new Date('2026-10-07T16:00:00.000Z'));
    expect(slot.participantId).toBe('participant-1');
    expect(slot.eventId).toBe('event-1');
  });

  it('compares times by the moment, not by the Date object', () => {
    const participant = Participant.create('event-1', 'Ana');
    const slot = TimeSlot.create(participant, new Date('2026-10-07T16:00:00.000Z'));
    expect(slot.startsAt(new Date(Date.UTC(2026, 9, 7, 16)))).toBe(true);
    expect(slot.startsAt(new Date('2026-10-07T16:30:00.000Z'))).toBe(false);
  });
});
