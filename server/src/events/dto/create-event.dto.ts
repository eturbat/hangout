import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventMode, NewEventDetails } from '../entities/hangout-event.entity';
import { trim } from './transforms';

// The body of POST /api/events. The decorators are the rules ValidationPipe
// checks before the request reaches EventsService. Whether the time zone is
// real and the hours line up is checked by TimeZoneService.normalizeSpec().
export class CreateEventDto implements NewEventDetails {
  @IsString()
  @Transform(trim)
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['dates', 'weekdays'])
  mode?: EventMode;

  // Calendar dates in `timeZone`
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'each date must look like 2026-10-07' })
  dates!: string[];

  // IANA name, e.g. "America/Los_Angeles"
  @IsString()
  timeZone!: string;

  // Minutes after local midnight, e.g. 540 for 9:00 AM
  @IsInt()
  @Min(0)
  @Max(1439)
  dayStartMinutes!: number;

  // Exclusive; 1440 means the end of the day
  @IsInt()
  @Min(1)
  @Max(1440)
  dayEndMinutes!: number;

  @IsOptional()
  @IsIn([15, 30, 60])
  slotMinutes?: number;
}
