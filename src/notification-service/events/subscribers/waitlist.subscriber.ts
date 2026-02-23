import { EventBus, Event } from '../../../shared/events/event-bus';
import { NotificationDispatcherService } from '../../services/notification-dispatcher.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('waitlist-subscriber');

export class WaitlistSubscriber {
  constructor(
    private eventBus: EventBus,
    private dispatcher: NotificationDispatcherService
  ) {}

  start(): void {
    this.eventBus.subscribe('waitlist.assigned', this.handleWaitlistAssigned.bind(this));
    this.eventBus.subscribe(
      'waitlist.checkin.completed',
      this.handleWaitlistCheckinCompleted.bind(this)
    );
    logger.info('Waitlist subscriber started');
  }

  private async handleWaitlistAssigned(event: Event): Promise<void> {
    logger.info('Waitlist assigned event received', { eventId: event.eventId });

    await this.dispatcher.send({
      passengerId: event.data.passengerId,
      type: 'WAITLIST_SEAT_AVAILABLE',
      channels: ['push', 'email'],
      data: event.data,
    });
  }

  private async handleWaitlistCheckinCompleted(event: Event): Promise<void> {
    logger.info('Waitlist check-in completed event received', {
      eventId: event.eventId,
      checkInId: event.data.checkInId,
    });

    await this.dispatcher.send({
      passengerId: event.data.passengerId,
      type: 'WAITLIST_CHECKIN_COMPLETED',
      channels: ['push', 'email', 'sms'],
      data: event.data,
    });
  }
}
