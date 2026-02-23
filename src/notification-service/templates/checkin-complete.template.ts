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
