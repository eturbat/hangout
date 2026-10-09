import { Participant } from '../events/entities/participant.entity';
import { TimeSlot } from '../events/entities/time-slot.entity';
import { AvailabilityAggregator } from './availability-aggregator.service';

const aggregator = new AvailabilityAggregator();
const at = (hourUtc: number) => new Date(Date.UTC(2026, 9, 7, hourUtc)); // 2026-10-07, hh:00 UTC
const eventSlots = [at(16), at(17), at(18)];

// A real Participant, so the aggregator calls its isFreeAt() method
function person(name: string, hours: number[]): Participant {
  const participant = Participant.create('event-1', name);
  participant.id = `id-${name}`;
  participant.slots = hours.map((hour) => TimeSlot.create(participant, at(hour)));
  return participant;
}

describe('AvailabilityAggregator', () => {
  it('counts who is free in each slot, names in alphabetical order', () => {
    const heatmap = aggregator.aggregate(eventSlots, [person('Turbat', [16, 17]), person('Luca', [17])]);
    expect(heatmap.maxCount).toBe(2);
    expect(heatmap.slots).toEqual([
      { start: '2026-10-07T16:00:00.000Z', count: 1, names: ['Turbat'] },
      { start: '2026-10-07T17:00:00.000Z', count: 2, names: ['Luca', 'Turbat'] },
      { start: '2026-10-07T18:00:00.000Z', count: 0, names: [] },
    ]);
  });

  it('ignores saved times that are not slots of the event', () => {
    const heatmap = aggregator.aggregate(eventSlots, [person('Ana', [16, 20])]);
    expect(heatmap.maxCount).toBe(1);
    expect(heatmap.slots.map((slot) => slot.count)).toEqual([1, 0, 0]);
  });

  it('returns an empty heatmap when nobody has responded', () => {
    const heatmap = aggregator.aggregate(eventSlots, []);
    expect(heatmap.maxCount).toBe(0);
    expect(heatmap.slots.map((slot) => slot.count)).toEqual([0, 0, 0]);
  });

  it('produces exactly the JSON fields the frontend reads', () => {
    const heatmap = aggregator.aggregate([at(16)], [person('Luca', [16])]);
    expect(JSON.parse(JSON.stringify(heatmap))).toEqual({
      slots: [{ start: '2026-10-07T16:00:00.000Z', count: 1, names: ['Luca'] }],
      maxCount: 1,
    });
  });
});
