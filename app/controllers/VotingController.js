#!/usr/bin/env node
/**
 * Voting Controller
 * 
 * Handles voting operations and vote management.
 *
 * @swagger
 * tags:
 *   name: Voting
 *   description: Manages voting operations and results
 */

import BaseController from './BaseController.js';
import VotingService from '../services/VotingService.js';

export default class VotingController extends BaseController {
    constructor() {
        super();
        this.votingService = new VotingService();
    }

    /**
     * Cast a vote for a candidate
     */
    async castVote(req, res) {
        try {
            const voteData = {
                userId: this.getUserId(req),
                eventId: req.body.eventId,
                categoryId: req.body.categoryId,
                candidateId: req.body.candidateId,
                voteCount: req.body.voteCount || 1,
                voterIp: req.ip || req.connection.remoteAddress
            };

            // Validate required fields
            const validation = this.validateRequiredParams(req, ['eventId', 'categoryId', 'candidateId']);
            if (validation) {
                return this.sendError(res, validation.message, 400, validation);
            }

            // Validate ObjectIds
            if (!this.isValidObjectId(voteData.eventId) || 
                !this.isValidObjectId(voteData.categoryId) || 
                !this.isValidObjectId(voteData.candidateId)) {
                return this.sendError(res, 'Invalid ID format provided', 400);
            }

            const result = await this.votingService.castVote(voteData);

            if (!result.success) {
                return this.sendError(res, result.error || 'Failed to cast vote', 400);
            }

            return this.sendSuccess(res, result.data, 'Vote cast successfully', 201);

        } catch (error) {
            return this.handleError(res, error, 'Failed to cast vote');
        }
    }

    /**
     * Initiate a vote (triggers payment initialization for non-registered voters)
     */
    async initiateVote(req, res) {
        try {
            const voteData = {
                email: req.body.email,
                bundles: req.body.bundles, // Array of {bundleId, quantity}
                coupons: req.body.coupons || [],
                eventId: req.body.eventId,
                categoryId: req.body.categoryId,
                candidateId: req.body.candidateId,
                callback_url: req.body.callback_url,
                voterIp: req.ip || req.connection.remoteAddress
            };

            // Validate required fields
            if (!voteData.email || !voteData.bundles || !voteData.eventId || !voteData.categoryId || !voteData.candidateId) {
                return this.sendError(res, 'Missing required fields: email, bundles, eventId, categoryId, candidateId', 400);
            }

            const result = await this.votingService.initiateVote(voteData);
            return this.sendSuccess(res, result.data, 'Vote initiation and payment initialized successfully', 201);

        } catch (error) {
            return this.handleError(res, error, 'Failed to initiate vote');
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
     * Get user's voting history (for registered users)
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
     * Check if user can vote in an event (for registered users)
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
     * Create vote bundle (for batch voting, admin only)
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
     * Export voting results (admin only)
     */
    async exportResults(req, res) {
        try {
            const { eventId } = req.params;
            const { format = 'json' } = req.query;

            const exportData = await this.votingService.exportResults(eventId, format);
            const filename = `voting-results-${eventId}`;

            if (format === 'csv') {
                return this.sendCSVDownload(res, exportData, `${filename}.csv`);
            } else {
                // Parse JSON if it's a string
                const jsonData = typeof exportData === 'string' ? JSON.parse(exportData) : exportData;
                return this.sendExportResponse(res, jsonData, 'json', filename, true, {
                    eventId,
                    format,
                    recordCount: Array.isArray(jsonData) ? jsonData.length : 1
                });
            }
        } catch (error) {
            return this.handleError(res, error, 'Failed to export results');
        }
    }

    /**
     * Audit voting activity (admin only)
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
     * Get voting cost estimation
     */
    async getVotingCostEstimate(req, res) {
        try {
            const { bundles, coupons, eventId, categoryId } = req.body;

            if (!bundles || !eventId || !categoryId) {
                return this.sendError(res, 'Bundles, event ID, and category ID are required', 400);
            }

            const result = await this.votingService.calculateVotingCost({ bundles, coupons, eventId, categoryId });
            return this.sendSuccess(res, result, 'Voting cost estimated successfully');

        } catch (error) {
            return this.handleError(res, error, 'Failed to estimate voting cost');
        }
    }

    /**
     * Get vote bundles by event
     */
    async getVoteBundlesByEvent(req, res) {
        try {
            const { eventId } = req.params;
            const query = req.query;

            const bundles = await this.votingService.getVoteBundlesByEvent(eventId, query);
            return this.sendSuccess(res, bundles, 'Event vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event vote bundles');
        }
    }

    /**
     * Get vote bundles by category
     */
    async getVoteBundlesByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const query = req.query;

            const bundles = await this.votingService.getVoteBundlesByCategory(categoryId, query);
            return this.sendSuccess(res, bundles, 'Category vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get category vote bundles');
        }
    }

    /**
     * Get vote bundles by event and category
     */
    async getVoteBundlesByEventAndCategory(req, res) {
        try {
            const { eventId, categoryId } = req.params;
            const query = req.query;

            const bundles = await this.votingService.getVoteBundlesByEventAndCategory(eventId, categoryId, query);
            return this.sendSuccess(res, bundles, 'Event and category vote bundles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event and category vote bundles');
        }
    }
}