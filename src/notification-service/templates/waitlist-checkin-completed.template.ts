export const waitlistCheckinCompletedTemplate = {
  type: 'WAITLIST_CHECKIN_COMPLETED',

  render: (data: {
    seatId: string;
    flightId: string;
    boardingPass?: {
      passengerId: string;
      flightId: string;
      seatNumber: string;
      boardingGroup: string;
      qrCode: string;
    };
  }) => ({
    push: {
      title: '🎉 Check-In Complete!',
      body: `Your waitlisted seat ${data.seatId} on flight ${data.flightId} has been confirmed! Boarding pass ready.`,
    },
    email: {
      subject: `Check-In Completed - Seat ${data.seatId} Confirmed | SkyHigh Airlines`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .boarding-pass { background: white; border: 2px dashed #667eea; 
                              padding: 20px; margin: 20px 0; border-radius: 10px; }
              .qr-code { text-align: center; margin: 20px 0; }
              .qr-code img { max-width: 200px; height: auto; }
              .details { margin: 15px 0; }
              .details strong { color: #667eea; }
              .success { background: #d4edda; border: 1px solid #c3e6cb; 
                        padding: 15px; border-radius: 5px; color: #155724; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✈️ SkyHigh Airlines</h1>
                <h2>Check-In Completed!</h2>
              </div>
              <div class="content">
                <div class="success">
                  <strong>🎉 Great news!</strong> Your waitlisted seat has been automatically assigned and your check-in is complete!
                </div>
                
                <div class="boarding-pass">
                  <h3 style="color: #667eea; margin-top: 0;">Boarding Pass</h3>
                  
                  <div class="details">
                    <p><strong>Flight:</strong> ${data.flightId}</p>
                    <p><strong>Seat:</strong> ${data.seatId}</p>
                    ${
                      data.boardingPass
                        ? `
                    <p><strong>Passenger:</strong> ${data.boardingPass.passengerId}</p>
                    <p><strong>Boarding Group:</strong> ${data.boardingPass.boardingGroup}</p>
                    `
                        : ''
                    }
                  </div>
                  
                  ${
                    data.boardingPass?.qrCode
                      ? `
                  <div class="qr-code">
                    <p><strong>Your QR Code:</strong></p>
                    <img src="${data.boardingPass.qrCode}" alt="Boarding Pass QR Code" />
                    <p style="font-size: 12px; color: #666;">
                      Show this QR code at the gate for boarding
                    </p>
                  </div>
                  `
                      : ''
                  }
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; 
                           border-radius: 5px; margin: 20px 0;">
                  <strong>📱 Next Steps:</strong>
                  <ul style="margin: 10px 0;">
                    <li>Save this boarding pass to your mobile wallet</li>
                    <li>Arrive at the airport at least 2 hours before departure</li>
                    <li>Proceed directly to security with your boarding pass</li>
                  </ul>
                </div>
                
                <p style="text-align: center; margin-top: 30px;">
                  <strong>Have a great flight! ✈️</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>© 2026 SkyHigh Airlines. All rights reserved.</p>
                <p>This is an automated message. Please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
SkyHigh Airlines - Check-In Completed!

Great news! Your waitlisted seat has been automatically assigned.

Flight: ${data.flightId}
Seat: ${data.seatId}
${data.boardingPass ? `Boarding Group: ${data.boardingPass.boardingGroup}` : ''}

Your boarding pass is ready. Please save the QR code and show it at the gate.

Have a great flight!

SkyHigh Airlines
      `,
    },
    sms: `SkyHigh: Check-in complete! Seat ${data.seatId} confirmed on flight ${data.flightId}. Boarding pass sent via email. Have a great flight!`,
  }),
};
