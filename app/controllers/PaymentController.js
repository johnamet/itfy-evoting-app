#!/usr/bin/env node
/**
 * Payment Controller
 * 
 * Handles payment operations including verification, webhook processing,
 * and payment statistics for the e-voting system.
 *
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and verification operations
 */

import BaseController from './BaseController.js';
import PaymentService from '../services/PaymentService.js';

export default class PaymentController extends BaseController {
    constructor() {
        super();
        this.paymentService = new PaymentService();
    }

    /**
     * Create payment (alias for initPayment)
     * POST /api/payments
     */
    async createPayment(req, res) {
        return this.initPayment(req, res);
    }

    /**
     * Initialise payment
     */
    async initPayment(req, res) {
        try {
            const paymentData = req.body;

            paymentData.voterIp = req.ip;

            if (!paymentData.bundles || !paymentData.email) {
                return this.sendError(res, 'Bundles and email are required', 400);
            }

            const paymentLink = await this.paymentService.initializePayment(paymentData);
            console.log(paymentLink);
            return this.sendSuccess(res, { paymentLink }, 'Payment initialised successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to initialise payment');
        }
    }

    /**
     * Verify payment status
     * 
     * @swagger
     * /payments/verify/{reference}:
     *   get:
     *     summary: Verify payment status
     *     description: Verifies the status of a payment using its reference number
     *     tags: [Payments]
     *     security: []
     *     parameters:
     *       - in: path
     *         name: reference
     *         required: true
     *         schema:
     *           type: string
     *         description: Payment reference number
     *         example: "PAY_1234567890"
     *     responses:
     *       200:
     *         description: Payment verification successful
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/Payment'
     *             examples:
     *               success:
     *                 summary: Successful verification
     *                 value:
     *                   success: true
     *                   message: "Payment verified successfully"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
     *                   data:
     *                     reference: "PAY_1234567890"
     *                     status: "success"
     *                     amount: 500
     *                     currency: "NGN"
     *                     email: "user@example.com"
     *       400:
     *         description: Bad request - Missing reference or verification failed
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             examples:
     *               missing_reference:
     *                 summary: Missing reference
     *                 value:
     *                   success: false
     *                   error: "Payment reference is required"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
     *               verification_failed:
     *                 summary: Verification failed
     *                 value:
     *                   success: false
     *                   error: "Payment verification failed"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async verifyPayment(req, res) {
        try {
            const { reference } = req.params;

            if (!reference) {
                return this.sendError(res, 'Payment reference is required', 400);
            }

            const result = await this.paymentService.verifyPayment(reference);
            
            if (result.verified) {
                return this.sendSuccess(res, result.data, 'Payment verified successfully');
            } else {
                return this.sendError(res, result.message || 'Payment verification failed', 400);
            }

        } catch (error) {
            return this.handleError(res, error, 'Failed to verify payment');
        }
    }

    /**
     * Handle Paystack webhooks
     * 
     * @swagger
     * /payments/webhook:
     *   post:
     *     summary: Handle payment webhooks
     *     description: Processes webhook events from payment gateway (Paystack)
     *     tags: [Payments]
     *     security: []
     *     parameters:
     *       - in: header
     *         name: x-paystack-signature
     *         required: true
     *         schema:
     *           type: string
     *         description: Webhook signature for verification
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               event:
     *                 type: string
     *                 example: "charge.success"
     *               data:
     *                 type: object
     *                 description: Payment data from webhook
     *           example:
     *             event: "charge.success"
     *             data:
     *               reference: "PAY_1234567890"
     *               amount: 50000
     *               currency: "NGN"
     *               status: "success"
     *               customer:
     *                 email: "user@example.com"
     *     responses:
     *       200:
     *         description: Webhook processed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *             example:
     *               success: true
     *               message: "Webhook processed successfully"
     *               timestamp: "2025-08-05T10:30:00.000Z"
     *               data:
     *                 processed: true
     *                 eventType: "charge.success"
     *       400:
     *         description: Bad request - Invalid webhook signature
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['x-paystack-signature'];

            // Get raw body for signature verification
            const rawBody = req.rawBody;
            const event = req.body;

            const io = req.app.get('io');

            if (!signature) {
                return this.sendError(res, 'Missing webhook signature', 400);
            }

            if (!rawBody) {
                return this.sendError(res, 'Missing raw body for signature verification', 400);
            }

            const result = await this.paymentService.handleWebhook(event, signature, rawBody);
            io.emit('payment_event', {
                event: event.type,
                data: result
            });
            return this.sendSuccess(res, result, 'Webhook processed successfully');

        } catch (error) {
            // For webhooks, return 200 to prevent retries for invalid requests
            console.error('Webhook processing error:', error);
            return this.sendError(res, error.message, 200);
        }
    }

    /**
     * Get payment details
     * 
     * @swagger
     * /payments/details/{reference}:
     *   get:
     *     summary: Get payment details
     *     description: Retrieves detailed information about a payment using its reference
     *     tags: [Payments]
     *     security: []
     *     parameters:
     *       - in: path
     *         name: reference
     *         required: true
     *         schema:
     *           type: string
     *         description: Payment reference number
     *         example: "PAY_1234567890"
     *     responses:
     *       200:
     *         description: Payment details retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/Payment'
     *       400:
     *         description: Bad request - Missing reference
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Payment not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getPaymentDetails(req, res) {
        try {
            const { reference } = req.params;

            if (!reference) {
                return this.sendError(res, 'Payment reference is required', 400);
            }

            const result = await this.paymentService.getPaymentDetails(reference);
            return this.sendSuccess(res, result.data, 'Payment details retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to get payment details');
        }
    }

    /**
     * Get payment statistics (admin only)
     * 
     * @swagger
     * /payments/stats:
     *   get:
     *     summary: Get payment statistics
     *     description: Retrieves comprehensive payment statistics with optional filters (Admin only)
     *     tags: [Payments]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: eventId
     *         schema:
     *           type: string
     *         description: Filter by event ID
     *       - in: query
     *         name: categoryId
     *         schema:
     *           type: string
     *         description: Filter by category ID
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [pending, success, failed, cancelled]
     *         description: Filter by payment status
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date for date range filter
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date for date range filter
     *     responses:
     *       200:
     *         description: Payment statistics retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/PaymentStats'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: Forbidden - Admin access required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getPaymentStats(req, res) {
        try {
            const { eventId, categoryId, status, startDate, endDate } = req.query;
            
            const filters = {
                eventId,
                categoryId,
                status,
                startDate,
                endDate
            };

            const result = await this.paymentService.getPaymentStatistics(filters);
            return this.sendSuccess(res, result.data, 'Payment statistics retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to get payment statistics');
        }
    }

    /**
     * List payments with filters (admin only)
     * 
     * @swagger
     * /payments/list:
     *   get:
     *     summary: List payments with filters
     *     description: Retrieves a paginated list of payments with optional filters (Admin only)
     *     tags: [Payments]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 20
     *         description: Number of items per page
     *       - in: query
     *         name: eventId
     *         schema:
     *           type: string
     *         description: Filter by event ID
     *       - in: query
     *         name: categoryId
     *         schema:
     *           type: string
     *         description: Filter by category ID
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [pending, success, failed, cancelled]
     *         description: Filter by payment status
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date for date range filter
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date for date range filter
     *       - in: query
     *         name: email
     *         schema:
     *           type: string
     *           format: email
     *         description: Filter by user email
     *     responses:
     *       200:
     *         description: Payments retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         payments:
     *                           type: array
     *                           items:
     *                             $ref: '#/components/schemas/Payment'
     *                         pagination:
     *                           $ref: '#/components/schemas/PaginationInfo'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: Forbidden - Admin access required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async listPayments(req, res) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                eventId, 
                categoryId, 
                status, 
                startDate, 
                endDate,
                email 
            } = req.query;

            const filters = {
                eventId,
                categoryId,
                status,
                startDate,
                endDate,
                email
            };

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const result = await this.paymentService.getPayments(filters, options);
            return this.sendSuccess(res, result.data, 'Payments retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to list payments');
        }
    }

    /**
     * Get payments by event
     * 
     * @swagger
     * /payments/event/{eventId}:
     *   get:
     *     summary: Get payments by event
     *     description: Retrieves all payments for a specific event with pagination
     *     tags: [Payments]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: eventId
     *         required: true
     *         schema:
     *           type: string
     *         description: Event ID
     *         example: "64f8a1b2c3d4e5f6789012ab"
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 20
     *         description: Number of items per page
     *     responses:
     *       200:
     *         description: Event payments retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         payments:
     *                           type: array
     *                           items:
     *                             $ref: '#/components/schemas/Payment'
     *                         pagination:
     *                           $ref: '#/components/schemas/PaginationInfo'
     *       400:
     *         description: Bad request - Invalid event ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Event not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getPaymentsByEvent(req, res) {
        try {
            const { eventId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const result = await this.paymentService.getPaymentsByEvent(eventId, { page, limit });
            return this.sendSuccess(res, result.data, 'Event payments retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to get event payments');
        }
    }

    /**
     * Get payments by category
     * 
     * @swagger
     * /payments/category/{categoryId}:
     *   get:
     *     summary: Get payments by category
     *     description: Retrieves all payments for a specific category with pagination
     *     tags: [Payments]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: categoryId
     *         required: true
     *         schema:
     *           type: string
     *         description: Category ID
     *         example: "64f8a1b2c3d4e5f6789012ab"
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 20
     *         description: Number of items per page
     *     responses:
     *       200:
     *         description: Category payments retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         payments:
     *                           type: array
     *                           items:
     *                             $ref: '#/components/schemas/Payment'
     *                         pagination:
     *                           $ref: '#/components/schemas/PaginationInfo'
     *       400:
     *         description: Bad request - Invalid category ID
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Category not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getPaymentsByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const result = await this.paymentService.getPaymentsByCategory(categoryId, { page, limit });
            return this.sendSuccess(res, result.data, 'Category payments retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to get category payments');
        }
    }

    /**
     * Get payment summary
     * 
     * @swagger
     * /payments/summary:
     *   get:
     *     summary: Get payment summary
     *     description: Retrieves a comprehensive summary of payment data with optional filters
     *     tags: [Payments]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: query
     *         name: eventId
     *         schema:
     *           type: string
     *         description: Filter by event ID
     *       - in: query
     *         name: categoryId
     *         schema:
     *           type: string
     *         description: Filter by category ID
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [pending, success, failed, cancelled]
     *         description: Filter by payment status
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Start date for date range filter
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: End date for date range filter
     *     responses:
     *       200:
     *         description: Payment summary retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/PaymentSummary'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getPaymentSummary(req, res) {
        try {
            const { eventId, categoryId, status, startDate, endDate } = req.query;
            
            const filters = {
                eventId,
                categoryId,
                status,
                startDate,
                endDate
            };

            const result = await this.paymentService.getPaymentSummary(filters);
            return this.sendSuccess(res, result.data, 'Payment summary retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to get payment summary');
        }
    }
}
