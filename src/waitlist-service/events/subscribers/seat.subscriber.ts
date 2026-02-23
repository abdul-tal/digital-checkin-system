import { EventBus, Event } from '../../../shared/events/event-bus';
import { WaitlistManagerService } from '../../services/waitlist-manager.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('seat-subscriber');

export class SeatSubscriber {
  constructor(
    private eventBus: EventBus,
    private waitlistManager: WaitlistManagerService
  ) {}

  start(): void {
    logger.info('Starting seat subscriber...');
    
    this.eventBus.subscribe('seat.hold.expired', this.handleSeatHoldExpired.bind(this));
    this.eventBus.subscribe('seat.released', this.handleSeatReleased.bind(this));
    
    logger.info('Seat subscriber started - listening for seat.hold.expired and seat.released events');
  }

  private async handleSeatHoldExpired(event: Event): Promise<void> {
    logger.info('Seat hold expired event received', {
      eventId: event.eventId,
      seatId: event.data.seatId,
    });

    await this.waitlistManager.processSeatAvailable(
      event.data.seatId,
      event.data.flightId
    );
  }

  private async handleSeatReleased(event: Event): Promise<void> {
    logger.info('Seat released event received', {
      eventId: event.eventId,
      seatId: event.data.seatId,
    });

    await this.waitlistManager.processSeatAvailable(
      event.data.seatId,
      event.data.flightId
    );
  }
}
