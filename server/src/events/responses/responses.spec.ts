import { Heatmap, SlotSummary } from '../../scheduling/heatmap';
import { HangoutEvent } from '../entities/hangout-event.entity';
import { Participant } from '../entities/participant.entity';
import { TimeSlot } from '../entities/time-slot.entity';
import { EventDetails } from './event-details.response';
import { JoinResult } from './join-result.response';

// The JSON these classes become must match EventView and Session in hangout/src/api.ts
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('EventDetails', () => {
  it('becomes exactly the JSON the frontend reads', () => {
    const event = HangoutEvent.create({
      title: 'Study call',
      dates: ['2026-10-07'],
      timeZone: 'America/Los_Angeles',
      dayStartMinutes: 540,
      dayEndMinutes: 1020,
    });
    event.id = 'event-1';
    event.createdAt = new Date('2026-10-08T12:00:00.000Z');
    event.participants = [Participant.create('event-1', 'Luca')];
    const heatmap = new Heatmap([new SlotSummary(new Date('2026-10-07T16:00:00.000Z'), ['Luca'])]);

    expect(asJson(new EventDetails(event, heatmap))).toEqual({
      id: 'event-1',
      title: 'Study call',
      description: '',
      mode: 'dates',
      timeZone: 'America/Los_Angeles',
      dates: ['2026-10-07'],
      dayStartMinutes: 540,
      dayEndMinutes: 1020,
      slotMinutes: 15,
      createdAt: '2026-10-08T12:00:00.000Z',
      participants: ['Luca'],
      maxCount: 1,
      slots: [{ start: '2026-10-07T16:00:00.000Z', count: 1, names: ['Luca'] }],
    });
  });
});

describe('JoinResult', () => {
  it('has the participant id, name and saved times, and nothing else', () => {
    const participant = Participant.create('event-1', 'Luca');
    participant.id = 'participant-1';
    participant.slots = [
      TimeSlot.create(participant, new Date('2026-10-07T17:00:00.000Z')),
      TimeSlot.create(participant, new Date('2026-10-07T16:00:00.000Z')),
    ];

    expect(asJson(new JoinResult(participant))).toEqual({
      participantId: 'participant-1',
      name: 'Luca',
      slots: ['2026-10-07T16:00:00.000Z', '2026-10-07T17:00:00.000Z'],
    });
  });
});
