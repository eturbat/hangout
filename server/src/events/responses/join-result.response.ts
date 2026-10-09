import { Participant } from '../entities/participant.entity';

// What POST /api/events/:id/participants returns (Session in hangout/src/api.ts).
// participantId goes into the URL when saving or removing this person's times.
export class JoinResult {
  readonly participantId: string;
  readonly name: string;
  readonly slots: string[]; // their saved times, so the grid can show them

  constructor(participant: Participant) {
    this.participantId = participant.id;
    this.name = participant.name;
    this.slots = participant.savedSlotStarts();
  }
}
