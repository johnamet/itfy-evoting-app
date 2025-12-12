/**
 * VotingController
 * 
 * Handles voting operations:
 * - Cast votes
 * - Vote history
 * - Vote analytics
 * - Vote bundles
 * - Bulk voting
 * 
 * @module controllers/VotingController
 */

import BaseController from './BaseController.js';
import { votingService, eventService } from '../services/index.js';

class VotingController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Cast votes with vote bundles (Anonymous/Public)
     * POST /api/v1/votes/cast
     * Access: Public (no authentication required)
     * Rate limit: 5 votes/min per IP, 50 votes/hour per IP
     * 
     * Flow:
     * 1. Voter selects vote bundles (with quantity)
     * 2. Optional: Applies coupon code
     * 3. Voter completes payment
     * 4. Calls this endpoint with payment reference
     * 5. System validates bundles, pricing, and payment
     * 6. Creates vote(s) for the candidate
     * 
     * Body: {
     *   eventId: string (required),
     *   categoryId: string (required),
     *   candidateId: string (required),
     *   voterEmail: string (required),
     *   voterName: string (optional),
     *   voteBundles: Array<{bundleId: string, quantity: number}> (required),
     *   couponCode: string (optional),
     *   paymentReference: string (required)
     * }
     */
    castVote = this.asyncHandler(async (req, res) => {
        const { 
            eventId, 
            categoryId, 
            candidateId, 
            voterEmail, 
            voterName,
            voteBundles,
            couponCode,
            paymentReference 
        } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { eventId, categoryId, candidateId, voterEmail, voteBundles, paymentReference },
            ['eventId', 'categoryId', 'candidateId', 'voterEmail', 'voteBundles', 'paymentReference']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate MongoDB IDs
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        if (!this.validateMongoId(categoryId)) {
            return this.sendBadRequest(res, 'Invalid category ID format');
        }

        if (!this.validateMongoId(candidateId)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        // Validate email format
        if (!this.isValidEmail(voterEmail)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        // Validate voteBundles structure
        if (!Array.isArray(voteBundles) || voteBundles.length === 0) {
            return this.sendBadRequest(res, 'At least one vote bundle is required');
        }

        for (const bundle of voteBundles) {
            if (!bundle.bundleId || !bundle.quantity) {
                return this.sendBadRequest(res, 'Each bundle must have bundleId and quantity');
            }

            if (!this.validateMongoId(bundle.bundleId)) {
                return this.sendBadRequest(res, `Invalid bundle ID format: ${bundle.bundleId}`);
            }

            if (!this.isValidInteger(bundle.quantity) || bundle.quantity < 1) {
                return this.sendBadRequest(res, 'Bundle quantity must be a positive integer');
            }
        }

        // Gather metadata for tracking (IP, user agent, etc.)
        const metadata = {
            ipAddress: req.clientIp || req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            device: req.device?.type || 'unknown',
            location: req.geo || {},
            referrer: req.get('referrer') || req.get('referer'),
            platform: 'web'
        };

        try {
            const result = await votingService.castVote({
                eventId,
                categoryId,
                candidateId,
                voterEmail,
                voterName,
                voteBundles,
                couponCode,
                paymentReference
            }, metadata);

            // Emit real-time update via Socket.IO with vote count
            const io = req.app.get('io');
            if (io && result.success && result.data.vote) {
                const totalVotes = result.data.vote.totalVotes;
                
                io.to(`event-${eventId}`).emit('vote-cast', {
                    candidateId,
                    categoryId,
                    eventId,
                    voteCount: totalVotes,
                    timestamp: new Date()
                });

                io.to(`category-${categoryId}`).emit('vote-update', {
                    candidateId,
                    voteCount: totalVotes,
                    timestamp: new Date()
                });

                io.to(`candidate-${candidateId}`).emit('votes-received', {
                    voteCount: totalVotes,
                    timestamp: new Date()
                });
            }

            return this.sendCreated(res, result, result.message || 'Votes cast successfully');
        } catch (error) {
            // Handle specific error types
            if (error.message.includes('already voted')) {
                return this.sendConflict(res, error.message);
            }
            
            if (error.message.includes('bundle') || error.message.includes('Bundle')) {
                return this.sendBadRequest(res, error.message);
            }
            
            if (error.message.includes('coupon') || error.message.includes('Coupon')) {
                return this.sendBadRequest(res, error.message);
            }
            
            if (error.message.includes('payment') || error.message.includes('Payment')) {
                return this.sendBadRequest(res, error.message);
            }
            
            if (error.message.includes('not found') || 
                error.message.includes('not active') ||
                error.message.includes('not available')) {
                return this.sendBadRequest(res, error.message);
            }
            if (error.message.includes('not started') || 
                error.message.includes('has ended')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Verify if user has voted (Anonymous check)
     * POST /api/v1/votes/check
     * Access: Public
     * 
     * Body: { email: string, eventId: string, categoryId: string }
     */
    checkVoteStatus = this.asyncHandler(async (req, res) => {
        const { email, eventId, categoryId } = this.getRequestBody(req);

        // Validate required fields
        if (!email || !eventId) {
            return this.sendBadRequest(res, 'Email and eventId are required');
        }

        if (!this.isValidEmail(email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        if (categoryId && !this.validateMongoId(categoryId)) {
            return this.sendBadRequest(res, 'Invalid category ID format');
        }

        try {
            const hasVoted = await votingService.checkIfVoted(email, eventId, categoryId);

            return this.sendSuccess(res, {
                hasVoted,
                email: email.toLowerCase(),
                eventId,
                categoryId: categoryId || null
            }, hasVoted ? 'User has already voted' : 'User has not voted yet');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get all votes for an event
     * GET /api/v1/events/:eventId/votes
     * Access: Event owner or Admin
     */
    getEventVotes = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);
        const pagination = this.getPagination(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            // Get event to check ownership
            const event = await eventService.getEventById(eventId);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'You can only view votes for your own events');
            }

            const result = await votingService.getEventVotes(eventId, pagination);

            return this.sendPaginatedResponse(
                res,
                result.votes,
                { total: result.total, ...pagination },
                'Event votes retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get candidate votes
     * GET /api/v1/candidates/:candidateId/votes
     * Access: Event owner or Admin
     */
    getCandidateVotes = this.asyncHandler(async (req, res) => {
        const { candidateId } = this.getRequestParams(req);
        const pagination = this.getPagination(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(candidateId)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        try {
            const result = await votingService.getCandidateVotes(candidateId, pagination);

            // Check authorization - must be event owner or admin
            if (result.votes.length > 0) {
                const event = await eventService.getEventById(result.votes[0].eventId);
                
                if (event && !this.canModifyResource(req, event.createdBy)) {
                    return this.sendForbidden(res, 'Insufficient permissions');
                }
            }

            return this.sendPaginatedResponse(
                res,
                result.votes,
                { total: result.total, ...pagination },
                'Candidate votes retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get vote analytics for event
     * GET /api/v1/events/:eventId/analytics
     * Access: Event owner or Admin
     */
    getVoteAnalytics = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            // Get event to check ownership
            const event = await eventService.getEventById(eventId);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'You can only view analytics for your own events');
            }

            const analytics = await votingService.getVoteAnalytics(eventId);
            return this.sendSuccess(res, analytics, 'Vote analytics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Purchase vote bundle
     * POST /api/v1/vote-bundles/purchase
     * Access: Authenticated users
     */
    // ========================================
    // DEPRECATED: User-based voting methods
    // These are from the old user-authenticated voting system
    // Vote bundles are now purchased via PaymentController
    // and anonymous voters fetch bundles via getActiveVoteBundles,
    // getEventVoteBundles, getCategoryVoteBundles
    // ========================================

    /*
    purchaseVoteBundle = this.asyncHandler(async (req, res) => {
        // DEPRECATED: Use PaymentController.purchaseVoteBundle instead
        return this.sendError(res, new Error('This endpoint is deprecated. Use /api/v1/payments/bundles/purchase'));
    });

    getMyVoteBundles = this.asyncHandler(async (req, res) => {
        // DEPRECATED: Anonymous voting doesn't support user-specific bundles
        return this.sendError(res, new Error('This endpoint is deprecated. Use /api/v1/votes/bundles/active'));
    });

    getAvailableVoteBundles = this.asyncHandler(async (req, res) => {
        // DEPRECATED: Use getActiveVoteBundles instead
        return this.sendError(res, new Error('This endpoint is deprecated. Use /api/v1/votes/bundles/active'));
    });
    */

    /**
     * Check if user has voted in event
     * GET /api/v1/events/:eventId/has-voted
     * Access: Authenticated users
     */
    hasVoted = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);
        const userId = this.getUserId(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const hasVoted = await votingService.hasUserVoted(userId, eventId);
            return this.sendSuccess(
                res,
                { hasVoted },
                hasVoted ? 'User has already voted in this event' : 'User has not voted yet'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Bulk cast votes (for multiple candidates)
     * POST /api/v1/votes/bulk
     * Access: Authenticated users
     */
    bulkCastVotes = this.asyncHandler(async (req, res) => {
        const { eventId, votes } = this.getRequestBody(req);
        const userId = this.getUserId(req);
        const metadata = this.getRequestMetadata(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { eventId, votes },
            ['eventId', 'votes']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        // Validate votes array
        if (!Array.isArray(votes) || votes.length === 0) {
            return this.sendBadRequest(res, 'Votes must be a non-empty array');
        }

        // Validate each vote
        for (const vote of votes) {
            if (!vote.candidateId || !this.validateMongoId(vote.candidateId)) {
                return this.sendBadRequest(res, 'Each vote must have a valid candidateId');
            }
            
            const voteCount = vote.voteCount || 1;
            if (!this.isValidInteger(voteCount) || voteCount < 1) {
                return this.sendBadRequest(res, 'Vote count must be a positive integer');
            }
        }

        try {
            const result = await votingService.bulkCastVotes({
                userId,
                eventId,
                votes,
                metadata
            });

            // Emit real-time update via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to(`event-${eventId}`).emit('votes-cast', {
                    eventId,
                    count: votes.length,
                    timestamp: new Date()
                });
            }

            return this.sendCreated(res, result, 'Votes cast successfully');
        } catch (error) {
            if (error.message.includes('already voted')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    // ========================================
    // Vote Bundle Management (Admin)
    // ========================================

    /**
     * Create vote bundle (Admin)
     * POST /api/v1/votes/bundles
     * Access: Admin Level 3+
     * 
     * Body: {
     *   name: string (required),
     *   description: string,
     *   votes: number (required),
     *   pricing: {
     *     basePrice: number (required),
     *     discountPrice: number,
     *     currency: string (required),
     *     validFrom: date,
     *     validUntil: date
     *   },
     *   applicability: {
     *     events: string[],
     *     categories: string[],
     *     excludeEvents: string[],
     *     excludeCategories: string[]
     *   },
     *   features: string[],
     *   availability: {
     *     totalAvailable: number,
     *     limitPerUser: number,
     *     limitPerTransaction: number
     *   },
     *   display: {
     *     order: number,
     *     badge: string,
     *     highlighted: boolean
     *   }
     * }
     */
    createVoteBundle = this.asyncHandler(async (req, res) => {
        const bundleData = this.getRequestBody(req);
        const adminId = req.user.userId;

        try {
            const result = await votingService.createVoteBundle(bundleData, adminId);
            return this.sendCreated(res, result, 'Vote bundle created successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update vote bundle (Admin)
     * PUT /api/v1/votes/bundles/:bundleId
     * Access: Admin Level 3+
     */
    updateVoteBundle = this.asyncHandler(async (req, res) => {
        const { bundleId } = req.params;
        const updateData = this.getRequestBody(req);
        const adminId = req.user.userId;

        if (!this.validateMongoId(bundleId)) {
            return this.sendBadRequest(res, 'Invalid bundle ID format');
        }

        try {
            const result = await votingService.updateVoteBundle(bundleId, updateData, adminId);
            return this.sendSuccess(res, result, 'Vote bundle updated successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get all vote bundles with filters (Admin)
     * GET /api/v1/votes/bundles/admin
     * Access: Admin Level 2+
     * 
     * Query params:
     *   status: string (draft, active, limited, sold_out, expired, archived)
     *   eventId: string
     *   categoryId: string
     *   search: string
     *   page: number (default: 1)
     *   limit: number (default: 10)
     */
    getAllVoteBundles = this.asyncHandler(async (req, res) => {
        const { status, eventId, categoryId, search, page, limit } = req.query;

        const filters = {};
        if (status) filters.status = status;
        if (eventId) filters.eventId = eventId;
        if (categoryId) filters.categoryId = categoryId;
        if (search) filters.search = search;

        const pagination = {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10
        };

        try {
            const result = await votingService.getAllVoteBundles(filters, pagination);
            return this.sendSuccess(res, result, 'Vote bundles retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get single vote bundle details
     * GET /api/v1/votes/bundles/:bundleId
     * Access: Public
     */
    getVoteBundle = this.asyncHandler(async (req, res) => {
        const { bundleId } = req.params;

        if (!this.validateMongoId(bundleId)) {
            return this.sendBadRequest(res, 'Invalid bundle ID format');
        }

        try {
            const result = await votingService.getVoteBundle(bundleId);
            return this.sendSuccess(res, result, 'Vote bundle retrieved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get vote bundles for an event (Public)
     * GET /api/v1/votes/bundles/event/:eventId
     * Access: Public
     */
    getEventVoteBundles = this.asyncHandler(async (req, res) => {
        const { eventId } = req.params;

        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const result = await votingService.getEventVoteBundles(eventId);
            return this.sendSuccess(res, result, 'Event vote bundles retrieved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get vote bundles for a category (Public)
     * GET /api/v1/votes/bundles/category/:categoryId
     * Access: Public
     * 
     * This is the most important endpoint for the voting flow:
     * When a voter selects a category to vote in, they fetch
     * available bundles to purchase votes.
     */
    getCategoryVoteBundles = this.asyncHandler(async (req, res) => {
        const { categoryId } = req.params;

        if (!this.validateMongoId(categoryId)) {
            return this.sendBadRequest(res, 'Invalid category ID format');
        }

        try {
            const result = await votingService.getCategoryVoteBundles(categoryId);
            return this.sendSuccess(res, result, 'Category vote bundles retrieved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get all active vote bundles (Public)
     * GET /api/v1/votes/bundles/active
     * Access: Public
     */
    getActiveVoteBundles = this.asyncHandler(async (req, res) => {
        try {
            const result = await votingService.getActiveVoteBundles();
            return this.sendSuccess(res, result, 'Active vote bundles retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Delete vote bundle (Admin)
     * DELETE /api/v1/votes/bundles/:bundleId
     * Access: Admin Level 4+ (Super Admin only)
     * Note: Can only delete bundles that haven't been purchased
     */
    deleteVoteBundle = this.asyncHandler(async (req, res) => {
        const { bundleId } = req.params;
        const adminId = req.user.userId;

        if (!this.validateMongoId(bundleId)) {
            return this.sendBadRequest(res, 'Invalid bundle ID format');
        }

        try {
            const result = await votingService.deleteVoteBundle(bundleId, adminId);
            return this.sendSuccess(res, result, 'Vote bundle deleted successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('Cannot delete')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Archive vote bundle (Admin)
     * POST /api/v1/votes/bundles/:bundleId/archive
     * Access: Admin Level 3+
     * Note: Use this for bundles that have been purchased
     */
    archiveVoteBundle = this.asyncHandler(async (req, res) => {
        const { bundleId } = req.params;
        const adminId = req.user.userId;

        if (!this.validateMongoId(bundleId)) {
            return this.sendBadRequest(res, 'Invalid bundle ID format');
        }

        try {
            const result = await votingService.archiveVoteBundle(bundleId, adminId);
            return this.sendSuccess(res, result, 'Vote bundle archived successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('already archived')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });
}

export default VotingController;
