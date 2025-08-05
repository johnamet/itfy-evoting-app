#!/usr/bin/env node
/**
 * Payment Routes
 * 
 * Defines API endpoints for payment operations in the e-voting system.
 * 
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and verification operations
 */

import express from 'express';
import PaymentController from '../controllers/PaymentController.js';
import { requireLevel } from '../middleware/auth.js';

const router = express.Router();
const paymentController = new PaymentController();

/**
 * @route GET /payments/verify/:reference
 * @desc Verify payment status
 * @access Public
 */
router.get('/verify/:reference', (req, res) => paymentController.verifyPayment(req, res));

/**
 * @route POST /payments/webhook
 * @desc Handle Paystack webhooks
 * @access Public (webhook endpoint)
 */
router.post('/webhook', (req, res) => paymentController.handleWebhook(req, res));

/**
 * @route GET /payments/details/:reference
 * @desc Get payment details
 * @access Public
 */
router.get('/details/:reference', (req, res) => paymentController.getPaymentDetails(req, res));

/**
 * @route GET /payments/stats
 * @desc Get payment statistics
 * @access Private (Admin only, level 3)
 */
router.get('/stats', (req, res) => paymentController.getPaymentStats(req, res));

/**
 * @route GET /payments/list
 * @desc List payments with filters
 * @access Private (Admin only, level 3)
 */
router.get('/list', (req, res) => paymentController.listPayments(req, res));

/**
 * @route GET /payments/event/:eventId
 * @desc Get payments by event
 * @access Private (Admin only, level 3)
 */
router.get('/event/:eventId', (req, res) => paymentController.getPaymentsByEvent(req, res));

/**
 * @route GET /payments/category/:categoryId
 * @desc Get payments by category
 * @access Private (Admin only, level 3)
 */
router.get('/category/:categoryId', (req, res) => paymentController.getPaymentsByCategory(req, res));

/**
 * @route GET /payments/summary
 * @desc Get payment summary
 * @access Private (Admin only, level 3)
 */
router.get('/summary', (req, res) => paymentController.getPaymentSummary(req, res));

export default router;