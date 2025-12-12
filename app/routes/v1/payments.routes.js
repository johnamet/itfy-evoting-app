#!/usr/bin/env node
/**
 * Payment Routes
 * 
 * @module routes/v1/payments
 */

import express from 'express';
import PaymentController from '../../controllers/PaymentController.js';
import { requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const paymentController = new PaymentController();

// ===== Public Payment Operations =====

/**
 * @route POST /api/v1/payments/initialize
 * @desc Initialize payment transaction
 * @access Public
 */
router.post('/initialize', (req, res) => paymentController.initializePayment(req, res));

/**
 * @route GET /api/v1/payments/verify/:reference
 * @desc Verify payment status
 * @access Public
 */
router.get('/verify/:reference', (req, res) => paymentController.verifyPayment(req, res));

/**
 * @route POST /api/v1/payments/webhook
 * @desc Handle Paystack webhook
 * @access Public (Webhook)
 */
router.post('/webhook', (req, res) => paymentController.handleWebhook(req, res));

/**
 * @route GET /api/v1/payments/:id
 * @desc Get payment by ID
 * @access Public
 */
router.get('/:id', (req, res) => paymentController.getPaymentById(req, res));

/**
 * @route GET /api/v1/payments/receipt/:reference
 * @desc Get payment receipt
 * @access Public
 */
router.get('/receipt/:reference', (req, res) => paymentController.getPaymentReceipt(req, res));

// ===== Admin Payment Management =====

/**
 * @route GET /api/v1/payments/admin/all
 * @desc Get all payments
 * @access Private (Admin - Level 3+)
 */
router.get('/admin/all', requireLevel(3), (req, res) => paymentController.getAllPayments(req, res));

/**
 * @route GET /api/v1/payments/admin/statistics
 * @desc Get payment statistics
 * @access Private (Admin - Level 3+)
 */
router.get('/admin/statistics', requireLevel(3), (req, res) => paymentController.getPaymentStatistics(req, res));

/**
 * @route GET /api/v1/payments/admin/event/:eventId
 * @desc Get payments by event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/admin/event/:eventId', requireLevel(3), (req, res) => paymentController.getRevenueByEvent(req, res));

/**
 * @route GET /api/v1/payments/user/:userId/history
 * @desc Get user payment history
 * @access Private (Admin - Level 3+)
 */
router.get('/user/:userId/history', requireLevel(3), (req, res) => paymentController.getPaymentHistory(req, res));

/**
 * @route POST /api/v1/payments/:id/refund
 * @desc Process payment refund
 * @access Private (Admin - Level 4+)
 */
router.post('/:id/refund', requireLevel(4), (req, res) => paymentController.refundPayment(req, res));

export default router;
