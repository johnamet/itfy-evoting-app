#!/usr/bin/env node
/**
 * Activity Service
 * 
 * Handles activity logging, tracking, and reporting for audit trails
 * and user activity monitoring.
 */

import BaseService from './BaseService.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import CacheService from './CacheService.js';

class ActivityService extends BaseService {
    constructor() {
        super();
        this.activityRepository = new ActivityRepository();
        this.userRepository = new UserRepository();
    }

    /**
     * Log an activity
     * @param {Object} activityData - Activity data
     * @returns {Promise<Object>} Logged activity
     */
    async logActivity(activityData) {
        try {
            this._log('log_activity', { 
                user: activityData.user, 
                action: activityData.action,
                targetType: activityData.targetType 
            });

            // Validate required fields
            this._validateRequiredFields(activityData, ['user', 'action']);
            this._validateObjectId(activityData.user, 'User ID');

            // Verify user exists
            const user = await this.userRepository.findById(activityData.user);
            if (!user) {
                throw new Error('User not found');
            }

            // Validate target ID if provided
            if (activityData.targetId) {
                this._validateObjectId(activityData.targetId, 'Target ID');
            }

            // Create activity log entry
            const activityToCreate = {
                user: activityData.user,
                action: activityData.action,
                targetType: activityData.targetType || null,
                targetId: activityData.targetId || null,
                metadata: activityData.metadata || {},
                ipAddress: activityData.ipAddress || null,
                userAgent: activityData.userAgent || null,
                timestamp: new Date()
            };

            const activity = await this.activityRepository.create(activityToCreate);

            // Update activity counter in cache
            CacheService.incrementCounter(`activities:${activityData.action}`, 1);
            CacheService.incrementCounter(`user_activities:${activityData.user}`, 1);

            this._log('log_activity_success', { activityId: activity._id });

            return {
                success: true,
                activity: {
                    id: activity._id,
                    user: activity.user,
                    action: activity.action,
                    targetType: activity.targetType,
                    targetId: activity.targetId,
                    timestamp: activity.timestamp
                }
            };
        } catch (error) {
            throw this._handleError(error, 'log_activity', { action: activityData.action });
        }
    }

    /**
     * Get activities with filtering and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Paginated activities
     */
    async getActivities(query = {}) {
        try {
            this._log('get_activities', { query });

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                100
            );

            // Create filter based on query
            const filter = {};

            // User filter
            if (query.userId) {
                this._validateObjectId(query.userId, 'User ID');
                filter.user = query.userId;
            }

            // Action filter
            if (query.action) {
                filter.action = query.action;
            }

            // Target type filter
            if (query.targetType) {
                filter.targetType = query.targetType;
            }

            // Target ID filter
            if (query.targetId) {
                this._validateObjectId(query.targetId, 'Target ID');
                filter.targetId = query.targetId;
            }

            // Date range filter
            if (query.startDate || query.endDate) {
                filter.timestamp = {};
                if (query.startDate) {
                    filter.timestamp.$gte = new Date(query.startDate);
                }
                if (query.endDate) {
                    filter.timestamp.$lte = new Date(query.endDate);
                }
            }

            const activities = await this.activityRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { timestamp: -1 },
                populate: [
                    { path: 'user', select: 'username email profile.firstName profile.lastName' }
                ]
            });

            // Get total count for pagination
            const total = await this.activityRepository.countDocuments(filter);

            // Format activities
            const formattedActivities = activities.map(activity => ({
                id: activity._id,
                user: {
                    id: activity.user._id,
                    username: activity.user.username,
                    email: activity.user.email,
                    name: activity.user.profile ? 
                        `${activity.user.profile.firstName} ${activity.user.profile.lastName}`.trim() 
                        : activity.user.username
                },
                action: activity.action,
                targetType: activity.targetType,
                targetId: activity.targetId,
                metadata: activity.metadata,
                ipAddress: activity.ipAddress,
                timestamp: activity.timestamp
            }));

            return {
                success: true,
                data: this._formatPaginationResponse(formattedActivities, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_activities', { query });
        }
    }

    /**
     * Get user activities
     * @param {String} userId - User ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} User activities
     */
    async getUserActivities(userId, query = {}) {
        try {
            this._log('get_user_activities', { userId, query });

            this._validateObjectId(userId, 'User ID');

            // Add user filter to query
            const userQuery = { ...query, userId };

            return await this.getActivities(userQuery);
        } catch (error) {
            throw this._handleError(error, 'get_user_activities', { userId });
        }
    }

    /**
     * Get activities for a specific target
     * @param {String} targetType - Target type
     * @param {String} targetId - Target ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Target activities
     */
    async getTargetActivities(targetType, targetId, query = {}) {
        try {
            this._log('get_target_activities', { targetType, targetId, query });

            this._validateObjectId(targetId, 'Target ID');

            // Add target filters to query
            const targetQuery = { ...query, targetType, targetId };

            return await this.getActivities(targetQuery);
        } catch (error) {
            throw this._handleError(error, 'get_target_activities', { targetType, targetId });
        }
    }

    /**
     * Get activity statistics
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Activity statistics
     */
    async getActivityStats(query = {}) {
        try {
            this._log('get_activity_stats', { query });

            // Date range filter
            const dateFilter = {};
            if (query.startDate || query.endDate) {
                dateFilter.timestamp = {};
                if (query.startDate) {
                    dateFilter.timestamp.$gte = new Date(query.startDate);
                }
                if (query.endDate) {
                    dateFilter.timestamp.$lte = new Date(query.endDate);
                }
            }

            // Get activity counts by action
            const actionStats = await this.activityRepository.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Get activity counts by target type
            const targetTypeStats = await this.activityRepository.aggregate([
                { $match: { ...dateFilter, targetType: { $exists: true } } },
                { $group: { _id: '$targetType', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Get daily activity counts
            const dailyStats = await this.activityRepository.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: {
                            year: { $year: '$timestamp' },
                            month: { $month: '$timestamp' },
                            day: { $dayOfMonth: '$timestamp' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
                { $limit: 30 }
            ]);

            // Get most active users
            const userStats = await this.activityRepository.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$user', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'userInfo'
                    }
                },
                {
                    $project: {
                        userId: '$_id',
                        count: 1,
                        username: { $arrayElemAt: ['$userInfo.username', 0] },
                        email: { $arrayElemAt: ['$userInfo.email', 0] }
                    }
                }
            ]);

            // Get total activities count
            const totalActivities = await this.activityRepository.countDocuments(dateFilter);

            return {
                success: true,
                data: {
                    totalActivities,
                    actionBreakdown: actionStats.map(stat => ({
                        action: stat._id,
                        count: stat.count
                    })),
                    targetTypeBreakdown: targetTypeStats.map(stat => ({
                        targetType: stat._id,
                        count: stat.count
                    })),
                    dailyActivities: dailyStats.map(stat => ({
                        date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
                        count: stat.count
                    })),
                    mostActiveUsers: userStats.map(stat => ({
                        userId: stat.userId,
                        username: stat.username,
                        email: stat.email,
                        activityCount: stat.count
                    }))
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_activity_stats', { query });
        }
    }

    /**
     * Get recent activities
     * @param {Number} limit - Number of recent activities to fetch
     * @returns {Promise<Object>} Recent activities
     */
    async getRecentActivities(limit = 50) {
        try {
            this._log('get_recent_activities', { limit });

            const activities = await this.activityRepository.find({}, {
                limit: Math.min(limit, 100), // Cap at 100
                sort: { timestamp: -1 },
                populate: [
                    { path: 'user', select: 'username email profile.firstName profile.lastName' }
                ]
            });

            // Format activities
            const formattedActivities = activities.map(activity => ({
                id: activity._id,
                user: {
                    id: activity.user._id,
                    username: activity.user.username,
                    name: activity.user.profile ? 
                        `${activity.user.profile.firstName} ${activity.user.profile.lastName}`.trim() 
                        : activity.user.username
                },
                action: activity.action,
                targetType: activity.targetType,
                targetId: activity.targetId,
                metadata: activity.metadata,
                timestamp: activity.timestamp
            }));

            return {
                success: true,
                data: formattedActivities
            };
        } catch (error) {
            throw this._handleError(error, 'get_recent_activities', { limit });
        }
    }

    /**
     * Search activities by text
     * @param {String} searchText - Text to search for
     * @param {Object} query - Additional query parameters
     * @returns {Promise<Object>} Search results
     */
    async searchActivities(searchText, query = {}) {
        try {
            this._log('search_activities', { searchText, query });

            if (!searchText || searchText.trim().length === 0) {
                throw new Error('Search text is required');
            }

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Create search filter
            const filter = {
                $or: [
                    { action: { $regex: searchText, $options: 'i' } },
                    { targetType: { $regex: searchText, $options: 'i' } },
                    { 'metadata.eventName': { $regex: searchText, $options: 'i' } },
                    { 'metadata.candidateName': { $regex: searchText, $options: 'i' } },
                    { 'metadata.categoryName': { $regex: searchText, $options: 'i' } }
                ]
            };

            // Add additional filters
            if (query.userId) {
                this._validateObjectId(query.userId, 'User ID');
                filter.user = query.userId;
            }

            if (query.action) {
                filter.action = query.action;
            }

            if (query.startDate || query.endDate) {
                filter.timestamp = {};
                if (query.startDate) {
                    filter.timestamp.$gte = new Date(query.startDate);
                }
                if (query.endDate) {
                    filter.timestamp.$lte = new Date(query.endDate);
                }
            }

            const activities = await this.activityRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { timestamp: -1 },
                populate: [
                    { path: 'user', select: 'username email profile.firstName profile.lastName' }
                ]
            });

            // Get total count for pagination
            const total = await this.activityRepository.countDocuments(filter);

            // Format activities
            const formattedActivities = activities.map(activity => ({
                id: activity._id,
                user: {
                    id: activity.user._id,
                    username: activity.user.username,
                    email: activity.user.email,
                    name: activity.user.profile ? 
                        `${activity.user.profile.firstName} ${activity.user.profile.lastName}`.trim() 
                        : activity.user.username
                },
                action: activity.action,
                targetType: activity.targetType,
                targetId: activity.targetId,
                metadata: activity.metadata,
                timestamp: activity.timestamp
            }));

            return {
                success: true,
                data: this._formatPaginationResponse(formattedActivities, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'search_activities', { searchText });
        }
    }

    /**
     * Delete old activities (cleanup)
     * @param {Number} daysOld - Delete activities older than this many days
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupOldActivities(daysOld = 90) {
        try {
            this._log('cleanup_old_activities', { daysOld });

            if (daysOld < 30) {
                throw new Error('Cannot delete activities less than 30 days old');
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const filter = { timestamp: { $lt: cutoffDate } };

            // Count activities to be deleted
            const countToDelete = await this.activityRepository.countDocuments(filter);

            // Delete old activities
            const deleteResult = await this.activityRepository.deleteMany(filter);

            this._log('cleanup_old_activities_success', { 
                daysOld, 
                deleted: deleteResult.deletedCount 
            });

            return {
                success: true,
                data: {
                    daysOld,
                    cutoffDate,
                    activitiesFound: countToDelete,
                    activitiesDeleted: deleteResult.deletedCount
                },
                message: `Deleted ${deleteResult.deletedCount} activities older than ${daysOld} days`
            };
        } catch (error) {
            throw this._handleError(error, 'cleanup_old_activities', { daysOld });
        }
    }
}

export default ActivityService;
