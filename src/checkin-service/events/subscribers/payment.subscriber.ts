import { EventBus, Event } from '../../../shared/events/event-bus';
import { CheckInOrchestratorService } from '../../services/checkin-orchestrator.service';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('payment-subscriber');

export class PaymentSubscriber {
  constructor(
    private eventBus: EventBus,
    private orchestrator: CheckInOrchestratorService
  ) {}

  start(): void {
    this.eventBus.subscribe('payment.confirmed', this.handlePaymentConfirmed.bind(this));
    logger.info('Payment subscriber started');
  }

  private async handlePaymentConfirmed(event: Event): Promise<void> {
    logger.info('Payment confirmed event received', { eventId: event.eventId });
    await this.orchestrator.handlePaymentConfirmed(event.data);
  }
}
