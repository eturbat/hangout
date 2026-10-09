import { Injectable } from '@nestjs/common';
import { InvalidScheduleException } from './invalid-schedule.exception';
import { SlotSpec } from './slot-spec';
import { WallTime, normalizeTimeZone, parseIsoDate, utcFromWallTime, wallTimeAt } from './zoned-time';

export const SLOT_SIZES: readonly number[] = [15, 30, 60];
export const MAX_DATES = 31;

// All of the server's time zone logic, behind one class. The low-level
// conversions live in zoned-time.ts (shared with the frontend); this class
// is the easy-to-use front for them. Every time it hands out is UTC;
// converting to someone's zone is only ever for display.
@Injectable()
export class TimeZoneService {
  // Checks a spec and returns a clean copy: the zone name spelled the
  // standard way, and the dates sorted with duplicates removed.
  // Throws InvalidScheduleException if anything doesn't make sense.
  normalizeSpec(spec: SlotSpec): SlotSpec {
    const timeZone = normalizeTimeZone(spec.timeZone);
    if (!timeZone) {
      throw new InvalidScheduleException(`Unknown time zone "${spec.timeZone}"`);
    }

    const { dayStartMinutes: start, dayEndMinutes: end, slotMinutes } = spec;
    if (!SLOT_SIZES.includes(slotMinutes)) {
      throw new InvalidScheduleException(`Slot length must be one of ${SLOT_SIZES.join(', ')} minutes`);
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) {
      throw new InvalidScheduleException('The day has to start before it ends, between 0 and 1440 minutes');
    }
    if (start % slotMinutes !== 0 || end % slotMinutes !== 0) {
      throw new InvalidScheduleException(`The day has to start and end on a ${slotMinutes}-minute boundary`);
    }

    const dates = [...new Set(spec.dates)].sort();
    if (dates.length === 0) {
      throw new InvalidScheduleException('Pick at least one date');
    }
    if (dates.length > MAX_DATES) {
      throw new InvalidScheduleException(`Pick at most ${MAX_DATES} dates`);
    }
    for (const date of dates) {
      if (!parseIsoDate(date)) {
        throw new InvalidScheduleException(`"${date}" is not a real date in YYYY-MM-DD form`);
      }
    }

    return { dates, timeZone, dayStartMinutes: start, dayEndMinutes: end, slotMinutes };
  }

  // The start of every slot in the event, in order.
  //
  // Only the two edges of each day's window are converted from local time
  // to UTC; between them we step through real time. So a daylight saving day
  // automatically gets one hour fewer (spring forward) or one more (fall back),
  // and the grid never contains a time that didn't happen.
  generateSlots(spec: SlotSpec): Date[] {
    const s = this.normalizeSpec(spec);
    const step = s.slotMinutes * 60_000;
    const slots: Date[] = [];
    for (const date of s.dates) {
      const start = this.instantOnDate(date, s.dayStartMinutes, s.timeZone);
      const end = this.instantOnDate(date, s.dayEndMinutes, s.timeZone);
      for (let t = start; t < end; t += step) {
        slots.push(new Date(t));
      }
    }
    return slots;
  }

  isValidTimeZone(timeZone: string): boolean {
    return normalizeTimeZone(timeZone) !== null;
  }

  // A moment in time -> what the clocks read in `timeZone`
  toWallTime(time: Date, timeZone: string): WallTime {
    return wallTimeAt(time.getTime(), timeZone);
  }

  // What the clocks read in `timeZone` -> the moment in time
  fromWallTime(wall: WallTime, timeZone: string): Date {
    return new Date(utcFromWallTime(wall, timeZone));
  }

  private instantOnDate(date: string, minutes: number, timeZone: string): number {
    // Never compute this as "local midnight + N minutes": on a daylight saving
    // day that lands an hour off, so 9:00 would come out as 8:00 or 10:00.
    const d = parseIsoDate(date)!;
    return utcFromWallTime({ ...d, hour: Math.floor(minutes / 60), minute: minutes % 60 }, timeZone);
  }
}
