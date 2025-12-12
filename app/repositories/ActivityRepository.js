import BaseRepository from '../BaseRepository.js';
import Activity from '../models/Activity.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

/**
 * ActivityRepository
 * 
 * Manages user activity tracking with intelligent caching. Activities are cached with a 10-minute TTL
 * for recent activity queries while individual lookups are cached longer.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - User-specific queries skip cache for real-time activity tracking
 * - Recent activity queries have shorter TTL
 * - Audit trail queries are cached for performance
 * 
 * @extends BaseRepository
 */
class ActivityRepository extends BaseRepository {
    constructor() {
        super(Activity, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 600 // 10 minutes
        });
    }

    /**
     * Log an activity
     * 
     * @param {Object} activityData - Activity data
     * @param {string} activityData.user - User ID
     * @param {string} activityData.action - Action performed
     * @param {string} [activityData.resource] - Resource type (event, user, vote, etc.)
     * @param {string} [activityData.resourceId] - Resource ID
     * @param {Object} [activityData.metadata] - Additional activity data
     * @param {string} [activityData.ipAddress] - User's IP address
     * @param {string} [activityData.userAgent] - User's browser/client info
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created activity
     */
    async logActivity(activityData, options = {}) {
        this._validateRequiredFields(activityData, ['user', 'action']);

        const activityToCreate = {
            ...activityData,
            timestamp: new Date()
        };

        return await this.create(activityToCreate, options);
    }

    /**
     * Find activities by user
     * Skip cache for real-time activity tracking
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} User activities
     */
    async findByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.find(
            { user: userId },
            {
                ...options,
                skipCache: true,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Find activities by action
     * 
     * @param {string} action - Action type
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Activities
     */
    async findByAction(action, options = {}) {
        if (!action) {
            throw new Error('Action is required');
        }

        return await this.find(
            { action },
            {
                ...options,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Find activities by resource
     * 
     * @param {string} resource - Resource type
     * @param {string} [resourceId] - Optional resource ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Activities
     */
    async findByResource(resource, resourceId = null, options = {}) {
        if (!resource) {
            throw new Error('Resource is required');
        }

        const query = { resource };
        if (resourceId) {
            query.resourceId = resourceId;
        }

        return await this.find(query, {
            ...options,
            sort: options.sort || { timestamp: -1 }
        });
    }

    /**
     * Find recent activities
     * Get activities from the last N hours
     * 
     * @param {number} [hours=24] - Number of hours to look back
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Recent activities
     */
    async findRecent(hours = 24, options = {}) {
        const since = new Date();
        since.setHours(since.getHours() - hours);

        return await this.find(
            { timestamp: { $gte: since } },
            {
                ...options,
                skipCache: true, // Recent activities should be fresh
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Find activities in date range
     * 
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Activities in range
     */
    async findByDateRange(startDate, endDate, options = {}) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        return await this.find(
            {
                timestamp: {
                    $gte: startDate,
                    $lte: endDate
                }
            },
            {
                ...options,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Get user activity summary
     * 
     * @param {string} userId - User ID
     * @param {Date} [startDate] - Optional start date
     * @param {Date} [endDate] - Optional end date
     * @returns {Promise<Object>} Activity summary
     */
    async getUserActivitySummary(userId, startDate = null, endDate = null) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const matchQuery = { user: this._toObjectId(userId) };
        
        if (startDate && endDate) {
            matchQuery.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const summary = await this.Model.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 },
                    lastActivity: { $max: '$timestamp' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const totalActivities = summary.reduce((sum, item) => sum + item.count, 0);

        return {
            userId,
            totalActivities,
            actionBreakdown: summary.map(item => ({
                action: item._id,
                count: item.count,
                lastActivity: item.lastActivity
            }))
        };
    }

    /**
     * Get most active users
     * 
     * @param {Date} [startDate] - Optional start date
     * @param {Date} [endDate] - Optional end date
     * @param {number} [limit=10] - Number of users to return
     * @returns {Promise<Array>} Most active users
     */
    async getMostActiveUsers(startDate = null, endDate = null, limit = 10) {
        const matchQuery = {};
        
        if (startDate && endDate) {
            matchQuery.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const activeUsers = await this.Model.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$user',
                    activityCount: { $sum: 1 },
                    lastActivity: { $max: '$timestamp' }
                }
            },
            {
                $sort: { activityCount: -1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: {
                    path: '$userDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    userId: '$_id',
                    userName: '$userDetails.name',
                    userEmail: '$userDetails.email',
                    activityCount: 1,
                    lastActivity: 1
                }
            }
        ]);

        return activeUsers;
    }

    /**
     * Get action frequency
     * Count how many times each action has been performed
     * 
     * @param {Date} [startDate] - Optional start date
     * @param {Date} [endDate] - Optional end date
     * @returns {Promise<Array>} Action frequency list
     */
    async getActionFrequency(startDate = null, endDate = null) {
        const matchQuery = {};
        
        if (startDate && endDate) {
            matchQuery.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const frequency = await this.Model.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$action',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        return frequency.map(item => ({
            action: item._id,
            count: item.count
        }));
    }

    /**
     * Get activities by IP address
     * Useful for security audits
     * 
     * @param {string} ipAddress - IP address
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Activities from IP
     */
    async findByIpAddress(ipAddress, options = {}) {
        if (!ipAddress) {
            throw new Error('IP address is required');
        }

        return await this.find(
            { ipAddress },
            {
                ...options,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Get audit trail for a resource
     * Complete history of actions on a specific resource
     * 
     * @param {string} resource - Resource type
     * @param {string} resourceId - Resource ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Audit trail
     */
    async getAuditTrail(resource, resourceId, options = {}) {
        if (!resource || !resourceId) {
            throw new Error('Resource and resource ID are required');
        }

        return await this.find(
            { resource, resourceId },
            {
                ...options,
                sort: options.sort || { timestamp: 1 } // Chronological order for audit
            }
        );
    }

    /**
     * Delete old activities
     * Cleanup for maintaining database size
     * 
     * @param {number} daysOld - Delete activities older than this many days
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result
     */
    async deleteOldActivities(daysOld = 180, options = {}) {
        if (daysOld <= 0) {
            throw new Error('Days must be a positive number');
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        return await this.deleteMany(
            { timestamp: { $lt: cutoffDate } },
            options
        );
    }

    /**
     * Count activities by user
     * 
     * @param {string} userId - User ID
     * @param {Date} [startDate] - Optional start date
     * @param {Date} [endDate] - Optional end date
     * @returns {Promise<number>} Activity count
     */
    async countByUser(userId, startDate = null, endDate = null) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const query = { user: userId };
        
        if (startDate && endDate) {
            query.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
        }

        return await this.count(query);
    }

    /**
     * Get hourly activity distribution
     * 
     * @param {Date} date - Date to analyze
     * @returns {Promise<Array>} Hourly activity counts
     */
    async getHourlyDistribution(date) {
        if (!date) {
            throw new Error('Date is required');
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const hourlyActivity = await this.Model.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                }
            },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Fill in missing hours with 0
        const result = Array.from({ length: 24 }, (_, hour) => {
            const found = hourlyActivity.find(item => item._id === hour);
            return {
                hour,
                count: found ? found.count : 0
            };
        });

        return result;
    }

    /**
     * Search activities by metadata
     * 
     * @param {string} key - Metadata key
     * @param {*} value - Value to match
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Matching activities
     */
    async searchByMetadata(key, value, options = {}) {
        if (!key) {
            throw new Error('Metadata key is required');
        }

        const query = {};
        query[`metadata.${key}`] = value;

        return await this.find(query, {
            ...options,
            sort: options.sort || { timestamp: -1 }
        });
    }
}

export default ActivityRepository;
