import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trim } from './transforms';

// The body of POST /api/events/:id/participants: just the person's name.
export class JoinEventDto {
  @IsString()
  @Transform(trim)
  @Length(1, 80)
  name!: string;
}
