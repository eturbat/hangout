import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AvailabilityAggregator, SlotSummary } from '../scheduling/availability-aggregator.service';
import { InvalidScheduleError, SlotSpec, TimeZoneService } from '../scheduling/time-zone.service';
import { EditTokenService } from '../security/edit-token.service';
import { PasswordHasher } from '../security/password-hasher';
import { CreateEventDto } from './dto/create-event.dto';
import { EventMode, HangoutEvent } from './entities/hangout-event.entity';
import { Participant } from './entities/participant.entity';
import { TimeSlot } from './entities/time-slot.entity';

/** What GET /api/events/:id returns. Mirrored in hangout/src/api.ts. */
export interface EventView {
  id: string;
  title: string;
  description: string;
  mode: EventMode;
  timeZone: string;
  dates: string[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  slotMinutes: number;
  createdAt: string;
  /** Names of everyone who has saved availability. */
  participants: string[];
  maxCount: number;
  /** Every slot in order, with who is free. Starts are UTC ISO strings. */
  slots: SlotSummary[];
}

export interface JoinResult {
  participantId: string;
  name: string;
  /** Send as the X-Edit-Token header to save or delete this participant's availability. */
  editToken: string;
  /** This participant's saved slots, so the grid can show their selection. */
  slots: string[];
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(HangoutEvent) private readonly events: Repository<HangoutEvent>,
    @InjectRepository(Participant) private readonly participants: Repository<Participant>,
    private readonly dataSource: DataSource,
    private readonly timeZones: TimeZoneService,
    private readonly aggregator: AvailabilityAggregator,
    private readonly passwords: PasswordHasher,
    private readonly tokens: EditTokenService,
  ) {}

  async create(dto: CreateEventDto): Promise<{ id: string }> {
    let spec: SlotSpec;
    try {
      spec = this.timeZones.normalizeSpec({
        dates: dto.dates,
        timeZone: dto.timeZone,
        dayStartMinutes: dto.dayStartMinutes,
        dayEndMinutes: dto.dayEndMinutes,
        slotMinutes: dto.slotMinutes ?? 15,
      });
    } catch (error) {
      if (error instanceof InvalidScheduleError) throw new BadRequestException(error.message);
      throw error;
    }

    const event = await this.events.save(
      this.events.create({
        title: dto.title,
        description: dto.description ?? '',
        mode: dto.mode ?? 'dates',
        ...spec,
      }),
    );
    return { id: event.id };
  }

  async getEvent(id: string): Promise<EventView> {
    const event = await this.findEvent(id);
    const participants = await this.participants.find({
      where: { eventId: id },
      relations: { slots: true },
      order: { createdAt: 'ASC' },
    });

    const heatmap = this.aggregator.aggregate(
      this.timeZones.generateSlots(specOf(event)),
      participants.map((p) => ({ name: p.name, slotStarts: p.slots.map((s) => s.startUtc.getTime()) })),
    );

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      mode: event.mode,
      timeZone: event.timeZone,
      dates: event.dates,
      dayStartMinutes: event.dayStartMinutes,
      dayEndMinutes: event.dayEndMinutes,
      slotMinutes: event.slotMinutes,
      createdAt: event.createdAt.toISOString(),
      participants: participants.map((p) => p.name),
      maxCount: heatmap.maxCount,
      slots: heatmap.slots,
    };
  }

  /**
   * Signs in under a name, creating the participant the first time. A name
   * saved with a password needs that password; one saved without can be
   * edited by anyone who types it, which is how when2meet behaves.
   */
  async join(eventId: string, name: string, isRetry = false): Promise<JoinResult> {
    await this.findEvent(eventId);

    let participant = await this.participants.findOne({
      where: { eventId, name },
      relations: { slots: true },
    });

    if (participant) {
      try {
        participant = await this.participants.save(
          this.participants.create({
            eventId,
            name,
            passwordHash: password ? await this.passwords.hash(password) : null,
          }),
        );
        participant.slots = [];
      } catch (error) {
        // Someone created the same name a moment ago; sign in as them instead.
        if (isUniqueViolation(error) && !isRetry) return this.join(eventId, name, password, true);
        throw error;
      }

    return {
      participantId: participant.id,
      name: participant.name,
      editToken: this.tokens.issue(participant.id),
      slots: participant.slots.map((s) => s.startUtc.toISOString()).sort(),
    };
  }

  /** Replaces a participant's whole set of available slots. */
  async saveAvailability(
    eventId: string,
    participantId: string,
    token: string | undefined,
    slotStrings: string[],
  ): Promise<EventView> {
    this.assertCanEdit(participantId, token);
    const event = await this.findEvent(eventId);

    const validSlots = new Set(this.timeZones.generateSlots(specOf(event)));
    const starts = [...new Set(slotStrings.map((s) => Date.parse(s)))];
    const unknown = starts.filter((t) => !validSlots.has(t));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `${unknown.length} slot(s) are not part of this event, e.g. ${new Date(unknown[0]).toISOString()}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Locking the participant row serialises saves for the same person (two
      // open tabs). Different people lock different rows, so they never wait.
      const participant = await manager.findOne(Participant, {
        where: { id: participantId, eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!participant) throw new NotFoundException('Participant not found');

      await manager.delete(TimeSlot, { participantId });
      if (starts.length > 0) {
        await manager.insert(
          TimeSlot,
          starts.map((t) => ({ participantId, eventId, startUtc: new Date(t) })),
        );
      }
    });

    return this.getEvent(eventId);
  }

  async removeParticipant(eventId: string, participantId: string, token: string | undefined): Promise<void> {
    this.assertCanEdit(participantId, token);
    const result = await this.participants.delete({ id: participantId, eventId });
    if (!result.affected) throw new NotFoundException('Participant not found');
  }

  private assertCanEdit(participantId: string, token: string | undefined): void {
    if (!this.tokens.isValid(participantId, token)) {
      throw new UnauthorizedException('Missing or invalid X-Edit-Token');
    }
  }

  private async findEvent(id: string): Promise<HangoutEvent> {
    const event = await this.events.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}

function specOf(event: HangoutEvent): SlotSpec {
  return {
    dates: event.dates,
    timeZone: event.timeZone,
    dayStartMinutes: event.dayStartMinutes,
    dayEndMinutes: event.dayEndMinutes,
    slotMinutes: event.slotMinutes,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === '23505';
}

