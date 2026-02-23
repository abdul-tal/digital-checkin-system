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
