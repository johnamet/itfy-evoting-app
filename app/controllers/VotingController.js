#!/usr/bin/env node
/**
 * Voting Controller
 * 
 * Handles voting operations and vote management.
 */

import BaseController from './BaseController.js';
import VotingService from '../services/VotingService.js';
import PaymentService from '../services/PaymentService.js';

export default class VotingController extends BaseController {
    constructor() {
        super();
        this.votingService = new VotingService();
        this.paymentService = new PaymentService();
    }

    /**
     * Cast a vote
     */
    async castVote(req, res) {
        try {
            const voteData = req.body;
            const voterId = req.user?.id;

            if (!voterId) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const vote = await this.votingService.castVote({
                ...voteData,
                voterId
            });

            return this.sendSuccess(res, vote, 'Vote cast successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to cast vote');
        }
    }

    /**
     * Get voting results for an event
     */
    async getEventResults(req, res) {
        try {
            const { eventId } = req.params;
            const includeDetails = req.query.include === 'details';

            const results = await this.votingService.getEventResults(eventId, includeDetails);
            return this.sendSuccess(res, results, 'Voting results retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get voting results');
        }
    }

    /**
     * Get voting results for a category
     */
    async getCategoryResults(req, res) {
        try {
            const { categoryId } = req.params;
            const includeDetails = req.query.include === 'details';

            const results = await this.votingService.getCategoryResults(categoryId, includeDetails);
            return this.sendSuccess(res, results, 'Category results retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get category results');
        }
    }

    /**
     * Get user's voting history
     */
    async getUserVotingHistory(req, res) {
        try {
            const userId = req.user?.id;
            const query = req.query;

            if (!userId) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const history = await this.votingService.getUserVotingHistory(userId, query);
            return this.sendSuccess(res, history, 'Voting history retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get voting history');
        }
    }

    /**
     * Check if user can vote in an event
     */
    async checkVotingEligibility(req, res) {
        try {
            const { eventId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const eligibility = await this.votingService.checkVotingEligibility(eventId, userId);
            return this.sendSuccess(res, eligibility, 'Voting eligibility checked successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to check voting eligibility');
        }
    }

    /**
     * Get vote bundle details
     */
    async getVoteBundle(req, res) {
        try {
            const { bundleId } = req.params;
            const includeVotes = req.query.include === 'votes';

            const bundle = await this.votingService.getVoteBundle(bundleId, includeVotes);

            if (!bundle) {
                return this.sendError(res, 'Vote bundle not found', 404);
            }

            return this.sendSuccess(res, bundle, 'Vote bundle retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get vote bundle');
        }
    }

    /**
     * Create vote bundle (for batch voting)
     */
    async createVoteBundle(req, res) {
        try {
            const bundleData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const bundle = await this.votingService.createVoteBundle({
                ...bundleData,
                createdBy
            });

            return this.sendSuccess(res, bundle, 'Vote bundle created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create vote bundle');
        }
    }

    /**
     * Get voting statistics for an event
     */
    async getVotingStats(req, res) {
        try {
            const { eventId } = req.params;
            const stats = await this.votingService.getVotingStats(eventId);
            return this.sendSuccess(res, stats, 'Voting statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get voting statistics');
        }
    }

    /**
     * Verify vote integrity
     */
    async verifyVote(req, res) {
        try {
            const { voteId } = req.params;
            const verification = await this.votingService.verifyVote(voteId);

            if (!verification) {
                return this.sendError(res, 'Vote not found', 404);
            }

            return this.sendSuccess(res, verification, 'Vote verification completed');
        } catch (error) {
            return this.handleError(res, error, 'Failed to verify vote');
        }
    }

    /**
     * Get real-time voting updates
     */
    async getVotingUpdates(req, res) {
        try {
            const { eventId } = req.params;
            const { lastUpdate } = req.query;

            const updates = await this.votingService.getVotingUpdates(eventId, lastUpdate);
            return this.sendSuccess(res, updates, 'Voting updates retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get voting updates');
        }
    }

    /**
     * Export voting results
     */
    async exportResults(req, res) {
        try {
            const { eventId } = req.params;
            const { format = 'json' } = req.query;

            const exportData = await this.votingService.exportResults(eventId, format);

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=voting-results-${eventId}.csv`);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=voting-results-${eventId}.json`);
            }

            return res.send(exportData);
        } catch (error) {
            return this.handleError(res, error, 'Failed to export results');
        }
    }

    /**
     * Audit voting activity
     */
    async auditVoting(req, res) {
        try {
            const { eventId } = req.params;
            const query = req.query;

            const auditLog = await this.votingService.auditVoting(eventId, query);
            return this.sendSuccess(res, auditLog, 'Voting audit completed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to audit voting');
        }
    }

    /**
     * Initialize payment for voting with bundles and coupons
     */
    async initializeVotingPayment(req, res) {
        try {
            const paymentData = {
                email: req.body.email,
                bundles: req.body.bundles, // Array of {bundleId, quantity}
                coupons: req.body.coupons || [], // Array of coupon codes
                eventId: req.body.eventId,
                categoryId: req.body.categoryId,
                candidateId: req.body.candidateId, // Optional, can be set later
                callback_url: req.body.callback_url,
                userId: req.user?.id,
                voterIp: req.ip || req.connection.remoteAddress
            };

            // Validate required fields
            if (!paymentData.email || !paymentData.bundles || !paymentData.eventId || !paymentData.categoryId) {
                return this.sendError(res, 'Missing required fields: email, bundles, eventId, categoryId', 400);
            }

            const result = await this.paymentService.initializePayment(paymentData);
            return this.sendSuccess(res, result.data, 'Payment initialized successfully', 201);

        } catch (error) {
            return this.handleError(res, error, 'Failed to initialize voting payment');
        }
    }

    /**
     * Complete voting after successful payment
     */
    async completeVotingAfterPayment(req, res) {
        try {
            const { paymentReference, candidateId } = req.body;
            const voterIp = req.ip || req.connection.remoteAddress;

            if (!paymentReference || !candidateId) {
                return this.sendError(res, 'Payment reference and candidate ID are required', 400);
            }

            const result = await this.paymentService.castVoteAfterPayment(paymentReference, candidateId, voterIp);

            // Emit socket events if available
            if (req.io) {
                req.io.emit("newVote", result.data.vote);
                req.io.emit(`voteUpdate:${candidateId}`, result.data.vote);
            }

            return this.sendSuccess(res, result.data, 'Vote cast successfully after payment', 201);

        } catch (error) {
            return this.handleError(res, error, 'Failed to complete voting after payment');
        }
    }

    /**
     * Get voting cost estimation
     */
    async getVotingCostEstimate(req, res) {
        try {
            const { bundles, coupons, eventId, categoryId } = req.body;

            if (!bundles || !eventId || !categoryId) {
                return this.sendError(res, 'Bundles, event ID, and category ID are required', 400);
            }

            // Create a temporary payment service instance to access private methods
            const tempPaymentService = new PaymentService();

            // Calculate bundle costs
            const bundleCalculation = await tempPaymentService._calculateBundleCosts(
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
                    const couponResult = await tempPaymentService._applyCoupons(
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
                    result.couponError = couponError.message;
                }
            }

            return this.sendSuccess(res, result, 'Voting cost estimated successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to estimate voting cost');
        }
    }
}
