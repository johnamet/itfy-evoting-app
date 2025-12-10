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
     * Cast a vote
     * POST /api/v1/votes
     * Access: Authenticated users
     * Rate limit: 10 votes/min per user, 100 votes/hour per IP
     */
    castVote = this.asyncHandler(async (req, res) => {
        const { eventId, candidateId, voteCount = 1 } = this.getRequestBody(req);
        const userId = this.getUserId(req);
        const metadata = this.getRequestMetadata(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { eventId, candidateId },
            ['eventId', 'candidateId']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate MongoDB IDs
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        if (!this.validateMongoId(candidateId)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        // Validate vote count
        if (!this.isValidInteger(voteCount) || voteCount < 1) {
            return this.sendBadRequest(res, 'Vote count must be a positive integer');
        }

        try {
            // Verify event is active
            const event = await eventService.getEventById(eventId);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            if (event.status !== 'active') {
                return this.sendBadRequest(res, 'Event is not active');
            }

            const vote = await votingService.castVote({
                userId,
                eventId,
                candidateId,
                voteCount,
                metadata
            });

            // Emit real-time update via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to(`event-${eventId}`).emit('vote-cast', {
                    candidateId,
                    eventId,
                    timestamp: new Date()
                });
            }

            return this.sendCreated(res, vote, 'Vote cast successfully');
        } catch (error) {
            if (error.message.includes('already voted')) {
                return this.sendConflict(res, error.message);
            }
            if (error.message.includes('not approved') || 
                error.message.includes('not found')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get user's vote history
     * GET /api/v1/votes/history
     * Access: Authenticated users (own history)
     */
    getVoteHistory = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);
        const pagination = this.getPagination(req);
        const { eventId } = this.getRequestQuery(req);

        // Validate eventId if provided
        if (eventId && !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const result = await votingService.getVoteHistory({
                userId,
                eventId,
                ...pagination
            });

            return this.sendPaginatedResponse(
                res,
                result.votes,
                { total: result.total, ...pagination },
                'Vote history retrieved successfully'
            );
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
    purchaseVoteBundle = this.asyncHandler(async (req, res) => {
        const { bundleId, quantity = 1 } = this.getRequestBody(req);
        const userId = this.getUserId(req);

        // Validate required fields
        if (!bundleId) {
            return this.sendBadRequest(res, 'Bundle ID is required');
        }

        // Validate MongoDB ID
        if (!this.validateMongoId(bundleId)) {
            return this.sendBadRequest(res, 'Invalid bundle ID format');
        }

        // Validate quantity
        if (!this.isValidInteger(quantity) || quantity < 1) {
            return this.sendBadRequest(res, 'Quantity must be a positive integer');
        }

        try {
            const purchase = await votingService.purchaseVoteBundle({
                userId,
                bundleId,
                quantity
            });

            return this.sendCreated(res, purchase, 'Vote bundle purchased successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('not available')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get user's vote bundles
     * GET /api/v1/vote-bundles/my-bundles
     * Access: Authenticated users
     */
    getMyVoteBundles = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);
        const pagination = this.getPagination(req);

        try {
            const result = await votingService.getUserVoteBundles(userId, pagination);

            return this.sendPaginatedResponse(
                res,
                result.bundles,
                { total: result.total, ...pagination },
                'Vote bundles retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get available vote bundles
     * GET /api/v1/vote-bundles
     * Access: Public
     */
    getAvailableVoteBundles = this.asyncHandler(async (req, res) => {
        try {
            const bundles = await votingService.getAvailableVoteBundles();
            return this.sendSuccess(res, bundles, 'Available vote bundles retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

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
}

export default VotingController;
