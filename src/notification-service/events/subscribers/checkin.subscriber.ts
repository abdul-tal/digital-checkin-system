import { EventBus, Event } from '../../../shared/events/event-bus';
import { NotificationDispatcherService } from '../../services/notification-dispatcher.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('checkin-subscriber');

export class CheckInSubscriber {
  constructor(
    private eventBus: EventBus,
    private dispatcher: NotificationDispatcherService
  ) {}

  start(): void {
    this.eventBus.subscribe('checkin.completed', this.handleCheckInCompleted.bind(this));
    logger.info('Check-in subscriber started');
  }

  private async handleCheckInCompleted(event: Event): Promise<void> {
    logger.info('Check-in completed event received', { eventId: event.eventId });

    await this.dispatcher.send({
      passengerId: event.data.passengerId,
      type: 'CHECKIN_COMPLETED',
      channels: ['push', 'email'],
      data: event.data,
    });
  }
}
