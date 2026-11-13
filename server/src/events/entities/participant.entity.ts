import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { HangoutEvent } from './hangout-event.entity';
import { TimeSlot } from './time-slot.entity';

// Someone who joined an event under a name. There are no accounts: entering a
// name signs you in as that name, like when2meet, unless whoever created the
// name protected it with a password.
@Entity('participants')
@Unique(['eventId', 'name']) // a name can only be used once per event
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  eventId!: string;

  // Deleting an event deletes its participants too
  @ManyToOne(() => HangoutEvent, (event) => event.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event!: HangoutEvent;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  // scrypt hash (see events/password.ts), or null if the name isn't protected.
  // Never sent to the browser: EventDetails and JoinResult copy only what they need.
  @Column({ type: 'text', nullable: true })
  passwordHash!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => TimeSlot, (slot) => slot.participant)
  slots!: TimeSlot[];

  // Factory method: a new, not-yet-saved participant with no times marked
  static create(eventId: string, name: string, passwordHash: string | null = null): Participant {
    const participant = new Participant();
    participant.eventId = eventId;
    participant.name = name;
    participant.passwordHash = passwordHash;
    participant.slots = [];
    return participant;
  }

  isFreeAt(time: Date): boolean {
    return (this.slots ?? []).some((slot) => slot.startsAt(time));
  }

  // The times this person marked, as sorted UTC ISO strings (what the frontend expects)
  savedSlotStarts(): string[] {
    return (this.slots ?? []).map((slot) => slot.startUtc.toISOString()).sort();
  }
}
