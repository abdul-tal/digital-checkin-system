import { Request, Response, NextFunction } from 'express';
import { MockPaymentService } from '../services/mock-payment.service';
import { ValidationError } from '../../shared/errors/app-error';

export class PaymentController {
  constructor(private paymentService: MockPaymentService) {}

  initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, passengerId, checkInId } = req.body;

      if (!amount || !passengerId || !checkInId) {
        throw new ValidationError('Missing required fields');
      }

      const result = await this.paymentService.initiatePayment({
        amount,
        passengerId,
        checkInId,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  confirmPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;

      const result = await this.paymentService.confirmPayment(paymentId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;

      const status = await this.paymentService.getPaymentStatus(paymentId);

      res.json({ paymentId, status });
    } catch (error) {
      next(error);
    }
  };

  renderPaymentPage = async (req: Request, res: Response) => {
    const { paymentId } = req.params;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mock Payment - SkyHigh</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; }
            button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            button:hover { background: #0056b3; }
            .info { background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>🛫 SkyHigh Mock Payment</h2>
            <div class="info">
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              <p>This is a mock payment page for testing purposes.</p>
            </div>
            <button onclick="confirmPayment()">Confirm Payment</button>
            <p id="result"></p>
          </div>
          <script>
            async function confirmPayment() {
              try {
                const response = await fetch('/api/v1/payments/${paymentId}/confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                
                if (data.status === 'COMPLETED') {
                  document.getElementById('result').innerHTML = 
                    '<p style="color: green;">✅ Payment successful! Transaction ID: ' + data.transactionId + '</p>' +
                    '<p>You can close this page and return to the check-in flow.</p>';
                } else {
                  document.getElementById('result').innerHTML = 
                    '<p style="color: red;">❌ Payment failed. Please try again.</p>';
                }
              } catch (error) {
                document.getElementById('result').innerHTML = 
                  '<p style="color: red;">❌ Error: ' + error.message + '</p>';
              }
            }
          </script>
        </body>
      </html>
    `);
  };
}
