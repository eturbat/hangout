import { BadRequestException } from '@nestjs/common';

// Thrown when an event's dates, hours or time zone don't make sense.
// It extends BadRequestException, so NestJS answers the request with a
// 400 error and this message automatically.
export class InvalidScheduleException extends BadRequestException {}
