import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { JoinEventDto } from './dto/join-event.dto';
import { SaveAvailabilityDto } from './dto/save-availability.dto';
import { EventsService } from './events.service';

// All routes are under /api (see main.ts). ParseUUIDPipe turns a malformed id
// into a 400 instead of a Postgres error.
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.events.getEvent(id);
  }

  @Post(':id/participants')
  join(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JoinEventDto) {
    return this.events.join(id, dto.name, dto.password);
  }

  @Put(':id/participants/:participantId/availability')
  saveAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Headers('x-edit-token') token: string | undefined,
    @Body() dto: SaveAvailabilityDto,
  ) {
    return this.events.saveAvailability(id, participantId, token, dto.slots);
  }

  @Delete(':id/participants/:participantId')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Headers('x-edit-token') token: string | undefined,
  ) {
    return this.events.removeParticipant(id, participantId, token);
  }
}
