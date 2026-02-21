import { Redis } from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createLogger } from '../utils/logger';

const logger = createLogger('event-bus');

export interface Event {
  eventId: string;
  eventType: string;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  correlationId?: string;
}

export class EventBus {
  constructor(
    private publisher: Redis,
    private subscriber: Redis
  ) {}

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    const event: Event = {
      eventId: uuid(),
      eventType,
      timestamp: new Date(),
      source: process.env.SERVICE_NAME || 'unknown',
      data,
      correlationId: data.correlationId,
    };

    await this.publisher.publish(eventType, JSON.stringify(event));
    logger.info('Event published', { eventType, eventId: event.eventId });
  }

  subscribe(eventType: string, handler: (event: Event) => Promise<void>): void {
    this.subscriber.subscribe(eventType, (err) => {
      if (err) {
        logger.error('Subscribe error', { eventType, error: err });
      } else {
        logger.info('Subscribed to event', { eventType });
      }
    });

    this.subscriber.on('message', async (channel, message) => {
      if (channel === eventType) {
        try {
          const event: Event = JSON.parse(message);
          logger.info('Event received', { eventType, eventId: event.eventId });
          await handler(event);
        } catch (error) {
          logger.error('Event handler error', {
            eventType,
            error,
            message,
          });
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    logger.info('Event bus closed');
  }
}
