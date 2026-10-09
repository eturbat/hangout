import { InvalidScheduleException } from './invalid-schedule.exception';
import { SlotSpec } from './slot-spec';
import { TimeZoneService } from './time-zone.service';

// Expected values are literal UTC strings worked out by hand from published
// offsets. They are never computed with the code under test, so a bug in the
// conversion can't quietly agree with itself.

const tz = new TimeZoneService();

const LA = 'America/Los_Angeles';
const BERLIN = 'Europe/Berlin';
const ULAANBAATAR = 'Asia/Ulaanbaatar'; // UTC+8 all year, no DST since 2017

/** "09:30" -> 570 */
const hm = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function spec(timeZone: string, dates: string[], from: string, to: string, slotMinutes = 60): SlotSpec {
  return { timeZone, dates, dayStartMinutes: hm(from), dayEndMinutes: hm(to), slotMinutes };
}

const iso = (slots: Date[]) => slots.map((t) => t.toISOString());

/** How a moment reads on a wall clock in `timeZone`, as "YYYY-MM-DD HH:MM". */
function wallLabel(time: Date, timeZone: string): string {
  const w = tz.toWallTime(time, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.year}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}`;
}

describe('generateSlots on ordinary days', () => {
  it('converts a Los Angeles morning to UTC (PDT is UTC-7)', () => {
    expect(iso(tz.generateSlots(spec(LA, ['2026-10-07'], '09:00', '10:00', 30)))).toEqual([
      '2026-10-07T16:00:00.000Z',
      '2026-10-07T16:30:00.000Z',
    ]);
  });

  it('converts an Ulaanbaatar morning to UTC (UTC+8)', () => {
    expect(iso(tz.generateSlots(spec(ULAANBAATAR, ['2026-10-07'], '09:00', '10:00', 30)))).toEqual([
      '2026-10-07T01:00:00.000Z',
      '2026-10-07T01:30:00.000Z',
    ]);
  });

  it('handles a quarter-hour offset (Kathmandu is UTC+5:45)', () => {
    expect(iso(tz.generateSlots(spec('Asia/Kathmandu', ['2026-10-07'], '09:00', '10:00', 15)))).toEqual([
      '2026-10-07T03:15:00.000Z',
      '2026-10-07T03:30:00.000Z',
      '2026-10-07T03:45:00.000Z',
      '2026-10-07T04:00:00.000Z',
    ]);
  });

  it('sorts and de-duplicates dates', () => {
    const slots = tz.generateSlots(spec(LA, ['2026-10-08', '2026-10-07', '2026-10-08'], '09:00', '10:00'));
    expect(iso(slots)).toEqual(['2026-10-07T16:00:00.000Z', '2026-10-08T16:00:00.000Z']);
  });

  it('gives a whole ordinary day 96 quarter-hour slots, ending at 23:45', () => {
    const slots = tz.generateSlots(spec(LA, ['2026-10-07'], '00:00', '24:00', 15));
    expect(slots).toHaveLength(96);
    expect(wallLabel(slots[95], LA)).toBe('2026-10-07 23:45');
  });
});

describe('the milestone 1 demo: Los Angeles organizer, Ulaanbaatar viewer', () => {
  it('shows a 9-to-5 LA day as midnight to 8am the next day in Ulaanbaatar', () => {
    const slots = tz.generateSlots(spec(LA, ['2026-10-07'], '09:00', '17:00'));
    expect(slots).toHaveLength(8);
    expect(wallLabel(slots[0], ULAANBAATAR)).toBe('2026-10-08 00:00');
    expect(wallLabel(slots[7], ULAANBAATAR)).toBe('2026-10-08 07:00');
  });
});

describe('daylight saving time', () => {
  it('skips the hour that never happens when LA springs forward (2026-03-08)', () => {
    const slots = tz.generateSlots(spec(LA, ['2026-03-08'], '00:00', '04:00'));
    expect(iso(slots)).toEqual([
      '2026-03-08T08:00:00.000Z',
      '2026-03-08T09:00:00.000Z',
      '2026-03-08T10:00:00.000Z',
    ]);
    expect(slots.map((t) => wallLabel(t, LA))).toEqual([
      '2026-03-08 00:00',
      '2026-03-08 01:00',
      '2026-03-08 03:00',
    ]);
  });

  it('includes the repeated hour twice when LA falls back (2026-11-01)', () => {
    const slots = tz.generateSlots(spec(LA, ['2026-11-01'], '00:00', '04:00'));
    expect(iso(slots)).toEqual([
      '2026-11-01T07:00:00.000Z',
      '2026-11-01T08:00:00.000Z',
      '2026-11-01T09:00:00.000Z',
      '2026-11-01T10:00:00.000Z',
      '2026-11-01T11:00:00.000Z',
    ]);
    expect(slots.map((t) => wallLabel(t, LA))).toEqual([
      '2026-11-01 00:00',
      '2026-11-01 01:00',
      '2026-11-01 01:00',
      '2026-11-01 02:00',
      '2026-11-01 03:00',
    ]);
  });

  it('keeps 9am at 9am on both DST days (the "midnight + N minutes" trap)', () => {
    expect(iso(tz.generateSlots(spec(LA, ['2026-03-08'], '09:00', '10:00')))).toEqual([
      '2026-03-08T16:00:00.000Z',
    ]);
    expect(iso(tz.generateSlots(spec(LA, ['2026-11-01'], '09:00', '10:00')))).toEqual([
      '2026-11-01T17:00:00.000Z',
    ]);
  });

  it('gives whole DST days 92 and 100 quarter-hour slots', () => {
    expect(tz.generateSlots(spec(LA, ['2026-03-08'], '00:00', '24:00', 15))).toHaveLength(92);
    expect(tz.generateSlots(spec(LA, ['2026-11-01'], '00:00', '24:00', 15))).toHaveLength(100);
  });

  it('handles a 30-minute DST shift (Lord Howe Island, 2026-10-04)', () => {
    const zone = 'Australia/Lord_Howe'; // UTC+10:30, then +11:00 from 02:00 local
    const slots = tz.generateSlots(spec(zone, ['2026-10-04'], '01:00', '04:00', 30));
    expect(iso(slots)).toEqual([
      '2026-10-03T14:30:00.000Z',
      '2026-10-03T15:00:00.000Z',
      '2026-10-03T15:30:00.000Z',
      '2026-10-03T16:00:00.000Z',
      '2026-10-03T16:30:00.000Z',
    ]);
    expect(slots.map((t) => wallLabel(t, zone))).toEqual([
      '2026-10-04 01:00',
      '2026-10-04 01:30',
      '2026-10-04 02:30',
      '2026-10-04 03:00',
      '2026-10-04 03:30',
    ]);
  });

  it('tracks SF, Berlin and Ulaanbaatar across both fall changes (EU Oct 25, US Nov 1)', () => {
    const [oct24, oct26, nov2] = tz.generateSlots(
      spec(LA, ['2026-10-24', '2026-10-26', '2026-11-02'], '09:00', '10:00'),
    );
    // Normally 9 hours apart; only 8 while Europe has switched and the US hasn't.
    expect([oct24, oct26, nov2].map((t) => wallLabel(t, BERLIN))).toEqual([
      '2026-10-24 18:00',
      '2026-10-26 17:00',
      '2026-11-02 18:00',
    ]);
    // Ulaanbaatar never changes, so it only moves when LA does.
    expect([oct24, oct26, nov2].map((t) => wallLabel(t, ULAANBAATAR))).toEqual([
      '2026-10-25 00:00',
      '2026-10-27 00:00',
      '2026-11-03 01:00',
    ]);
  });

  it('puts every 15-minute UTC slot on a quarter hour in every zone', () => {
    const zones = [LA, BERLIN, ULAANBAATAR, 'Asia/Kolkata', 'Asia/Kathmandu',
      'Australia/Adelaide', 'Australia/Lord_Howe', 'Pacific/Chatham'];
    const slots = tz.generateSlots(spec('UTC', ['2026-10-03', '2026-10-04'], '00:00', '24:00', 15));
    for (const zone of zones) {
      const offGrid = slots.filter((t) => tz.toWallTime(t, zone).minute % 15 !== 0);
      expect(offGrid).toEqual([]);
    }
  });
});

describe('fromWallTime at DST transitions', () => {
  it('moves a wall time inside the spring-forward gap forward by the gap', () => {
    const t = tz.fromWallTime({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, LA);
    expect(t.toISOString()).toBe('2026-03-08T10:30:00.000Z'); // clocks show 03:30
  });

  it('picks the earlier instant for a wall time inside the fall-back overlap', () => {
    const t = tz.fromWallTime({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, LA);
    expect(t.toISOString()).toBe('2026-11-01T08:30:00.000Z'); // 01:30 PDT
  });
});

describe('normalizeSpec', () => {
  const good = spec(LA, ['2026-10-07'], '09:00', '17:00', 15);

  it('recognises real zone names and rejects others', () => {
    expect(tz.isValidTimeZone('Asia/Ulaanbaatar')).toBe(true);
    expect(tz.isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(tz.isValidTimeZone('+05:30')).toBe(false);
  });

  it('fixes the capitalisation of zone names', () => {
    expect(tz.normalizeSpec({ ...good, timeZone: 'asia/ulaanbaatar' }).timeZone).toBe(ULAANBAATAR);
  });

  const bad: Array<[string, Partial<SlotSpec>]> = [
    ['an unknown zone', { timeZone: 'Mars/Olympus_Mons' }],
    ['a fixed offset instead of a zone', { timeZone: '+05:30' }],
    ['a window that ends before it starts', { dayStartMinutes: hm('17:00'), dayEndMinutes: hm('09:00') }],
    ['a window off the slot grid', { dayStartMinutes: hm('09:10') }],
    ['an unsupported slot size', { slotMinutes: 20 }],
    ['an impossible date', { dates: ['2026-02-30'] }],
    ['no dates', { dates: [] }],
    ['too many dates', {
      dates: Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)),
    }],
  ];
  for (const [label, change] of bad) {
    it(`rejects ${label}`, () => {
      expect(() => tz.normalizeSpec({ ...good, ...change })).toThrow(InvalidScheduleException);
    });
  }
});
