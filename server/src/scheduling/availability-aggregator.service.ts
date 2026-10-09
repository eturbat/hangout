import { Injectable } from '@nestjs/common';
import { Participant } from '../events/entities/participant.entity';
import { Heatmap, SlotSummary } from './heatmap';

@Injectable()
export class AvailabilityAggregator {
  // For every slot in the event, asks each participant whether they're free then.
  // Times someone saved that aren't slots of the event are simply never asked about.
  aggregate(eventSlots: Date[], participants: Participant[]): Heatmap {
    const slots = eventSlots.map((time) => {
      const names = participants
        .filter((participant) => participant.isFreeAt(time))
        .map((participant) => participant.name);
      return new SlotSummary(time, names);
    });
    return new Heatmap(slots);
  }
}
