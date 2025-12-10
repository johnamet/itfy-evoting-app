import BaseRepository from '../BaseRepository.js';
import Notification from '../../models/Notification.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

/**
 * NotificationRepository
 * 
 * Manages notifications with intelligent caching. Notifications are cached with a 10-minute TTL
 * since they can be time-sensitive but don't change frequently once created.
 * 
 * Cache Strategy:
 * - Read operations (findById, findOne, find) are cached automatically
 * - User-specific queries skip cache for real-time unread count accuracy
 * - Mark as read operations invalidate user-specific caches
 * - Bulk operations invalidate all query caches
 * 
 * @extends BaseRepository
 */
class NotificationRepository extends BaseRepository {
    constructor() {
        super(Notification, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 600 // 10 minutes
        });
    }

    /**
     * Create a new notification
     * 
     * @param {Object} notificationData - Notification data
     * @param {string} notificationData.user - User ID to notify
     * @param {string} notificationData.title - Notification title
     * @param {string} notificationData.message - Notification message
     * @param {string} [notificationData.type='info'] - Notification type (info, warning, error, success)
     * @param {Object} [notificationData.metadata] - Additional metadata
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created notification
     */
    async createNotification(notificationData, options = {}) {
        this._validateRequiredFields(notificationData, ['user', 'title', 'message']);

        const notificationToCreate = {
            ...notificationData,
            type: notificationData.type || 'info',
            read: false,
            readAt: null
        };

        return await this.create(notificationToCreate, options);
    }

    /**
     * Find notifications by user ID
     * Skip cache for accurate real-time data
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} User notifications
     */
    async findByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Skip cache for user-specific queries to ensure real-time data
        return await this.find(
            { user: userId },
            {
                ...options,
                skipCache: true,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Find unread notifications for a user
     * Always skip cache for accurate unread count
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Unread notifications
     */
    async findUnreadByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.find(
            { user: userId, read: false },
            {
                ...options,
                skipCache: true,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Count unread notifications for a user
     * Skip cache for accurate count
     * 
     * @param {string} userId - User ID
     * @returns {Promise<number>} Unread notification count
     */
    async countUnreadByUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.count({ user: userId, read: false });
    }

    /**
     * Mark notification as read
     * Invalidates user-specific caches
     * 
     * @param {string} notificationId - Notification ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated notification
     */
    async markAsRead(notificationId, options = {}) {
        if (!notificationId) {
            throw new Error('Notification ID is required');
        }

        return await this.updateById(
            notificationId,
            {
                read: true,
                readAt: new Date()
            },
            options
        );
    }

    /**
     * Mark notification as unread
     * 
     * @param {string} notificationId - Notification ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated notification
     */
    async markAsUnread(notificationId, options = {}) {
        if (!notificationId) {
            throw new Error('Notification ID is required');
        }

        return await this.updateById(
            notificationId,
            {
                read: false,
                readAt: null
            },
            options
        );
    }

    /**
     * Mark all notifications as read for a user
     * Bulk operation invalidates all query caches
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result with modified count
     */
    async markAllAsReadByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const result = await this.updateMany(
            { user: userId, read: false },
            {
                read: true,
                readAt: new Date()
            },
            options
        );

        return result;
    }

    /**
     * Find notifications by type
     * 
     * @param {string} type - Notification type (info, warning, error, success)
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Notifications of specified type
     */
    async findByType(type, options = {}) {
        if (!type) {
            throw new Error('Notification type is required');
        }

        return await this.find(
            { type },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Delete old notifications (cleanup)
     * Useful for maintaining database size
     * 
     * @param {number} daysOld - Delete notifications older than this many days
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result with deleted count
     */
    async deleteOldNotifications(daysOld = 90, options = {}) {
        if (daysOld <= 0) {
            throw new Error('Days must be a positive number');
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.deleteMany(
            { createdAt: { $lt: cutoffDate } },
            options
        );

        return result;
    }

    /**
     * Delete read notifications older than specified days
     * 
     * @param {number} daysOld - Delete read notifications older than this many days
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result with deleted count
     */
    async deleteOldReadNotifications(daysOld = 30, options = {}) {
        if (daysOld <= 0) {
            throw new Error('Days must be a positive number');
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.deleteMany(
            {
                read: true,
                readAt: { $lt: cutoffDate }
            },
            options
        );

        return result;
    }

    /**
     * Get notification statistics for a user
     * Skip cache for accurate real-time stats
     * 
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Notification statistics
     */
    async getUserNotificationStats(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const [totalCount, unreadCount, typeStats] = await Promise.all([
            this.count({ user: userId }),
            this.count({ user: userId, read: false }),
            this.Model.aggregate([
                { $match: { user: this._toObjectId(userId) } },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const typeBreakdown = typeStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        return {
            totalCount,
            unreadCount,
            readCount: totalCount - unreadCount,
            typeBreakdown
        };
    }

    /**
     * Create bulk notifications for multiple users
     * Efficient for sending the same notification to many users
     * 
     * @param {Array<string>} userIds - Array of user IDs
     * @param {Object} notificationData - Base notification data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Array>} Created notifications
     */
    async createBulkNotifications(userIds, notificationData, options = {}) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            throw new Error('User IDs array is required and must not be empty');
        }

        this._validateRequiredFields(notificationData, ['title', 'message']);

        const notifications = userIds.map(userId => ({
            ...notificationData,
            user: userId,
            type: notificationData.type || 'info',
            read: false,
            readAt: null
        }));

        return await this.createMany(notifications, options);
    }

    /**
     * Find recent notifications for a user
     * Returns notifications from the last N days
     * 
     * @param {string} userId - User ID
     * @param {number} [days=7] - Number of days to look back
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Recent notifications
     */
    async findRecentByUser(userId, days = 7, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return await this.find(
            {
                user: userId,
                createdAt: { $gte: startDate }
            },
            {
                ...options,
                skipCache: true,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Delete all notifications for a user
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result with deleted count
     */
    async deleteByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.deleteMany({ user: userId }, options);
    }

    /**
     * Find notifications by metadata field
     * Useful for finding notifications related to specific events or entities
     * 
     * @param {string} key - Metadata key to search
     * @param {*} value - Value to match
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Matching notifications
     */
    async findByMetadata(key, value, options = {}) {
        if (!key) {
            throw new Error('Metadata key is required');
        }

        const query = {};
        query[`metadata.${key}`] = value;

        return await this.find(query, {
            ...options,
            sort: options.sort || { createdAt: -1 }
        });
    }

    /**
     * Get notification delivery stats for a time period
     * 
     * @param {Date} startDate - Start date for stats
     * @param {Date} endDate - End date for stats
     * @returns {Promise<Object>} Notification delivery statistics
     */
    async getDeliveryStats(startDate, endDate) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        const stats = await this.Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: 1 },
                    totalRead: {
                        $sum: { $cond: ['$read', 1, 0] }
                    },
                    typeBreakdown: {
                        $push: '$type'
                    }
                }
            }
        ]);

        if (stats.length === 0) {
            return {
                totalSent: 0,
                totalRead: 0,
                totalUnread: 0,
                readRate: '0%',
                typeBreakdown: {}
            };
        }

        const result = stats[0];
        const typeBreakdown = result.typeBreakdown.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        return {
            totalSent: result.totalSent,
            totalRead: result.totalRead,
            totalUnread: result.totalSent - result.totalRead,
            readRate: `${((result.totalRead / result.totalSent) * 100).toFixed(2)}%`,
            typeBreakdown
        };
    }
}

export default NotificationRepository;
