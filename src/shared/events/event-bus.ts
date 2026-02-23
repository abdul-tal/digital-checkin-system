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
  private handlers: Map<string, Array<(event: Event) => Promise<void>>> = new Map();
  private messageListenerSetup = false;
  private isReady = false;

  constructor(
    private publisher: Redis,
    private subscriber: Redis
  ) {
    // Set up the message listener once
    this.setupMessageListener();
    this.waitForConnection();
  }

  private async waitForConnection(): Promise<void> {
    // Wait for both Redis clients to be ready
    await Promise.all([
      new Promise<void>((resolve) => {
        if (this.publisher.status === 'ready') {
          resolve();
        } else {
          this.publisher.once('ready', () => resolve());
        }
      }),
      new Promise<void>((resolve) => {
        if (this.subscriber.status === 'ready') {
          resolve();
        } else {
          this.subscriber.once('ready', () => resolve());
        }
      })
    ]);
    
    this.isReady = true;
    logger.info('EventBus ready - Redis connections established');
  }

  private setupMessageListener(): void {
    if (this.messageListenerSetup) return;
    
    logger.info('Setting up event bus message listener...');
    
    this.subscriber.on('message', async (channel, message) => {
      logger.info('Raw message received from Redis', { 
        channel, 
        messageLength: message.length,
        hasHandlers: this.handlers.has(channel),
        handlerCount: this.handlers.get(channel)?.length || 0
      });
      
      const handlers = this.handlers.get(channel);
      if (!handlers || handlers.length === 0) {
        logger.warn('No handlers registered for event', { 
          channel,
          registeredEvents: Array.from(this.handlers.keys())
        });
        return;
      }
      
      try {
        const event: Event = JSON.parse(message);
        logger.info('Event received and parsed', { 
          eventType: channel, 
          eventId: event.eventId,
          handlerCount: handlers.length
        });
        
        // Execute all handlers for this event type
        await Promise.all(handlers.map(async (handler, index) => {
          try {
            logger.info('Executing handler', { eventType: channel, handlerIndex: index });
            await handler(event);
            logger.info('Handler executed successfully', { eventType: channel, handlerIndex: index });
          } catch (error) {
            logger.error('Event handler error', {
              eventType: channel,
              eventId: event.eventId,
              handlerIndex: index,
              error,
            });
          }
        }));
      } catch (error) {
        logger.error('Event parsing error', {
          eventType: channel,
          error,
          message: message.substring(0, 200),
        });
      }
    });
    
    this.messageListenerSetup = true;
    logger.info('Event bus message listener initialized');
  }

  async publish(eventType: string, data: Record<string, any>): Promise<void> {
    const event: Event = {
      eventId: uuid(),
      eventType,
      timestamp: new Date(),
      source: process.env.SERVICE_NAME || 'unknown',
      data,
      correlationId: data.correlationId,
    };

    const eventJson = JSON.stringify(event);
    logger.info('Publishing event', { 
      eventType, 
      eventId: event.eventId,
      dataKeys: Object.keys(data),
      messageLength: eventJson.length 
    });

    const subscriberCount = await this.publisher.publish(eventType, eventJson);
    logger.info('Event published', { 
      eventType, 
      eventId: event.eventId,
      subscriberCount  // How many subscribers received it
    });
  }

  subscribe(eventType: string, handler: (event: Event) => Promise<void>): void {
    logger.info('Subscribing to event', { 
      eventType,
      alreadySubscribed: this.handlers.has(eventType),
      currentHandlerCount: this.handlers.get(eventType)?.length || 0,
      isReady: this.isReady,
      subscriberStatus: this.subscriber.status
    });
    
    // Add handler to the map first
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    
    // Subscribe to Redis channel asynchronously (wait for connection)
    const doSubscribe = async () => {
      // Wait for Redis to be ready
      if (!this.isReady) {
        logger.info('Waiting for Redis connection before subscribing', { eventType });
        await this.waitForConnection();
      }
      
      // Check if we already subscribed to this channel
      if (this.handlers.get(eventType)!.length > 1) {
        logger.info('Already subscribed to Redis channel', { 
          eventType,
          handlerCount: this.handlers.get(eventType)!.length 
        });
        return;
      }
      
      // Subscribe to Redis channel only once per event type
      logger.info('Subscribing to Redis channel', { 
        eventType,
        subscriberStatus: this.subscriber.status 
      });
      
      this.subscriber.subscribe(eventType, (err) => {
        if (err) {
          logger.error('Redis subscribe error', { eventType, error: err });
        } else {
          logger.info('Successfully subscribed to Redis channel', { eventType });
        }
      });
    };
    
    // Don't await - subscribe asynchronously
    doSubscribe().catch((err) => {
      logger.error('Failed to subscribe', { eventType, error: err });
    });
    
    logger.info('Event handler registered', { 
      eventType,
      totalHandlers: this.handlers.get(eventType)!.length,
      allRegisteredEvents: Array.from(this.handlers.keys())
    });
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    logger.info('Event bus closed');
  }

  // Test method to verify pub/sub is working
  async testConnection(): Promise<boolean> {
    try {
      // Wait for Redis connection first
      if (!this.isReady) {
        logger.info('Waiting for Redis connection...');
        await this.waitForConnection();
      }
      
      const testChannel = 'test-channel';
      const testMessage = { test: 'data', timestamp: Date.now() };
      
      logger.info('Testing Redis pub/sub connection...', {
        publisherStatus: this.publisher.status,
        subscriberStatus: this.subscriber.status
      });
      
      // Set up test subscription
      let messageReceived = false;
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test subscription timeout'));
        }, 5000);
        
        this.subscriber.subscribe(testChannel, (err) => {
          if (err) {
            clearTimeout(timeout);
            logger.error('Test subscription failed', { error: err });
            reject(err);
          } else {
            logger.info('Test subscription successful');
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      
      // Listen for test message
      const messagePromise = new Promise<void>((resolve) => {
        const handler = (channel: string, message: string) => {
          if (channel === testChannel) {
            logger.info('Test message received', { message });
            messageReceived = true;
            this.subscriber.off('message', handler);
            resolve();
          }
        };
        this.subscriber.on('message', handler);
      });
      
      // Publish test message
      const count = await this.publisher.publish(testChannel, JSON.stringify(testMessage));
      logger.info('Test message published', { subscriberCount: count });
      
      // Wait for message (with timeout)
      await Promise.race([
        messagePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test message not received')), 3000)
        )
      ]);
      
      // Cleanup
      await this.subscriber.unsubscribe(testChannel);
      
      logger.info('Redis pub/sub test successful', { messageReceived });
      return messageReceived;
    } catch (error) {
      logger.error('Redis pub/sub test failed', { error });
      return false;
    }
  }

  // Wait for EventBus to be ready
  async ready(): Promise<void> {
    if (this.isReady) return;
    await this.waitForConnection();
  }

  // Get debug info
  getDebugInfo(): any {
    return {
      isReady: this.isReady,
      messageListenerSetup: this.messageListenerSetup,
      registeredEvents: Array.from(this.handlers.keys()),
      handlersPerEvent: Array.from(this.handlers.entries()).map(([event, handlers]) => ({
        event,
        handlerCount: handlers.length
      })),
      subscriberStatus: this.subscriber.status,
      publisherStatus: this.publisher.status
    };
  }
}
