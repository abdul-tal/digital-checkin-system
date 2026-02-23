# Task 009: Notification Service Implementation

## Objective
Implement a Notification Service that sends push notifications, emails, and SMS to passengers for waitlist assignments, check-in completion, and payment reminders.

## Priority
P1 (Should Have) - Important for user experience but not critical for core functionality

## Description
Build a mock notification service that simulates sending notifications across multiple channels (push, email, SMS) with template support and event-driven triggers.

## Prerequisites
- Task 001 completed (Project setup)
- Task 007 completed (Shared middleware)

## Technical Requirements

### 1. Directory Structure

```
src/notification-service/
├── controllers/
│   └── notification.controller.ts
├── services/
│   ├── notification-dispatcher.service.ts
│   ├── mock-push.service.ts
│   ├── mock-email.service.ts
│   └── mock-sms.service.ts
├── templates/
│   ├── waitlist-available.template.ts
│   ├── checkin-complete.template.ts
│   └── payment-reminder.template.ts
├── events/
│   └── subscribers/
│       ├── waitlist.subscriber.ts
│       ├── checkin.subscriber.ts
│       └── payment.subscriber.ts
├── routes/
│   └── notification.routes.ts
├── app.ts
└── index.ts
```

### 2. Notification Templates

**src/notification-service/templates/waitlist-available.template.ts:**
```typescript
export const waitlistAvailableTemplate = {
  type: 'WAITLIST_SEAT_AVAILABLE',
  
  render: (data: { seatId: string; flightId: string; expiresAt: Date }) => ({
    push: {
      title: '🎉 Your Seat is Available!',
      body: `Seat ${data.seatId} on flight ${data.flightId} is now available. You have 5 minutes to confirm.`,
    },
    email: {
      subject: `Seat ${data.seatId} Available - SkyHigh Airlines`,
      html: `
        <h2>Good news! Your preferred seat is available</h2>
        <p>Seat <strong>${data.seatId}</strong> on flight <strong>${data.flightId}</strong> is now available.</p>
        <p>You have <strong>5 minutes</strong> to confirm this seat assignment.</p>
        <p>Please complete your check-in to secure this seat.</p>
        <p>Expires at: ${data.expiresAt.toLocaleString()}</p>
      `,
      text: `Your preferred seat ${data.seatId} on flight ${data.flightId} is available. Confirm within 5 minutes.`,
    },
    sms: `SkyHigh: Seat ${data.seatId} available on flight ${data.flightId}. Confirm in 5 min.`,
  }),
};
```

**src/notification-service/templates/checkin-complete.template.ts:**
```typescript
export const checkinCompleteTemplate = {
  type: 'CHECKIN_COMPLETED',
  
  render: (data: { seatId: string; flightId: string; gate: string }) => ({
    push: {
      title: '✅ Check-In Complete',
      body: `You're checked in for flight ${data.flightId}. Seat ${data.seatId}, Gate ${data.gate}.`,
    },
    email: {
      subject: `Check-In Confirmation - Flight ${data.flightId}`,
      html: `
        <h2>Check-in successful!</h2>
        <p>You're all set for flight <strong>${data.flightId}</strong>.</p>
        <ul>
          <li>Seat: <strong>${data.seatId}</strong></li>
          <li>Gate: <strong>${data.gate}</strong></li>
        </ul>
        <p>Your boarding pass has been saved to your account.</p>
        <p>Have a great flight! ✈️</p>
      `,
      text: `Check-in complete for flight ${data.flightId}. Seat: ${data.seatId}, Gate: ${data.gate}`,
    },
    sms: `SkyHigh: Checked in for ${data.flightId}. Seat ${data.seatId}, Gate ${data.gate}`,
  }),
};
```

### 3. Mock Channel Services

**src/notification-service/services/mock-push.service.ts:**
```typescript
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-push-service');

export interface PushNotification {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class MockPushService {
  async send(notification: PushNotification): Promise<void> {
    // Simulate push notification delay
    await this.sleep(200);

    logger.info('📱 PUSH notification sent', {
      userId: notification.userId,
      title: notification.title,
    });

    // In production, this would use FCM (Firebase Cloud Messaging) or APNS
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 PUSH NOTIFICATION`);
    console.log(`To: ${notification.userId}`);
    console.log(`Title: ${notification.title}`);
    console.log(`Body: ${notification.body}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**src/notification-service/services/mock-email.service.ts:**
```typescript
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-email-service');

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class MockEmailService {
  async send(email: Email): Promise<void> {
    // Simulate email delay
    await this.sleep(500);

    logger.info('📧 EMAIL sent', {
      to: email.to,
      subject: email.subject,
    });

    // In production, this would use SendGrid, AWS SES, etc.
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📧 EMAIL`);
    console.log(`To: ${email.to}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`\n${email.text}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**src/notification-service/services/mock-sms.service.ts:**
```typescript
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-sms-service');

export interface SMS {
  to: string;
  message: string;
}

export class MockSmsService {
  async send(sms: SMS): Promise<void> {
    // Simulate SMS delay
    await this.sleep(300);

    logger.info('📱 SMS sent', {
      to: sms.to,
      messageLength: sms.message.length,
    });

    // In production, this would use Twilio, AWS SNS, etc.
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📱 SMS`);
    console.log(`To: ${sms.to}`);
    console.log(`Message: ${sms.message}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 4. Notification Dispatcher

**src/notification-service/services/notification-dispatcher.service.ts:**
```typescript
import { MockPushService } from './mock-push.service';
import { MockEmailService } from './mock-email.service';
import { MockSmsService } from './mock-sms.service';
import { waitlistAvailableTemplate } from '../templates/waitlist-available.template';
import { checkinCompleteTemplate } from '../templates/checkin-complete.template';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('notification-dispatcher');

export interface SendNotificationRequest {
  passengerId: string;
  type: string;
  channels: ('push' | 'email' | 'sms')[];
  data: Record<string, any>;
}

export class NotificationDispatcherService {
  private templates: Map<string, any>;

  constructor(
    private pushService: MockPushService,
    private emailService: MockEmailService,
    private smsService: MockSmsService
  ) {
    // Register templates
    this.templates = new Map([
      [waitlistAvailableTemplate.type, waitlistAvailableTemplate],
      [checkinCompleteTemplate.type, checkinCompleteTemplate],
    ]);
  }

  async send(req: SendNotificationRequest): Promise<void> {
    const template = this.templates.get(req.type);

    if (!template) {
      logger.warn('Template not found', { type: req.type });
      return;
    }

    const content = template.render(req.data);

    // Send to all requested channels in parallel
    const promises = req.channels.map(async (channel) => {
      try {
        switch (channel) {
          case 'push':
            await this.pushService.send({
              userId: req.passengerId,
              title: content.push.title,
              body: content.push.body,
              data: req.data,
            });
            break;

          case 'email':
            // Mock: use passengerId as email for testing
            await this.emailService.send({
              to: `${req.passengerId}@example.com`,
              subject: content.email.subject,
              html: content.email.html,
              text: content.email.text,
            });
            break;

          case 'sms':
            // Mock: use passengerId for phone
            await this.smsService.send({
              to: `+1-555-${req.passengerId}`,
              message: content.sms,
            });
            break;
        }

        logger.info('Notification sent', {
          channel,
          type: req.type,
          passengerId: req.passengerId,
        });
      } catch (error: any) {
        logger.error('Notification failed', {
          channel,
          type: req.type,
          error: error.message,
        });
        // Don't throw - fail gracefully
      }
    });

    await Promise.allSettled(promises);
  }
}
```

### 5. Event Subscribers

**src/notification-service/events/subscribers/waitlist.subscriber.ts:**
```typescript
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
}
```

**src/notification-service/events/subscribers/checkin.subscriber.ts:**
```typescript
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
```

### 6. Controller and Routes

**src/notification-service/controllers/notification.controller.ts:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';

export class NotificationController {
  constructor(private dispatcher: NotificationDispatcherService) {}

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { passengerId, type, channels, data } = req.body;

      await this.dispatcher.send({
        passengerId,
        type,
        channels,
        data,
      });

      res.json({
        message: 'Notification sent successfully',
        passengerId,
        channels,
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### 7. Service Entry Point

**src/notification-service/index.ts:**
```typescript
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createPubSubClients } from '../shared/config/redis';
import { EventBus } from '../shared/events/event-bus';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { MockPushService } from './services/mock-push.service';
import { MockEmailService } from './services/mock-email.service';
import { MockSmsService } from './services/mock-sms.service';
import { NotificationController } from './controllers/notification.controller';
import { WaitlistSubscriber } from './events/subscribers/waitlist.subscriber';
import { CheckInSubscriber } from './events/subscribers/checkin.subscriber';
import { errorHandler } from '../shared/middleware/error-handler';
import { requestLogger } from '../shared/middleware/request-logger';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('notification-service');
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3005;

async function bootstrap() {
  try {
    const { publisher, subscriber } = createPubSubClients();
    const eventBus = new EventBus(publisher, subscriber);

    // Initialize channel services
    const pushService = new MockPushService();
    const emailService = new MockEmailService();
    const smsService = new MockSmsService();

    // Initialize dispatcher
    const dispatcher = new NotificationDispatcherService(
      pushService,
      emailService,
      smsService
    );

    // Initialize controller
    const controller = new NotificationController(dispatcher);

    // Create Express app
    const app = express();
    app.use(express.json());
    app.use(requestLogger);

    // Routes
    app.post('/api/v1/notifications/send', controller.send);
    app.get('/health', (req, res) => {
      res.json({ status: 'OK', service: 'notification-service' });
    });

    app.use(errorHandler);

    // Start event subscribers
    const waitlistSubscriber = new WaitlistSubscriber(eventBus, dispatcher);
    waitlistSubscriber.start();

    const checkinSubscriber = new CheckInSubscriber(eventBus, dispatcher);
    checkinSubscriber.start();

    // Start server
    app.listen(PORT, () => {
      logger.info(`Notification Service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service', { error });
    process.exit(1);
  }
}

bootstrap();
```

## Implementation Steps

1. Create notification-service directory structure
2. Implement mock push, email, and SMS services
3. Create notification templates
4. Implement notification dispatcher
5. Create event subscribers for waitlist and check-in events
6. Set up controller and routes
7. Create Express app
8. Test with all services running

## Testing Strategy

### Manual Testing After Completion:

**Test 1: Direct Notification API**
```bash
curl -X POST http://localhost:3005/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P12345",
    "type": "WAITLIST_SEAT_AVAILABLE",
    "channels": ["push", "email", "sms"],
    "data": {
      "seatId": "12A",
      "flightId": "SK123",
      "expiresAt": "2026-02-21T10:05:00Z"
    }
  }'
```
Expected: Console shows push, email, and SMS notifications

**Test 2: Event-Driven Notification (Waitlist Assignment)**
```bash
# 1. Hold a seat
curl -X POST http://localhost:3001/api/v1/seats/hold \
  -H "Content-Type: application/json" \
  -d '{
    "flightId": "SK123",
    "seatId": "25A",
    "passengerId": "P11111"
  }'

# 2. Join waitlist for that seat
curl -X POST http://localhost:3004/api/v1/waitlist/join \
  -H "Content-Type: application/json" \
  -d '{
    "passengerId": "P22222",
    "flightId": "SK123",
    "seatId": "25A",
    "loyaltyTier": "PLATINUM",
    "bookingTimestamp": "2026-02-10T10:00:00Z"
  }'

# 3. Wait 120 seconds for hold to expire
# Watch Notification Service logs - should see notification sent automatically
```

**Test 3: Check-In Completion Notification**
```bash
# Complete a check-in (with no baggage)
curl -X POST http://localhost:3002/api/v1/checkin/complete \
  -H "Content-Type: application/json" \
  -d '{
    "checkInId": "<checkInId>",
    "passengerId": "P12345",
    "userId": "U12345",
    "seatId": "10A",
    "baggage": { "count": 0 }
  }'

# Watch Notification Service logs - should see check-in completion notification
```

### Verification Checklist:
- [ ] Notification Service starts on port 3005
- [ ] Direct API call sends notifications to all channels
- [ ] Push notification mock displays in console
- [ ] Email notification mock displays in console
- [ ] SMS notification mock displays in console
- [ ] Templates render correctly with data
- [ ] Waitlist subscriber receives waitlist.assigned events
- [ ] Check-in subscriber receives checkin.completed events
- [ ] Notifications sent automatically on events
- [ ] Failed notifications don't block other channels

## Expected Outputs
- Working Notification Service on port 3005
- Multi-channel notification support (push, email, SMS)
- Template-based content generation
- Event-driven notification triggers
- Mock services with console output for testing
- Ready for production with real email/SMS providers

## Estimated Complexity
**Medium** - Multiple channel implementations with template system.

## Dependencies
- Task 001 (Project setup)
- Task 007 (Shared middleware)

## Next Tasks
- Task 010: API Gateway with Authentication
- Task 011: Abuse Detection Service
