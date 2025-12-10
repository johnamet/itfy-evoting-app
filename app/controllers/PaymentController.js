/**
 * PaymentController
 * 
 * Handles payment operations:
 * - Initialize payments
 * - Verify payments
 * - Webhook handling
 * - Refunds
 * - Payment history
 * - Payment statistics
 * 
 * @module controllers/PaymentController
 */

import BaseController from './BaseController.js';
import { paymentService } from '../services/index.js';

class PaymentController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Initialize payment
     * POST /api/v1/payments/initialize
     * Access: Authenticated users
     */
    initializePayment = this.asyncHandler(async (req, res) => {
        const { amount, eventId, couponCode } = this.getRequestBody(req);
        const userId = this.getUserId(req);
        const metadata = this.getRequestMetadata(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { amount },
            ['amount']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate amount
        if (!this.isValidInteger(amount) || amount <= 0) {
            return this.sendBadRequest(res, 'Amount must be a positive integer');
        }

        // Validate eventId if provided
        if (eventId && !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const payment = await paymentService.initializePayment({
                userId,
                amount,
                eventId,
                couponCode,
                metadata
            });

            return this.sendCreated(res, payment, 'Payment initialized successfully');
        } catch (error) {
            if (error.message.includes('not found') || 
                error.message.includes('invalid')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Verify payment
     * POST /api/v1/payments/verify
     * Access: Authenticated users
     */
    verifyPayment = this.asyncHandler(async (req, res) => {
        const { reference } = this.getRequestBody(req);
        const userId = this.getUserId(req);

        if (!reference) {
            return this.sendBadRequest(res, 'Payment reference is required');
        }

        try {
            const payment = await paymentService.verifyPayment(reference, userId);
            return this.sendSuccess(res, payment, 'Payment verified successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('unauthorized')) {
                return this.sendForbidden(res, error.message);
            }
            if (error.message.includes('failed')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Paystack webhook handler
     * POST /api/v1/payments/webhook
     * Access: Public (Paystack only)
     */
    handleWebhook = this.asyncHandler(async (req, res) => {
        const signature = req.headers['x-paystack-signature'];
        const body = req.body;

        if (!signature) {
            return this.sendUnauthorized(res, 'Missing Paystack signature');
        }

        try {
            // Verify webhook signature
            const isValid = await paymentService.verifyWebhookSignature(
                JSON.stringify(body),
                signature
            );

            if (!isValid) {
                return this.sendUnauthorized(res, 'Invalid webhook signature');
            }

            // Process webhook event
            await paymentService.handleWebhookEvent(body);

            // Paystack expects 200 OK response
            return res.status(200).send();
        } catch (error) {
            console.error('Webhook error:', error);
            return res.status(200).send(); // Still return 200 to prevent retries
        }
    });

    /**
     * Get payment by ID
     * GET /api/v1/payments/:id
     * Access: Payment owner or Admin
     */
    getPaymentById = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid payment ID format');
        }

        try {
            const payment = await paymentService.getPaymentById(id);
            
            if (!payment) {
                return this.sendNotFound(res, 'Payment not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, payment.userId)) {
                return this.sendForbidden(res, 'You can only view your own payments');
            }

            return this.sendSuccess(res, payment, 'Payment retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get user's payment history
     * GET /api/v1/payments/history
     * Access: Authenticated users (own history)
     */
    getPaymentHistory = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);
        const pagination = this.getPagination(req);
        const { status } = this.getRequestQuery(req);

        try {
            const result = await paymentService.getPaymentHistory({
                userId,
                status,
                ...pagination
            });

            return this.sendPaginatedResponse(
                res,
                result.payments,
                { total: result.total, ...pagination },
                'Payment history retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get all payments (admin)
     * GET /api/v1/payments
     * Access: Admin only
     */
    getAllPayments = this.asyncHandler(async (req, res) => {
        const pagination = this.getPagination(req);
        const sortOptions = this.getSortOptions(req, { createdAt: -1 });
        const filters = this.getFilterOptions(req, ['status', 'userId', 'eventId']);

        try {
            const result = await paymentService.getAllPayments({
                ...pagination,
                sort: sortOptions,
                filters
            });

            return this.sendPaginatedResponse(
                res,
                result.payments,
                { total: result.total, ...pagination },
                'Payments retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Request refund
     * POST /api/v1/payments/:id/refund
     * Access: Admin only
     */
    refundPayment = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const { reason } = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid payment ID format');
        }

        if (!reason) {
            return this.sendBadRequest(res, 'Refund reason is required');
        }

        try {
            const payment = await paymentService.refundPayment(id, reason);
            return this.sendSuccess(res, payment, 'Refund processed successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('cannot be refunded')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get payment statistics
     * GET /api/v1/payments/statistics
     * Access: Admin only
     */
    getPaymentStatistics = this.asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.getRequestQuery(req);

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        try {
            const stats = await paymentService.getPaymentStatistics({
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined
            });

            return this.sendSuccess(res, stats, 'Payment statistics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get revenue by event
     * GET /api/v1/payments/revenue-by-event
     * Access: Admin only
     */
    getRevenueByEvent = this.asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.getRequestQuery(req);

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        try {
            const revenue = await paymentService.getRevenueByEvent({
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined
            });

            return this.sendSuccess(res, revenue, 'Revenue by event retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get payment receipt
     * GET /api/v1/payments/:id/receipt
     * Access: Payment owner or Admin
     */
    getPaymentReceipt = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid payment ID format');
        }

        try {
            const payment = await paymentService.getPaymentById(id);
            
            if (!payment) {
                return this.sendNotFound(res, 'Payment not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, payment.userId)) {
                return this.sendForbidden(res, 'You can only view your own receipts');
            }

            const receipt = await paymentService.generateReceipt(id);
            return this.sendSuccess(res, receipt, 'Receipt generated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default PaymentController;
