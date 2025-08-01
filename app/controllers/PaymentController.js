#!/usr/bin/env node
/**
 * Payment Controller
 * 
 * Handles payment operations including initialization, verification,
 * and webhook processing for the e-voting system.
 */

import BaseController from './BaseController.js';
import PaymentService from '../services/PaymentService.js';

export default class PaymentController extends BaseController {
    constructor() {
        super();
        this.paymentService = new PaymentService();
    }

    /**
     * Initialize payment for vote bundles
     */
    async initializePayment(req, res) {
        try {
            const paymentData = {
                ...req.body,
                userId: req.user?.id,
                voterIp: req.ip || req.connection.remoteAddress
            };

            // Validate required fields
            if (!paymentData.email || !paymentData.bundles || !paymentData.eventId || !paymentData.categoryId) {
                return this.sendError(res, 'Missing required fields: email, bundles, eventId, categoryId', 400);
            }

            if (!Array.isArray(paymentData.bundles) || paymentData.bundles.length === 0) {
                return this.sendError(res, 'Bundles must be a non-empty array', 400);
            }

            // Validate bundles structure
            for (const bundle of paymentData.bundles) {
                if (!bundle.bundleId || !bundle.quantity || bundle.quantity <= 0) {
                    return this.sendError(res, 'Each bundle must have bundleId and positive quantity', 400);
                }
            }

            const result = await this.paymentService.initializePayment(paymentData);
            return this.sendSuccess(res, result.data, 'Payment initialized successfully', 201);

        } catch (error) {
            return this.handleError(res, error, 'Failed to initialize payment');
        }
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
     * Cast vote after successful payment
     */
    async castVoteAfterPayment(req, res) {
        try {
            const { reference } = req.params;
            const { candidateId } = req.body;
            const voterIp = req.ip || req.connection.remoteAddress;

            if (!reference) {
                return this.sendError(res, 'Payment reference is required', 400);
            }

            if (!candidateId) {
                return this.sendError(res, 'Candidate ID is required', 400);
            }

            const result = await this.paymentService.castVoteAfterPayment(reference, candidateId, voterIp);

            // Emit socket events if available
            if (req.io) {
                req.io.emit("newVote", result.data.vote);
                req.io.emit(`voteUpdate:${candidateId}`, result.data.vote);
            }

            return this.sendSuccess(res, result.data, 'Vote cast successfully', 201);

        } catch (error) {
            return this.handleError(res, error, 'Failed to cast vote');
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
            // For webhooks, we should still return 200 to prevent retries for invalid requests
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
            
            // Build aggregation pipeline
            const matchStage = {};
            
            if (eventId) {
                matchStage['metadata.eventId'] = eventId;
            }
            
            if (categoryId) {
                matchStage['metadata.categoryId'] = categoryId;
            }
            
            if (status) {
                matchStage.status = status;
            }
            
            if (startDate || endDate) {
                matchStage.created_at = {};
                if (startDate) matchStage.created_at.$gte = new Date(startDate);
                if (endDate) matchStage.created_at.$lte = new Date(endDate);
            }

            const stats = await Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$amount" },
                        avgAmount: { $avg: "$amount" }
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

            // Build filter object
            const filter = {};
            
            if (eventId) {
                filter['metadata.eventId'] = eventId;
            }
            
            if (categoryId) {
                filter['metadata.categoryId'] = categoryId;
            }
            
            if (status) {
                filter.status = status;
            }
            
            if (email) {
                filter.email = { $regex: email, $options: 'i' };
            }
            
            if (startDate || endDate) {
                filter.created_at = {};
                if (startDate) filter.created_at.$gte = new Date(startDate);
                if (endDate) filter.created_at.$lte = new Date(endDate);
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            const [payments, total] = await Promise.all([
                Payment.all(filter, { 
                    skip, 
                    limit: parseInt(limit),
                    sort: { created_at: -1 }
                }),
                Payment.count(filter)
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

    /**
     * Calculate voting cost for given bundles and coupons
     */
    async calculateVotingCost(req, res) {
        try {
            const { bundles, coupons, eventId, categoryId } = req.body;

            if (!bundles || !Array.isArray(bundles) || bundles.length === 0) {
                return this.sendError(res, 'Bundles array is required', 400);
            }

            if (!eventId || !categoryId) {
                return this.sendError(res, 'Event ID and Category ID are required', 400);
            }

            // Validate and calculate bundle costs
            const bundleCalculation = await this.paymentService._calculateBundleCosts(
                bundles, eventId, categoryId
            );

            let result = {
                originalAmount: bundleCalculation.totalAmount,
                totalVotes: bundleCalculation.totalVotes,
                bundles: bundleCalculation.validatedBundles,
                appliedCoupons: [],
                finalAmount: bundleCalculation.totalAmount,
                totalDiscount: 0
            };

            // Apply coupons if provided
            if (coupons && coupons.length > 0) {
                try {
                    const couponResult = await this.paymentService._applyCoupons(
                        coupons,
                        bundleCalculation.validatedBundles,
                        eventId,
                        categoryId,
                        bundleCalculation.totalAmount
                    );
                    
                    result.finalAmount = couponResult.discountedAmount;
                    result.appliedCoupons = couponResult.appliedCoupons;
                    result.totalDiscount = bundleCalculation.totalAmount - couponResult.discountedAmount;
                    
                } catch (couponError) {
                    // If coupon application fails, return calculation without coupons but include error
                    result.couponError = couponError.message;
                }
            }

            return this.sendSuccess(res, result, 'Voting cost calculated successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to calculate voting cost');
        }
    }
}
