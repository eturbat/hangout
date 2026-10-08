import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';
import { emptyToUndefined, trim } from './transforms';

export class JoinEventDto {
  @IsString()
  @Transform(trim)
  @Length(1, 80)
  name!: string;

  /** Only used the first time a name is saved, or to unlock a protected name. */
  // @IsOptional()
  // @Transform(emptyToUndefined)
  // @IsString()
  // @Length(1, 200)
  // password?: string;
}
