// The heatmap data the frontend draws. Both are plain classes whose fields
// become the JSON response, matching SlotSummary and EventView in hangout/src/api.ts.

// One slot: when it starts and who is free then
export class SlotSummary {
  readonly start: string; // UTC, e.g. "2026-10-07T16:00:00.000Z"
  readonly count: number;
  readonly names: string[]; // alphabetical

  constructor(time: Date, names: string[]) {
    this.start = time.toISOString();
    this.names = [...names].sort((a, b) => a.localeCompare(b));
    this.count = this.names.length;
  }
}

// Every slot of an event, plus the highest count (the frontend scales the colours against it)
export class Heatmap {
  readonly slots: SlotSummary[];
  readonly maxCount: number;

  constructor(slots: SlotSummary[]) {
    this.slots = slots;
    this.maxCount = slots.reduce((max, slot) => Math.max(max, slot.count), 0);
  }
}
