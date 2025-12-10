/**
 * UserService
 * 
 * Handles user profile management, permissions, roles, and account operations.
 * Manages user lifecycle including creation, updates, status changes, and deletions.
 * 
 * @extends BaseService
 * @module services/UserService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';
import bcrypt from 'bcrypt';

export default class UserService extends BaseService {
    constructor(repositories) {
        super(repositories, {
            serviceName: 'UserService',
            primaryRepository: 'user',
        });
    }

    /**
     * Get user profile by ID with related data
     */
    async getUserProfile(userId) {
        return this.runInContext('getUserProfile', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Get user activity summary
            const activityCount = await this.repo('activity')
                .count({ userId, resourceType: { $in: ['vote', 'event', 'payment'] } });

            // Get user votes count
            const votesCount = await this.repo('vote').count({ voterId: userId });

            // Get user events (if organizer)
            let eventsOrganized = 0;
            if (user.level >= 2) {
                eventsOrganized = await this.repo('event').count({ createdBy: userId });
            }

            return this.handleSuccess({
                user: this._sanitizeUser(user),
                stats: {
                    activitiesCount: activityCount,
                    votesCount,
                    eventsOrganized,
                },
            }, 'Profile retrieved successfully');
        });
    }

    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        return this.runInContext('updateProfile', async () => {
            // Prevent updating sensitive fields directly
            const allowedFields = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'address', 'bio'];
            const sanitizedUpdates = {};

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    sanitizedUpdates[field] = updates[field];
                }
            }

            // Validate email if being updated
            if (updates.email) {
                this.validateEmail(updates.email);
                
                // Check if email is already taken
                const existingUser = await this.repo('user').findOne({ 
                    email: updates.email, 
                    _id: { $ne: userId } 
                });

                if (existingUser) {
                    throw new Error('Email already in use');
                }

                sanitizedUpdates.email = updates.email;
                sanitizedUpdates.emailVerified = false; // Require re-verification
            }

            const updatedUser = await this.repo('user').update(userId, sanitizedUpdates);

            await this.logActivity(userId, 'update', 'user', {
                fields: Object.keys(sanitizedUpdates),
                requiresVerification: !!updates.email,
            });

            return this.handleSuccess(
                { user: this._sanitizeUser(updatedUser) },
                'Profile updated successfully'
            );
        });
    }

    /**
     * Update user password
     */
    async updatePassword(userId, currentPassword, newPassword) {
        return this.runInContext('updatePassword', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                throw new Error('Current password is incorrect');
            }

            // Validate new password
            this.validatePassword(newPassword);

            // Hash new password
            const saltRounds = this.getSetting('security.bcryptRounds', 10);
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            await this.repo('user').update(userId, { password: hashedPassword });

            await this.logActivity(userId, 'update', 'user', {
                action: 'password_change',
            });

            return this.handleSuccess(null, 'Password updated successfully');
        });
    }

    /**
     * Update user photo
     */
    async updatePhoto(userId, photoPath) {
        return this.runInContext('updatePhoto', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            const updatedUser = await this.repo('user').update(userId, { photo: photoPath });

            await this.logActivity(userId, 'update', 'user', {
                action: 'photo_update',
                photoPath,
            });

            return this.handleSuccess(
                { user: this._sanitizeUser(updatedUser) },
                'Photo updated successfully'
            );
        });
    }

    /**
     * List users with filters and pagination
     */
    async listUsers(filters = {}, pagination = {}) {
        return this.runInContext('listUsers', async () => {
            const { page, limit, skip } = this.parsePagination(pagination);

            const query = {};

            // Filter by role
            if (filters.role) {
                query.role = filters.role;
            }

            // Filter by level
            if (filters.level) {
                query.level = parseInt(filters.level);
            }

            // Filter by verification status
            if (filters.emailVerified !== undefined) {
                query.emailVerified = filters.emailVerified === 'true';
            }

            // Filter by status
            if (filters.status) {
                query.status = filters.status;
            }

            // Search by name or email
            if (filters.search) {
                query.$or = [
                    { firstName: { $regex: filters.search, $options: 'i' } },
                    { lastName: { $regex: filters.search, $options: 'i' } },
                    { email: { $regex: filters.search, $options: 'i' } },
                ];
            }

            // Date range filter
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            const users = await this.repo('user').findWithPagination(query, {
                page,
                limit,
                sort: filters.sort || { createdAt: -1 },
            });

            const sanitizedUsers = users.docs.map(user => this._sanitizeUser(user));

            return this.handleSuccess(
                this.createPaginatedResponse(sanitizedUsers, users.total, page, limit),
                'Users retrieved successfully'
            );
        });
    }

    /**
     * Search users by text
     */
    async searchUsers(searchTerm, pagination = {}) {
        return this.runInContext('searchUsers', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const results = await this.repo('user').textSearch(searchTerm, {
                page,
                limit,
            });

            const sanitizedUsers = results.docs.map(user => this._sanitizeUser(user));

            return this.handleSuccess(
                this.createPaginatedResponse(sanitizedUsers, results.total, page, limit),
                'Search completed successfully'
            );
        });
    }

    /**
     * Update user role and level
     */
    async updateUserRole(userId, adminId, newRole, newLevel) {
        return this.runInContext('updateUserRole', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Validate role
            const validRoles = ['voter', 'organizer', 'admin', 'super-admin'];
            if (!validRoles.includes(newRole)) {
                throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
            }

            // Validate level (1-4)
            if (newLevel < 1 || newLevel > 4) {
                throw new Error('Level must be between 1 and 4');
            }

            const updates = { role: newRole, level: newLevel };
            const updatedUser = await this.repo('user').update(userId, updates);

            await this.logActivity(adminId, 'update', 'user', {
                userId,
                previousRole: user.role,
                newRole,
                previousLevel: user.level,
                newLevel,
            });

            return this.handleSuccess(
                { user: this._sanitizeUser(updatedUser) },
                'User role updated successfully'
            );
        });
    }

    /**
     * Update user status (active, suspended, banned)
     */
    async updateUserStatus(userId, adminId, newStatus, reason = '') {
        return this.runInContext('updateUserStatus', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            const validStatuses = ['active', 'suspended', 'banned', 'inactive'];
            if (!validStatuses.includes(newStatus)) {
                throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }

            const updatedUser = await this.repo('user').update(userId, { status: newStatus });

            await this.logActivity(adminId, 'update', 'user', {
                userId,
                action: 'status_change',
                previousStatus: user.status,
                newStatus,
                reason,
            });

            return this.handleSuccess(
                { user: this._sanitizeUser(updatedUser) },
                `User status updated to ${newStatus}`
            );
        });
    }

    /**
     * Delete user account (soft delete by setting status)
     */
    async deleteUser(userId, adminId, reason = '') {
        return this.runInContext('deleteUser', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Soft delete by updating status
            await this.repo('user').update(userId, { 
                status: 'deleted',
                deletedAt: new Date(),
                deletedBy: adminId,
            });

            await this.logActivity(adminId, 'delete', 'user', {
                userId,
                email: user.email,
                reason,
            });

            return this.handleSuccess(null, 'User deleted successfully');
        });
    }

    /**
     * Get user statistics
     */
    async getUserStatistics(userId) {
        return this.runInContext('getUserStatistics', async () => {
            const user = await this.repo('user').findById(userId);
            
            if (!user) {
                throw new Error('User not found');
            }

            // Votes statistics
            const totalVotes = await this.repo('vote').count({ voterId: userId });
            const votesByEvent = await this.repo('vote').aggregate([
                { $match: { voterId: userId } },
                { $group: { _id: '$eventId', count: { $sum: 1 } } },
            ]);

            // Events statistics (if organizer)
            let eventsStats = null;
            if (user.level >= 2) {
                const totalEvents = await this.repo('event').count({ createdBy: userId });
                const eventsByStatus = await this.repo('event').aggregate([
                    { $match: { createdBy: userId } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ]);

                eventsStats = {
                    total: totalEvents,
                    byStatus: eventsByStatus,
                };
            }

            // Payments statistics
            const totalPayments = await this.repo('payment').count({ userId });
            const totalSpent = await this.repo('payment').aggregate([
                { $match: { userId, status: 'successful' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);

            // Activity statistics
            const recentActivities = await this.repo('activity').find(
                { userId },
                { limit: 10, sort: { createdAt: -1 } }
            );

            return this.handleSuccess({
                user: this._sanitizeUser(user),
                statistics: {
                    votes: {
                        total: totalVotes,
                        byEvent: votesByEvent,
                    },
                    events: eventsStats,
                    payments: {
                        total: totalPayments,
                        totalSpent: totalSpent[0]?.total || 0,
                    },
                    recentActivities,
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Get users by role
     */
    async getUsersByRole(role, pagination = {}) {
        return this.runInContext('getUsersByRole', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const users = await this.repo('user').findWithPagination(
                { role },
                { page, limit, sort: { createdAt: -1 } }
            );

            const sanitizedUsers = users.docs.map(user => this._sanitizeUser(user));

            return this.handleSuccess(
                this.createPaginatedResponse(sanitizedUsers, users.total, page, limit),
                'Users retrieved successfully'
            );
        });
    }

    /**
     * Bulk update users
     */
    async bulkUpdateUsers(userIds, updates, adminId) {
        return this.runInContext('bulkUpdateUsers', async () => {
            const allowedFields = ['status', 'role', 'level'];
            const sanitizedUpdates = {};

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    sanitizedUpdates[field] = updates[field];
                }
            }

            if (Object.keys(sanitizedUpdates).length === 0) {
                throw new Error('No valid updates provided');
            }

            const results = await this.processBatch(
                userIds,
                async (userId) => {
                    try {
                        await this.repo('user').update(userId, sanitizedUpdates);
                        return { userId, success: true };
                    } catch (error) {
                        return { userId, success: false, error: error.message };
                    }
                },
                10
            );

            await this.logActivity(adminId, 'bulk_update', 'user', {
                userIds,
                updates: sanitizedUpdates,
                results,
            });

            const successCount = results.filter(r => r.success).length;

            return this.handleSuccess({
                total: userIds.length,
                successful: successCount,
                failed: userIds.length - successCount,
                results,
            }, `Bulk update completed: ${successCount}/${userIds.length} successful`);
        });
    }

    /**
     * Sanitize user object (remove sensitive fields)
     */
    _sanitizeUser(user) {
        if (!user) return null;

        const sanitized = user.toObject ? user.toObject() : { ...user };
        delete sanitized.password;
        delete sanitized.__v;

        return sanitized;
    }
}
