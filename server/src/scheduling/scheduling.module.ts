import { Module } from '@nestjs/common';
import { AvailabilityAggregator } from './availability-aggregator.service';
import { TimeZoneService } from './time-zone.service';

// Provides the scheduling services to any module that imports this one.
@Module({
  providers: [TimeZoneService, AvailabilityAggregator],
  exports: [TimeZoneService, AvailabilityAggregator],
})
export class SchedulingModule {}
