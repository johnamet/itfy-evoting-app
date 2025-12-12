#!/usr/bin/env node
/**
 * NominationController - HTTP handlers for nomination management
 * 
 * Handles:
 * - Public nomination submissions
 * - Admin review and approval workflow
 * - Nomination listing and search
 * - Statistics and analytics
 * 
 * @module NominationController
 * @extends BaseController
 * @version 1.0.0
 */

import BaseController from './BaseController.js';
import { nominationService } from '../services/index.js';

class NominationController extends BaseController {
    constructor() {
        super();
        this.service = nominationService;
    }

    /**
     * Submit a new nomination (public endpoint)
     * POST /api/v1/nominations/submit
     * 
     * @param {Object} req.body - { eventId, categoryId, nominator: { name, email, phone?, relationship? }, nominee: { name, email, phone?, reasonForNomination } }
     * @returns {Object} Submission confirmation
     */
    submitNomination = async (req, res) => {
        try {
            const nominationData = {
                eventId: req.body.eventId,
                categoryId: req.body.categoryId,
                nominator: req.body.nominator,
                nominee: req.body.nominee
            };

            const metadata = {
                ip: req.clientIp || req.ip,
                userAgent: req.get('user-agent')
            };

            const result = await this.service.submitNomination(nominationData, metadata);

            if (result.success) {
                return this.sendCreated(res, result.data, result.message);
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Get pending nominations for admin review
     * GET /api/v1/nominations/pending/:eventId
     * 
     * @param {string} req.params.eventId - Event ID
     * @param {number} req.query.page - Page number (default: 1)
     * @param {number} req.query.limit - Items per page (default: 10)
     * @returns {Object} Paginated pending nominations
     */
    getPendingNominations = async (req, res) => {
        try {
            const { eventId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const result = await this.service.getPendingNominations(
                eventId,
                { page: parseInt(page), limit: parseInt(limit) }
            );

            if (result.success) {
                return this.sendPaginatedResponse(
                    res,
                    result.data.nominations,
                    result.data.pagination,
                    result.message
                );
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Get all nominations for an event
     * GET /api/v1/nominations/event/:eventId
     * 
     * @param {string} req.params.eventId - Event ID
     * @param {string} req.query.status - Filter by status
     * @param {string} req.query.categoryId - Filter by category
     * @param {number} req.query.page - Page number
     * @param {number} req.query.limit - Items per page
     * @returns {Object} Paginated nominations
     */
    getNominationsByEvent = async (req, res) => {
        try {
            const { eventId } = req.params;
            const { status, categoryId, page = 1, limit = 20 } = req.query;

            const filters = {};
            if (status) filters.status = status;
            if (categoryId) filters.category = categoryId;

            const result = await this.service.getNominationsByEvent(
                eventId,
                filters,
                { page: parseInt(page), limit: parseInt(limit) }
            );

            if (result.success) {
                return this.sendPaginatedResponse(
                    res,
                    result.data.nominations,
                    result.data.pagination,
                    result.message
                );
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Get nomination details
     * GET /api/v1/nominations/:nominationId
     * 
     * @param {string} req.params.nominationId - Nomination ID
     * @returns {Object} Nomination details
     */
    getNominationDetails = async (req, res) => {
        try {
            const { nominationId } = req.params;

            const result = await this.service.getNominationDetails(nominationId);

            if (result.success) {
                return this.sendSuccess(res, result.data, result.message);
            } else {
                return this.sendNotFound(res, result.error);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Approve a nomination (admin only)
     * POST /api/v1/nominations/:nominationId/approve
     * 
     * @param {string} req.params.nominationId - Nomination ID
     * @param {string} req.user.userId - Admin user ID from JWT
     * @returns {Object} Approval result with candidate details
     */
    approveNomination = async (req, res) => {
        try {
            const { nominationId } = req.params;
            const adminId = req.user.userId;

            const result = await this.service.approveNomination(nominationId, adminId);

            if (result.success) {
                return this.sendSuccess(res, result.data, result.message);
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Reject a nomination (admin only)
     * POST /api/v1/nominations/:nominationId/reject
     * 
     * @param {string} req.params.nominationId - Nomination ID
     * @param {string} req.body.reason - Rejection reason
     * @param {string} req.user.userId - Admin user ID from JWT
     * @returns {Object} Rejection result
     */
    rejectNomination = async (req, res) => {
        try {
            const { nominationId } = req.params;
            const { reason } = req.body;
            const adminId = req.user.userId;

            if (!reason || reason.trim().length === 0) {
                return this.sendBadRequest(res, 'Rejection reason is required');
            }

            const result = await this.service.rejectNomination(nominationId, adminId, reason);

            if (result.success) {
                return this.sendSuccess(res, result.data, result.message);
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Get nomination statistics
     * GET /api/v1/nominations/stats/:eventId
     * 
     * @param {string} req.params.eventId - Event ID
     * @returns {Object} Nomination statistics
     */
    getNominationStats = async (req, res) => {
        try {
            const { eventId } = req.params;

            const result = await this.service.getNominationStats(eventId);

            if (result.success) {
                return this.sendSuccess(res, result.data, result.message);
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Search nominations
     * GET /api/v1/nominations/search
     * 
     * @param {string} req.query.q - Search query
     * @param {string} req.query.eventId - Filter by event
     * @param {string} req.query.status - Filter by status
     * @param {number} req.query.limit - Limit results
     * @returns {Object} Search results
     */
    searchNominations = async (req, res) => {
        try {
            const { q, eventId, status, limit = 20 } = req.query;

            if (!q || q.trim().length === 0) {
                return this.sendBadRequest(res, 'Search query is required');
            }

            const filters = {};
            if (eventId) filters.event = eventId;
            if (status) filters.status = status;

            const result = await this.service.searchNominations(
                q,
                filters,
                { limit: parseInt(limit) }
            );

            if (result.success) {
                return this.sendSuccess(res, result.data, result.message);
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Resend verification email to nominee (admin only)
     * POST /api/v1/nominations/resend-verification/:candidateId
     * 
     * @param {string} req.params.candidateId - Candidate ID
     * @param {string} req.user.userId - Admin user ID from JWT
     * @returns {Object} Resend result
     */
    resendVerificationEmail = async (req, res) => {
        try {
            const { candidateId } = req.params;
            const adminId = req.user.userId;

            const result = await this.service.resendVerificationEmail(candidateId, adminId);

            if (result.success) {
                return this.sendSuccess(res, result.data, result.message);
            } else {
                return this.sendError(res, result.error, 400);
            }
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Get nominations by category
     * GET /api/v1/nominations/category/:categoryId
     * 
     * @param {string} req.params.categoryId - Category ID
     * @param {string} req.query.status - Filter by status
     * @param {number} req.query.page - Page number
     * @param {number} req.query.limit - Items per page
     * @returns {Object} Paginated nominations for category
     */
    getNominationsByCategory = async (req, res) => {
        try {
            const { categoryId } = req.params;
            const { status, page = 1, limit = 20 } = req.query;

            const filters = {};
            if (status) filters.status = status;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                populate: true,
                sort: { 'submission.submittedAt': -1 }
            };

            const nominations = await nominationService.repo('nomination').findByCategory(
                categoryId,
                filters,
                options
            );

            // Get total count for pagination
            const total = await nominationService.repo('nomination').model.countDocuments({
                category: categoryId,
                ...filters
            });

            return this.sendPaginatedResponse(
                res,
                nominations,
                { total, page: parseInt(page), limit: parseInt(limit) },
                'Nominations retrieved'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    };

    /**
     * Bulk approve nominations (admin only)
     * POST /api/v1/nominations/bulk-approve
     * 
     * @param {Array<string>} req.body.nominationIds - Array of nomination IDs
     * @param {string} req.user.userId - Admin user ID from JWT
     * @returns {Object} Bulk approval result
     */
    bulkApproveNominations = async (req, res) => {
        try {
            const { nominationIds } = req.body;
            const adminId = req.user.userId;

            if (!Array.isArray(nominationIds) || nominationIds.length === 0) {
                return this.sendBadRequest(res, 'Nomination IDs array is required');
            }

            const results = {
                approved: [],
                failed: [],
                duplicate: []
            };

            for (const nominationId of nominationIds) {
                try {
                    const result = await this.service.approveNomination(nominationId, adminId);
                    
                    if (result.success) {
                        if (result.data.nomination.status === 'duplicate') {
                            results.duplicate.push({
                                nominationId,
                                candidateId: result.data.candidate._id
                            });
                        } else {
                            results.approved.push({
                                nominationId,
                                candidateId: result.data.candidate.id
                            });
                        }
                    } else {
                        results.failed.push({
                            nominationId,
                            error: result.error
                        });
                    }
                } catch (error) {
                    results.failed.push({
                        nominationId,
                        error: error.message
                    });
                }
            }

            return this.sendSuccess(
                res,
                results,
                `Processed ${nominationIds.length} nominations: ${results.approved.length} approved, ${results.duplicate.length} duplicates, ${results.failed.length} failed`
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    };
}

export default NominationController;
