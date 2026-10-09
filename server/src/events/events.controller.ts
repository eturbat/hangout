import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { JoinEventDto } from './dto/join-event.dto';
import { SaveAvailabilityDto } from './dto/save-availability.dto';
import { EventsService } from './events.service';

// The HTTP routes, all under /api (see app.setup.ts). This class only turns
// requests into method calls; EventsService does the work.
// ParseUUIDPipe answers 400 for an id that isn't a UUID, instead of a database error.
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // POST /api/events -> { id }
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  // GET /api/events/:id -> the event, who joined, and who is free in each slot
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getEvent(id);
  }

  // POST /api/events/:id/participants { name } -> { participantId, name, slots }
  @Post(':id/participants')
  join(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JoinEventDto) {
    return this.eventsService.join(id, dto.name);
  }

  // PUT /api/events/:id/participants/:participantId/availability { slots } -> the refreshed event
  @Put(':id/participants/:participantId/availability')
  saveAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: SaveAvailabilityDto,
  ) {
    return this.eventsService.saveAvailability(id, participantId, dto.slots);
  }

  // DELETE /api/events/:id/participants/:participantId -> 204 No Content
  @Delete(':id/participants/:participantId')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('participantId', ParseUUIDPipe) participantId: string) {
    return this.eventsService.removeParticipant(id, participantId);
  }
}
