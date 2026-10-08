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
import type { EventMode } from '../entities/hangout-event.entity';
import { trim } from './transforms';

export class CreateEventDto {
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

  /** Calendar dates in `timeZone`, "YYYY-MM-DD". */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  dates!: string[];

  /** IANA name, e.g. "America/Los_Angeles". Checked properly by TimeZoneService. */
  @IsString()
  timeZone!: string;

  /** Minutes after local midnight, e.g. 540 for 09:00. */
  @IsInt()
  @Min(0)
  @Max(1439)
  dayStartMinutes!: number;

  /** Exclusive; 1440 means the end of the day. */
  @IsInt()
  @Min(1)
  @Max(1440)
  dayEndMinutes!: number;

  @IsOptional()
  @IsIn([15, 30, 60])
  slotMinutes?: number;
}
