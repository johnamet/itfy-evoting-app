/**
 * UserController
 * 
 * Handles user management operations:
 * - CRUD operations
 * - Profile updates
 * - Search and listing
 * - User statistics
 * - Bulk operations (admin)
 * 
 * @module controllers/UserController
 */

import BaseController from './BaseController.js';
import { userService } from '../services/index.js';

class UserController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get all users (paginated)
     * GET /api/v1/users
     * Access: Admin only
     */
    getAllUsers = this.asyncHandler(async (req, res) => {
        const pagination = this.getPagination(req);
        const sortOptions = this.getSortOptions(req);
        const filters = this.getFilterOptions(req, ['role', 'level', 'verified', 'active']);

        try {
            const result = await userService.getAllUsers({
                ...pagination,
                sort: sortOptions,
                filters
            });

            return this.sendPaginatedResponse(
                res,
                result.users.map(u => this.sanitizeUser(u)),
                { total: result.total, ...pagination },
                'Users retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get user by ID
     * GET /api/v1/users/:id
     * Access: User (own profile) or Admin
     */
    getUserById = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Check authorization
        if (!this.canModifyResource(req, id)) {
            return this.sendForbidden(res, 'You can only view your own profile');
        }

        try {
            const user = await userService.getUserById(id);
            
            if (!user) {
                return this.sendNotFound(res, 'User not found');
            }

            return this.sendSuccess(res, this.sanitizeUser(user), 'User retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update user profile
     * PUT /api/v1/users/:id
     * Access: User (own profile) or Admin
     */
    updateUser = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const updates = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Check authorization
        if (!this.canModifyResource(req, id)) {
            return this.sendForbidden(res, 'You can only update your own profile');
        }

        // Validate email if provided
        if (updates.email && !this.validateEmail(updates.email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        // Prevent users from changing their own role/level (only admin can)
        if (!this.isAdmin(req)) {
            delete updates.role;
            delete updates.level;
            delete updates.verified;
            delete updates.active;
        }

        try {
            const user = await userService.updateUser(id, updates);
            
            if (!user) {
                return this.sendNotFound(res, 'User not found');
            }

            return this.sendSuccess(res, this.sanitizeUser(user), 'User updated successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Delete user
     * DELETE /api/v1/users/:id
     * Access: Admin only
     */
    deleteUser = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Prevent self-deletion
        const currentUserId = this.getUserId(req);
        if (id === currentUserId.toString()) {
            return this.sendBadRequest(res, 'Cannot delete your own account');
        }

        try {
            const deleted = await userService.deleteUser(id);
            
            if (!deleted) {
                return this.sendNotFound(res, 'User not found');
            }

            return this.sendNoContent(res);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Search users
     * GET /api/v1/users/search
     * Access: Admin only
     */
    searchUsers = this.asyncHandler(async (req, res) => {
        const { q } = this.getRequestQuery(req);
        const pagination = this.getPagination(req);

        if (!q || q.trim().length === 0) {
            return this.sendBadRequest(res, 'Search query is required');
        }

        try {
            const result = await userService.searchUsers(q, pagination);

            return this.sendPaginatedResponse(
                res,
                result.users.map(u => this.sanitizeUser(u)),
                { total: result.total, ...pagination },
                'Search results retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get user statistics
     * GET /api/v1/users/statistics
     * Access: Admin only
     */
    getUserStatistics = this.asyncHandler(async (req, res) => {
        try {
            const stats = await userService.getUserStatistics();
            return this.sendSuccess(res, stats, 'User statistics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get user's created events
     * GET /api/v1/users/:id/events
     * Access: User (own events) or Admin
     */
    getUserEvents = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const pagination = this.getPagination(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Check authorization
        if (!this.canModifyResource(req, id)) {
            return this.sendForbidden(res, 'You can only view your own events');
        }

        try {
            const result = await userService.getUserEvents(id, pagination);

            return this.sendPaginatedResponse(
                res,
                result.events,
                { total: result.total, ...pagination },
                'User events retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get user's voting history
     * GET /api/v1/users/:id/votes
     * Access: User (own votes) or Admin
     */
    getUserVotes = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const pagination = this.getPagination(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Check authorization
        if (!this.canModifyResource(req, id)) {
            return this.sendForbidden(res, 'You can only view your own voting history');
        }

        try {
            const result = await userService.getUserVotes(id, pagination);

            return this.sendPaginatedResponse(
                res,
                result.votes,
                { total: result.total, ...pagination },
                'User votes retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update user photo
     * PUT /api/v1/users/:id/photo
     * Access: User (own photo) or Admin
     */
    updateUserPhoto = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Check authorization
        if (!this.canModifyResource(req, id)) {
            return this.sendForbidden(res, 'You can only update your own photo');
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
            const user = await userService.updateUserPhoto(id, req.file);
            
            if (!user) {
                return this.sendNotFound(res, 'User not found');
            }

            return this.sendSuccess(res, this.sanitizeUser(user), 'Photo updated successfully');
        } catch (error) {
            // Cleanup uploaded file on error
            if (req.file?.path) {
                await this.cleanupFailedUpload(req.file.path);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Bulk update users (admin)
     * PUT /api/v1/users/bulk
     * Access: Admin only
     */
    bulkUpdateUsers = this.asyncHandler(async (req, res) => {
        const { userIds, updates } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { userIds, updates },
            ['userIds', 'updates']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate userIds array
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return this.sendBadRequest(res, 'userIds must be a non-empty array');
        }

        // Validate all MongoDB IDs
        for (const id of userIds) {
            if (!this.validateMongoId(id)) {
                return this.sendBadRequest(res, `Invalid user ID format: ${id}`);
            }
        }

        try {
            const result = await userService.bulkUpdateUsers(userIds, updates);
            return this.sendSuccess(res, result, 'Users updated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default UserController;
