import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Participant } from './participant.entity';

// 'dates' = specific calendar dates; 'weekdays' = a general week (milestone 2)
export type EventMode = 'dates' | 'weekdays';

// What the organizer fills in on the create-event form
export interface NewEventDetails {
  title: string;
  description?: string;
  mode?: EventMode;
  dates: string[];
  timeZone: string;
  dayStartMinutes: number;
  dayEndMinutes: number;
  slotMinutes?: number;
}

// Named HangoutEvent, not Event: Node and browsers already have a global
// class called Event, and a forgotten import would silently use that one.
@Entity('events')
export class HangoutEvent {
  // A random UUID, so nobody can guess the link to someone else's event
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 10, default: 'dates' })
  mode!: EventMode;

  // "YYYY-MM-DD" strings in the event's time zone. Stored as text[], not
  // date[]: the Postgres driver turns DATE values into JavaScript Dates at
  // the server's local midnight, which would bring back time zone bugs.
  @Column('text', { array: true })
  dates!: string[];

  // IANA time zone the dates and hours are in, e.g. "America/Los_Angeles"
  @Column({ type: 'varchar', length: 64 })
  timeZone!: string;

  // The daily window as minutes after midnight: 540 = 9:00 AM.
  // dayEndMinutes is exclusive, and 1440 means the end of the day.
  @Column({ type: 'smallint' })
  dayStartMinutes!: number;

  @Column({ type: 'smallint' })
  dayEndMinutes!: number;

  // Length of one grid slot: 15, 30 or 60 minutes
  @Column({ type: 'smallint', default: 15 })
  slotMinutes!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => Participant, (participant) => participant.event)
  participants!: Participant[];

  // Factory method: builds a new, not-yet-saved event from the form details.
  // Checking that the time zone and hours make sense is TimeZoneService's job (next PR).
  static create(details: NewEventDetails): HangoutEvent {
    const event = new HangoutEvent();
    event.title = details.title;
    event.description = details.description ?? '';
    event.mode = details.mode ?? 'dates';
    event.dates = [...new Set(details.dates)].sort();
    event.timeZone = details.timeZone;
    event.dayStartMinutes = details.dayStartMinutes;
    event.dayEndMinutes = details.dayEndMinutes;
    event.slotMinutes = details.slotMinutes ?? 15;
    return event;
  }

  // Names of everyone who has joined. Empty if participants weren't loaded.
  participantNames(): string[] {
    return (this.participants ?? []).map((participant) => participant.name);
  }
}
