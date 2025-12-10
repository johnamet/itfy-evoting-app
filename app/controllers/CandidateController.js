/**
 * CandidateController
 * 
 * Handles candidate management operations:
 * - CRUD operations
 * - Approval/rejection workflow
 * - Candidate rankings
 * - Candidate statistics
 * - Bulk operations
 * 
 * @module controllers/CandidateController
 */

import BaseController from './BaseController.js';
import { candidateService, eventService } from '../services/index.js';

class CandidateController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get all candidates for an event
     * GET /api/v1/events/:eventId/candidates
     * Access: Public
     */
    getEventCandidates = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);
        const pagination = this.getPagination(req);
        const { status } = this.getRequestQuery(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const result = await candidateService.getEventCandidates({
                eventId,
                status,
                ...pagination
            });

            return this.sendPaginatedResponse(
                res,
                result.candidates,
                { total: result.total, ...pagination },
                'Candidates retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get candidate by ID
     * GET /api/v1/candidates/:id
     * Access: Public
     */
    getCandidateById = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        try {
            const candidate = await candidateService.getCandidateById(id);
            
            if (!candidate) {
                return this.sendNotFound(res, 'Candidate not found');
            }

            return this.sendSuccess(res, candidate, 'Candidate retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Create new candidate
     * POST /api/v1/events/:eventId/candidates
     * Access: Level 2+ (organizers)
     */
    createCandidate = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);
        const candidateData = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        // Validate required fields
        const missing = this.validateRequiredFields(
            candidateData,
            ['firstName', 'lastName', 'email']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate email format
        if (!this.validateEmail(candidateData.email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        try {
            // Verify event exists
            const event = await eventService.getEventById(eventId);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check if event is in draft status
            if (event.status !== 'draft') {
                return this.sendBadRequest(res, 'Can only add candidates to draft events');
            }

            const candidate = await candidateService.createCandidate({
                ...candidateData,
                eventId
            });

            return this.sendCreated(res, candidate, 'Candidate created successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Update candidate
     * PUT /api/v1/candidates/:id
     * Access: Event organizer or Admin
     */
    updateCandidate = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const updates = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        // Validate email if provided
        if (updates.email && !this.validateEmail(updates.email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        try {
            const candidate = await candidateService.getCandidateById(id);
            
            if (!candidate) {
                return this.sendNotFound(res, 'Candidate not found');
            }

            // Get event to check ownership
            const event = await eventService.getEventById(candidate.eventId);
            
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'Insufficient permissions');
            }

            // Prevent status updates via this endpoint (use approve/reject endpoints)
            delete updates.status;

            const updatedCandidate = await candidateService.updateCandidate(id, updates);
            return this.sendSuccess(res, updatedCandidate, 'Candidate updated successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Delete candidate
     * DELETE /api/v1/candidates/:id
     * Access: Event organizer or Admin
     */
    deleteCandidate = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        try {
            const candidate = await candidateService.getCandidateById(id);
            
            if (!candidate) {
                return this.sendNotFound(res, 'Candidate not found');
            }

            // Get event to check ownership
            const event = await eventService.getEventById(candidate.eventId);
            
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'Insufficient permissions');
            }

            // Prevent deletion if event is active
            if (event.status === 'active') {
                return this.sendBadRequest(res, 'Cannot delete candidate from active event');
            }

            await candidateService.deleteCandidate(id);
            return this.sendNoContent(res);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Approve candidate
     * POST /api/v1/candidates/:id/approve
     * Access: Admin only
     */
    approveCandidate = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        try {
            const candidate = await candidateService.approveCandidate(id);
            return this.sendSuccess(res, candidate, 'Candidate approved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('already')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Reject candidate
     * POST /api/v1/candidates/:id/reject
     * Access: Admin only
     */
    rejectCandidate = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const { reason } = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        if (!reason) {
            return this.sendBadRequest(res, 'Rejection reason is required');
        }

        try {
            const candidate = await candidateService.rejectCandidate(id, reason);
            return this.sendSuccess(res, candidate, 'Candidate rejected');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Suspend candidate
     * POST /api/v1/candidates/:id/suspend
     * Access: Admin only
     */
    suspendCandidate = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const { reason } = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        if (!reason) {
            return this.sendBadRequest(res, 'Suspension reason is required');
        }

        try {
            const candidate = await candidateService.suspendCandidate(id, reason);
            return this.sendSuccess(res, candidate, 'Candidate suspended');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get candidate rankings for event
     * GET /api/v1/events/:eventId/rankings
     * Access: Public (for closed events), Event owner/Admin (for active events)
     */
    getCandidateRankings = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);
        const { limit = 10 } = this.getRequestQuery(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(eventId);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check if user can view rankings
            const canView = event.status === 'closed' || 
                           this.canModifyResource(req, event.createdBy);

            if (!canView) {
                return this.sendForbidden(res, 'Rankings are only available for closed events');
            }

            const rankings = await candidateService.getCandidateRankings(eventId, parseInt(limit));
            return this.sendSuccess(res, rankings, 'Rankings retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get candidate statistics
     * GET /api/v1/candidates/:id/statistics
     * Access: Event owner or Admin
     */
    getCandidateStatistics = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        try {
            const candidate = await candidateService.getCandidateById(id);
            
            if (!candidate) {
                return this.sendNotFound(res, 'Candidate not found');
            }

            // Get event to check ownership
            const event = await eventService.getEventById(candidate.eventId);
            
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'Insufficient permissions');
            }

            const stats = await candidateService.getCandidateStatistics(id);
            return this.sendSuccess(res, stats, 'Candidate statistics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update candidate photo
     * PUT /api/v1/candidates/:id/photo
     * Access: Event organizer or Admin
     */
    updateCandidatePhoto = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        // Check if file was uploaded
        if (!req.file) {
            return this.sendBadRequest(res, 'Photo file is required');
        }

        // Validate file upload
        const validation = this.validateFileUpload(req.file, {
            maxSize: 5 * 1024 * 1024, // 5MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/jpg']
        });

        if (!validation.valid) {
            return this.sendBadRequest(res, validation.error);
        }

        try {
            const candidate = await candidateService.getCandidateById(id);
            
            if (!candidate) {
                await this.cleanupFailedUpload(req.file.path);
                return this.sendNotFound(res, 'Candidate not found');
            }

            // Get event to check ownership
            const event = await eventService.getEventById(candidate.eventId);
            
            if (!this.canModifyResource(req, event.createdBy)) {
                await this.cleanupFailedUpload(req.file.path);
                return this.sendForbidden(res, 'Insufficient permissions');
            }

            const updatedCandidate = await candidateService.updateCandidatePhoto(id, req.file);
            return this.sendSuccess(res, updatedCandidate, 'Photo updated successfully');
        } catch (error) {
            if (req.file?.path) {
                await this.cleanupFailedUpload(req.file.path);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Bulk approve candidates
     * POST /api/v1/candidates/bulk-approve
     * Access: Admin only
     */
    bulkApprove = this.asyncHandler(async (req, res) => {
        const { candidateIds } = this.getRequestBody(req);

        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
            return this.sendBadRequest(res, 'candidateIds must be a non-empty array');
        }

        // Validate all MongoDB IDs
        for (const id of candidateIds) {
            if (!this.validateMongoId(id)) {
                return this.sendBadRequest(res, `Invalid candidate ID format: ${id}`);
            }
        }

        try {
            const result = await candidateService.bulkApprove(candidateIds);
            return this.sendSuccess(res, result, 'Candidates approved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Bulk reject candidates
     * POST /api/v1/candidates/bulk-reject
     * Access: Admin only
     */
    bulkReject = this.asyncHandler(async (req, res) => {
        const { candidateIds, reason } = this.getRequestBody(req);

        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
            return this.sendBadRequest(res, 'candidateIds must be a non-empty array');
        }

        if (!reason) {
            return this.sendBadRequest(res, 'Rejection reason is required');
        }

        // Validate all MongoDB IDs
        for (const id of candidateIds) {
            if (!this.validateMongoId(id)) {
                return this.sendBadRequest(res, `Invalid candidate ID format: ${id}`);
            }
        }

        try {
            const result = await candidateService.bulkReject(candidateIds, reason);
            return this.sendSuccess(res, result, 'Candidates rejected successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default CandidateController;
