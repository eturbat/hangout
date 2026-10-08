import { ArrayMaxSize, IsArray, IsISO8601 } from 'class-validator';

export class SaveAvailabilityDto {
  /** Every slot this participant is free, as UTC ISO strings from the event's slot list. Replaces the previous set. */
  @IsArray()
  @ArrayMaxSize(3000)
  @IsISO8601({ strict: true }, { each: true })
  slots!: string[];
}

