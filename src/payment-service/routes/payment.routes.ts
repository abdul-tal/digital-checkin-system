import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

export const createPaymentRoutes = (controller: PaymentController): Router => {
  const router = Router();

  router.post('/payments/initiate', controller.initiatePayment);
  router.post('/payments/:paymentId/confirm', controller.confirmPayment);
  router.get('/payments/:paymentId/status', controller.getPaymentStatus);

  router.get('/pay/:paymentId', controller.renderPaymentPage);

  return router;
};
