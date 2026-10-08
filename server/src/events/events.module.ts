import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HangoutEvent } from './entities/hangout-event.entity';
import { Participant } from './entities/participant.entity';
import { TimeSlot } from './entities/time-slot.entity';

@Module({

    imports: [TypeOrmModule.forFeature([HangoutEvent, Participant, TimeSlot])],

})
export class EventsModule {}
