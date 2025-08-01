#!/usr/bin/env node
/**
 * Payment Routes
 * 
 * Defines routes for payment operations including initialization,
 * verification, and webhook handling.
 */

import { Router } from 'express';
import PaymentController from '../controllers/PaymentController.js';
import AuthController from '../controllers/AuthController.js';

const paymentRouter = Router();

/**
 * @route POST /payments/initialize
 * @desc Initialize payment for vote bundles
 * @access Public
 */
paymentRouter.post('/initialize', PaymentController.prototype.initializePayment.bind(new PaymentController()));

/**
 * @route GET /payments/verify/:reference
 * @desc Verify payment status
 * @access Public
 */
paymentRouter.get('/verify/:reference', PaymentController.prototype.verifyPayment.bind(new PaymentController()));

/**
 * @route POST /payments/cast-vote/:reference
 * @desc Cast vote after successful payment
 * @access Public
 */
paymentRouter.post('/cast-vote/:reference', PaymentController.prototype.castVoteAfterPayment.bind(new PaymentController()));

/**
 * @route POST /payments/webhook
 * @desc Handle Paystack webhooks
 * @access Public (webhook endpoint)
 */
paymentRouter.post('/webhook', PaymentController.prototype.handleWebhook.bind(new PaymentController()));

/**
 * @route GET /payments/details/:reference
 * @desc Get payment details
 * @access Public
 */
paymentRouter.get('/details/:reference', PaymentController.prototype.getPaymentDetails.bind(new PaymentController()));

/**
 * @route POST /payments/calculate-cost
 * @desc Calculate voting cost for bundles and coupons
 * @access Public
 */
paymentRouter.post('/calculate-cost', PaymentController.prototype.calculateVotingCost.bind(new PaymentController()));

/**
 * @route GET /payments/stats
 * @desc Get payment statistics
 * @access Private (Admin only)
 */
paymentRouter.get('/stats',
    AuthController.verifyToken,
    AuthController.verifyRole(['admin', 'superuser']),
    PaymentController.prototype.getPaymentStats.bind(new PaymentController())
);

/**
 * @route GET /payments/list
 * @desc List payments with filters
 * @access Private (Admin only)
 */
paymentRouter.get('/list',
    AuthController.verifyToken,
    AuthController.verifyRole(['admin', 'superuser']),
    PaymentController.prototype.listPayments.bind(new PaymentController())
);

export default paymentRouter;
