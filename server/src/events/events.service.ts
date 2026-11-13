import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AvailabilityAggregator } from '../scheduling/availability-aggregator.service';
import { TimeZoneService } from '../scheduling/time-zone.service';
import { CreateEventDto } from './dto/create-event.dto';
import { HangoutEvent } from './entities/hangout-event.entity';
import { Participant } from './entities/participant.entity';
import { TimeSlot } from './entities/time-slot.entity';
import {
  EventNotFoundException,
  InvalidSlotsException,
  ParticipantNotFoundException,
  WrongPasswordException,
} from './events.exceptions';
import { hashPassword, verifyPassword } from './password';
import { EventDetails } from './responses/event-details.response';
import { JoinResult } from './responses/join-result.response';

// Coordinates the work for each request: loads and saves entities, and asks
// the other classes (TimeZoneService, AvailabilityAggregator, the entities
// themselves) to do their part. NestJS passes everything in through the
// constructor (dependency injection).
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(HangoutEvent) private readonly events: Repository<HangoutEvent>,
    @InjectRepository(Participant) private readonly participants: Repository<Participant>,
    private readonly dataSource: DataSource,
    private readonly timeZones: TimeZoneService,
    private readonly aggregator: AvailabilityAggregator,
  ) {}

  async create(dto: CreateEventDto): Promise<{ id: string }> {
    // Throws InvalidScheduleException (a 400) if the zone, dates or hours are wrong
    const spec = this.timeZones.normalizeSpec({
      dates: dto.dates,
      timeZone: dto.timeZone,
      dayStartMinutes: dto.dayStartMinutes,
      dayEndMinutes: dto.dayEndMinutes,
      slotMinutes: dto.slotMinutes ?? 15,
    });
    const event = await this.events.save(HangoutEvent.create({ ...dto, ...spec }));
    return { id: event.id };
  }

  // Everything the event page shows: the event, who has joined, and who is free in each slot
  async getEvent(id: string): Promise<EventDetails> {
    const event = await this.events.findOne({
      where: { id },
      relations: { participants: { slots: true } },
    });
    if (!event) {
      throw new EventNotFoundException();
    }
    event.participants.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); // in joining order

    const heatmap = this.aggregator.aggregate(this.timeZones.generateSlots(event), event.participants);
    return new EventDetails(event, heatmap);
  }

  // Signs someone in under a name. A new name is created, protected by
  // `password` if one is given. An existing name is used again, so people can
  // come back and edit their times; a protected one needs its password.
  async join(eventId: string, name: string, password?: string): Promise<JoinResult> {
    await this.findEvent(eventId);

    const existing = await this.findParticipantByName(eventId, name);
    if (existing) {
      return this.signInExisting(existing, password);
    }

    const passwordHash = password ? await hashPassword(password) : null;
    try {
      const created = await this.participants.save(Participant.create(eventId, name, passwordHash));
      return new JoinResult(created);
    } catch (error) {
      // Two people chose the same new name at the same moment, and the
      // database's unique (eventId, name) rule rejected the second one.
      // Just sign this person in as the name that now exists.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.findParticipantByName(eventId, name);
      if (!winner) throw error;
      return this.signInExisting(winner, password);
    }
  }

  // A protected name needs its password. For a name without one, any password
  // sent is ignored, so nobody can lock someone else out of their name.
  private async signInExisting(participant: Participant, password: string | undefined): Promise<JoinResult> {
    if (participant.passwordHash && !(password && (await verifyPassword(password, participant.passwordHash)))) {
      throw new WrongPasswordException();
    }
    return new JoinResult(participant);
  }

  // Replaces a person's whole set of free slots with `slotStrings`
  async saveAvailability(eventId: string, participantId: string, slotStrings: string[]): Promise<EventDetails> {
    const event = await this.findEvent(eventId);

    // Only accept times that are real slots of this event
    const eventSlots = new Set(this.timeZones.generateSlots(event).map((slot) => slot.getTime()));
    const times = [...new Set(slotStrings.map((slot) => Date.parse(slot)))];
    const notInEvent = times.filter((time) => !eventSlots.has(time));
    if (notInEvent.length > 0) {
      throw new InvalidSlotsException(notInEvent.length, new Date(notInEvent[0]));
    }

    // Delete the old slots and insert the new ones in one transaction, so a
    // failed save never leaves someone with half their times.
    await this.dataSource.transaction(async (manager) => {
      // Locking this participant's row makes two saves for the same person
      // (say, from two open tabs) happen one after the other. Different
      // people lock different rows, so they never wait for each other.
      const participant = await manager.findOne(Participant, {
        where: { id: participantId, eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!participant) {
        throw new ParticipantNotFoundException();
      }

      await manager.delete(TimeSlot, { participantId });
      if (times.length > 0) {
        await manager.insert(
          TimeSlot,
          times.map((time) => TimeSlot.create(participant, new Date(time))),
        );
      }
    });

    return this.getEvent(eventId);
  }

  // Removes a person and (by cascading delete) all their slots
  async removeParticipant(eventId: string, participantId: string): Promise<void> {
    const result = await this.participants.delete({ id: participantId, eventId });
    if (!result.affected) {
      throw new ParticipantNotFoundException();
    }
  }

  private async findEvent(id: string): Promise<HangoutEvent> {
    const event = await this.events.findOne({ where: { id } });
    if (!event) {
      throw new EventNotFoundException();
    }
    return event;
  }

  private findParticipantByName(eventId: string, name: string): Promise<Participant | null> {
    return this.participants.findOne({ where: { eventId, name }, relations: { slots: true } });
  }
}

// Postgres error 23505 means "this would break a unique rule"
function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === '23505';
}
