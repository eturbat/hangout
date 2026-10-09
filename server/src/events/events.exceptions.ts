import { BadRequestException, NotFoundException } from '@nestjs/common';

// Our error types. Each extends one of NestJS's HTTP exceptions, so NestJS
// sends the right status code (404 or 400) and message by itself.

export class EventNotFoundException extends NotFoundException {
  constructor() {
    super('Event not found');
  }
}

export class ParticipantNotFoundException extends NotFoundException {
  constructor() {
    super('That name is no longer part of this event. Sign in again to add your times.');
  }
}

export class InvalidSlotsException extends BadRequestException {
  constructor(count: number, example: Date) {
    super(`${count} of those times are not part of this event, e.g. ${example.toISOString()}`);
  }
}
