import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { HangoutEvent } from './entities/hangout-event.entity';
import { Participant } from './entities/participant.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    // Registers the entities, so AppModule's autoLoadEntities creates their tables
    TypeOrmModule.forFeature([HangoutEvent, Participant, TimeSlot]),
    // Lets EventsService receive TimeZoneService and AvailabilityAggregator
    SchedulingModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
