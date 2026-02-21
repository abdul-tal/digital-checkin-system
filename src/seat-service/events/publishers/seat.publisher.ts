import { EventBus } from '../../../shared/events/event-bus';

export class SeatPublisher {
  constructor(private eventBus: EventBus) {}

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    await this.eventBus.publish(eventType, data);
  }
}
