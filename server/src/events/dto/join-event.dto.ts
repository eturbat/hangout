import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { emptyToUndefined, trim } from './transforms';

// The body of POST /api/events/:id/participants: the person's name, and an
// optional password. A password given with a new name protects that name; a
// protected name needs it again to sign back in.
export class JoinEventDto {
  @IsString()
  @Transform(trim)
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Length(1, 200)
  password?: string;
}
