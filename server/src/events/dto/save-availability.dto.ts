import { ArrayMaxSize, IsArray, IsISO8601 } from 'class-validator';

// The body of PUT /api/events/:id/participants/:participantId/availability.
// Every slot the person is free, as UTC ISO strings. Replaces what they saved before.
export class SaveAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(3000)
  @IsISO8601({ strict: true }, { each: true })
  slots!: string[];
}
