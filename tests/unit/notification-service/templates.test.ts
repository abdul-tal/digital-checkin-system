import { waitlistAvailableTemplate } from '../../../src/notification-service/templates/waitlist-available.template';
import { checkinCompleteTemplate } from '../../../src/notification-service/templates/checkin-complete.template';

describe('Notification Templates', () => {
  describe('waitlistAvailableTemplate', () => {
    it('should have correct type', () => {
      expect(waitlistAvailableTemplate.type).toBe('WAITLIST_SEAT_AVAILABLE');
    });

    it('should render push notification', () => {
      const data = {
        seatId: '12A',
        flightId: 'SK123',
        expiresAt: new Date('2026-02-21T10:05:00Z'),
      };

      const content = waitlistAvailableTemplate.render(data);

      expect(content.push).toBeDefined();
      expect(content.push.title).toContain('Your Seat is Available');
      expect(content.push.body).toContain('12A');
      expect(content.push.body).toContain('SK123');
    });

    it('should render email notification', () => {
      const data = {
        seatId: '12A',
        flightId: 'SK123',
        expiresAt: new Date('2026-02-21T10:05:00Z'),
      };

      const content = waitlistAvailableTemplate.render(data);

      expect(content.email).toBeDefined();
      expect(content.email.subject).toContain('Seat 12A Available');
      expect(content.email.html).toContain('12A');
      expect(content.email.html).toContain('SK123');
      expect(content.email.text).toContain('12A');
    });

    it('should render SMS notification', () => {
      const data = {
        seatId: '12A',
        flightId: 'SK123',
        expiresAt: new Date('2026-02-21T10:05:00Z'),
      };

      const content = waitlistAvailableTemplate.render(data);

      expect(content.sms).toBeDefined();
      expect(content.sms).toContain('12A');
      expect(content.sms).toContain('SK123');
      expect(content.sms).toContain('SkyHigh');
    });

    it('should include expiry time in email', () => {
      const expiresAt = new Date('2026-02-21T10:05:00Z');
      const data = { seatId: '12A', flightId: 'SK123', expiresAt };

      const content = waitlistAvailableTemplate.render(data);

      expect(content.email.html).toContain(expiresAt.toLocaleString());
    });
  });

  describe('checkinCompleteTemplate', () => {
    it('should have correct type', () => {
      expect(checkinCompleteTemplate.type).toBe('CHECKIN_COMPLETED');
    });

    it('should render push notification', () => {
      const data = {
        seatId: '12A',
        flightId: 'SK123',
        gate: 'B12',
      };

      const content = checkinCompleteTemplate.render(data);

      expect(content.push).toBeDefined();
      expect(content.push.title).toContain('Check-In Complete');
      expect(content.push.body).toContain('SK123');
      expect(content.push.body).toContain('12A');
      expect(content.push.body).toContain('B12');
    });

    it('should render email notification', () => {
      const data = {
        seatId: '12A',
        flightId: 'SK123',
        gate: 'B12',
      };

      const content = checkinCompleteTemplate.render(data);

      expect(content.email).toBeDefined();
      expect(content.email.subject).toContain('Check-In Confirmation');
      expect(content.email.subject).toContain('SK123');
      expect(content.email.html).toContain('12A');
      expect(content.email.html).toContain('B12');
    });

    it('should render SMS notification', () => {
      const data = {
        seatId: '12A',
        flightId: 'SK123',
        gate: 'B12',
      };

      const content = checkinCompleteTemplate.render(data);

      expect(content.sms).toBeDefined();
      expect(content.sms).toContain('SK123');
      expect(content.sms).toContain('12A');
      expect(content.sms).toContain('B12');
      expect(content.sms).toContain('SkyHigh');
    });

    it('should include all key information in all channels', () => {
      const data = {
        seatId: '15F',
        flightId: 'SK456',
        gate: 'A5',
      };

      const content = checkinCompleteTemplate.render(data);

      expect(content.push.body).toContain('15F');
      expect(content.push.body).toContain('SK456');
      expect(content.push.body).toContain('A5');

      expect(content.email.html).toContain('15F');
      expect(content.email.html).toContain('SK456');
      expect(content.email.html).toContain('A5');

      expect(content.sms).toContain('15F');
      expect(content.sms).toContain('SK456');
      expect(content.sms).toContain('A5');
    });
  });
});
