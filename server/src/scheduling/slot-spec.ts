// What an event's grid is made of, described in the event's own time zone.
// HangoutEvent implements this, and tests can pass a plain object instead.
export interface SlotSpec {
  // Calendar dates in `timeZone`, as "YYYY-MM-DD"
  dates: string[];
  // IANA zone name, e.g. "America/Los_Angeles"
  timeZone: string;
  // Minutes after local midnight when each day's window opens (540 = 9:00 AM)
  dayStartMinutes: number;
  // Minutes after local midnight when it closes, exclusive (1440 = end of day)
  dayEndMinutes: number;
  slotMinutes: number;
}
