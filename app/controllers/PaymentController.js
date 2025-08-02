#!/usr/bin/env node
/**
 * Payment Controller
 * 
 * Handles payment operations including verification, webhook processing,
 * and payment statistics for the e-voting system.
 */

import BaseController from './BaseController.js';
import PaymentService from '../services/PaymentService.js';

export default class PaymentController extends BaseController {
    constructor() {
        super();
        this.paymentService = new PaymentService();
    }

    /**
     * Verify payment status
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
     */
    async handleWebhook(req, res) {
        try {
            const signature = req.headers['x-paystack-signature'];
            const event = req.body;

            if (!signature) {
                return this.sendError(res, 'Missing webhook signature', 400);
            }

            const result = await this.paymentService.handleWebhook(event, signature);
            return this.sendSuccess(res, result, 'Webhook processed successfully');

        } catch (error) {
            // For webhooks, return 200 to prevent retries for invalid requests
            console.error('Webhook processing error:', error);
            return res.status(200).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Get payment details
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
     */
    async getPaymentStats(req, res) {
        try {
            const { eventId, categoryId, status, startDate, endDate } = req.query;
            
            const matchStage = {};
            
            if (eventId) {
                matchStage['event'] = eventId;
            }
            
            if (categoryId) {
                matchStage['category'] = categoryId;
            }
            
            if (status) {
                matchStage.status = status;
            }
            
            if (startDate || endDate) {
                matchStage.createdAt = {};
                if (startDate) matchStage.createdAt.$gte = new Date(startDate);
                if (endDate) matchStage.createdAt.$lte = new Date(endDate);
            }

            const stats = await Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$finalAmount" },
                        avgAmount: { $avg: "$finalAmount" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        statusBreakdown: {
                            $push: {
                                status: "$_id",
                                count: "$count",
                                totalAmount: "$totalAmount",
                                avgAmount: "$avgAmount"
                            }
                        },
                        totalPayments: { $sum: "$count" },
                        totalRevenue: { $sum: "$totalAmount" }
                    }
                }
            ]);

            const result = stats[0] || {
                statusBreakdown: [],
                totalPayments: 0,
                totalRevenue: 0
            };

            return this.sendSuccess(res, result, 'Payment statistics retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to get payment statistics');
        }
    }

    /**
     * List payments with filters (admin only)
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

            const filter = {};
            
            if (eventId) {
                filter['event'] = eventId;
            }
            
            if (categoryId) {
                filter['category'] = categoryId;
            }
            
            if (status) {
                filter.status = status;
            }
            
            if (email) {
                filter['voter.email'] = { $regex: email, $options: 'i' };
            }
            
            if (startDate || endDate) {
                filter.createdAt = {};
                if (startDate) filter.createdAt.$gte = new Date(startDate);
                if (endDate) filter.createdAt.$lte = new Date(endDate);
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            const [payments, total] = await Promise.all([
                Payment.find(filter)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .sort({ createdAt: -1 })
                    .populate('voteBundles')
                    .populate('event')
                    .populate('category')
                    .populate('coupon'),
                Payment.countDocuments(filter)
            ]);

            const pagination = {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            };

            return this.sendSuccess(res, { payments, pagination }, 'Payments retrieved successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to list payments');
        }
    }
}