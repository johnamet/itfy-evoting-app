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

    /**
     * Get profile completion status
     * GET /api/v1/candidates/:candidateId/completion
     * Access: Candidate or Admin
     */
    getProfileCompletion = this.asyncHandler(async (req, res) => {
        const { candidateId } = this.getRequestParams(req);

        if (!this.validateMongoId(candidateId)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        try {
            const result = await candidateService.getProfileCompletionStatus(candidateId);
            return this.sendSuccess(res, result, 'Profile completion status retrieved');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update candidate profile
     * PUT /api/v1/candidates/:candidateId/profile
     * Access: Candidate owner or Admin
     */
    updateProfile = this.asyncHandler(async (req, res) => {
        const { candidateId } = this.getRequestParams(req);
        const updateData = this.getRequestBody(req);

        if (!this.validateMongoId(candidateId)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        // Whitelist allowed profile fields
        const allowedFields = [
            'bio', 'profileImage', 'skills', 'projects', 
            'socialMedia', 'phone', 'location'
        ];

        const profileData = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                profileData[field] = updateData[field];
            }
        }

        if (Object.keys(profileData).length === 0) {
            return this.sendBadRequest(res, 'No valid profile fields provided');
        }

        try {
            const result = await candidateService.updateCandidate(
                candidateId,
                profileData,
                req.user?.userId || req.candidate?.candidateId
            );

            // Recalculate profile completion
            const completionResult = await candidateService.calculateAndUpdateProfileCompletion(candidateId);

            return this.sendSuccess(res, {
                ...result,
                profileCompletion: completionResult.profileCompletion
            }, 'Profile updated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Activate candidate
     * POST /api/v1/candidates/:candidateId/activate
     * Access: Admin only
     */
    activateCandidate = this.asyncHandler(async (req, res) => {
        const { candidateId } = this.getRequestParams(req);
        const adminId = req.user?.userId;

        if (!this.validateMongoId(candidateId)) {
            return this.sendBadRequest(res, 'Invalid candidate ID format');
        }

        if (!adminId) {
            return this.sendUnauthorized(res, 'Admin authentication required');
        }

        try {
            const result = await candidateService.activateCandidate(candidateId, adminId);
            return this.sendSuccess(res, result, 'Candidate activated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get candidates by status
     * GET /api/v1/candidates/status/:status
     * Access: Admin only
     */
    getCandidatesByStatus = this.asyncHandler(async (req, res) => {
        const { status } = this.getRequestParams(req);
        const { eventId } = this.getRequestQuery(req);
        const pagination = this.getPagination(req);

        if (!eventId) {
            return this.sendBadRequest(res, 'eventId is required');
        }

        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const result = await candidateService.getCandidatesByStatus(
                eventId,
                status,
                pagination
            );

            return this.sendPaginatedResponse(
                res,
                result.candidates,
                result.pagination,
                `Candidates with status '${status}' retrieved`
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default CandidateController;
