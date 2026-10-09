import { Heatmap, SlotSummary } from '../../scheduling/heatmap';
import { EventMode, HangoutEvent } from '../entities/hangout-event.entity';

// What GET /api/events/:id returns (EventView in hangout/src/api.ts).
// Copying fields out of the entity on purpose means we decide exactly what
// leaves the server, rather than sending whatever the entity happens to hold.
export class EventDetails {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly mode: EventMode;
  readonly timeZone: string;
  readonly dates: string[];
  readonly dayStartMinutes: number;
  readonly dayEndMinutes: number;
  readonly slotMinutes: number;
  readonly createdAt: string;
  readonly participants: string[];
  readonly maxCount: number;
  readonly slots: SlotSummary[];

  constructor(event: HangoutEvent, heatmap: Heatmap) {
    this.id = event.id;
    this.title = event.title;
    this.description = event.description;
    this.mode = event.mode;
    this.timeZone = event.timeZone;
    this.dates = event.dates;
    this.dayStartMinutes = event.dayStartMinutes;
    this.dayEndMinutes = event.dayEndMinutes;
    this.slotMinutes = event.slotMinutes;
    this.createdAt = event.createdAt.toISOString();
    this.participants = event.participantNames();
    this.maxCount = heatmap.maxCount;
    this.slots = heatmap.slots;
  }
}
