import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Participant } from './participant.entity';

// One slot a participant marked as free. A row existing means "free", so
// there is no true/false column. The primary key is (participantId, startUtc),
// so the database itself makes it impossible to mark the same slot twice.
@Entity('time_slots')
export class TimeSlot {
  @PrimaryColumn('uuid')
  participantId!: string;

  // When the slot starts. timestamptz stores an exact moment (UTC), so it
  // means the same thing no matter which time zone you look at it from.
  @PrimaryColumn({ type: 'timestamptz' })
  startUtc!: Date;

  // Copied from the participant so all of an event's slots can be found quickly
  @Index()
  @Column('uuid')
  eventId!: string;

  // Deleting a participant deletes their slots too
  @ManyToOne(() => Participant, (participant) => participant.slots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participantId' })
  participant!: Participant;

  // Factory method
  static create(participant: Participant, startUtc: Date): TimeSlot {
    const slot = new TimeSlot();
    slot.participantId = participant.id;
    slot.eventId = participant.eventId;
    slot.startUtc = startUtc;
    return slot;
  }

  startsAt(time: Date): boolean {
    return this.startUtc.getTime() === time.getTime();
  }
}
