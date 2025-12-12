import BaseRepository from '../BaseRepository.js';
import Analytics from '../models/Analytics.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

/**
 * AnalyticsRepository
 * 
 * Manages analytics data with intelligent caching. Analytics are cached with a 1-hour TTL
 * since they are aggregated data that doesn't need real-time updates.
 * 
 * Cache Strategy:
 * - Read operations are cached with longer TTL (1 hour)
 * - Aggregation queries are cached for performance
 * - Real-time metrics skip cache
 * - Batch updates invalidate relevant caches
 * 
 * @extends BaseRepository
 */
class AnalyticsRepository extends BaseRepository {
    constructor() {
        super(Analytics, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 3600 // 1 hour
        });
    }

    /**
     * Record an analytics event
     * 
     * @param {Object} analyticsData - Analytics data
     * @param {string} analyticsData.eventType - Type of event (page_view, vote_cast, etc.)
     * @param {string} [analyticsData.user] - User ID
     * @param {string} [analyticsData.event] - Voting event ID
     * @param {Object} [analyticsData.metadata] - Additional data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created analytics record
     */
    async recordEvent(analyticsData, options = {}) {
        this._validateRequiredFields(analyticsData, ['eventType']);

        const analyticsToCreate = {
            ...analyticsData,
            timestamp: new Date()
        };

        return await this.create(analyticsToCreate, options);
    }

    /**
     * Find analytics by event type
     * 
     * @param {string} eventType - Event type
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Analytics records
     */
    async findByEventType(eventType, options = {}) {
        if (!eventType) {
            throw new Error('Event type is required');
        }

        return await this.find(
            { eventType },
            {
                ...options,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Find analytics by user
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} User analytics
     */
    async findByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.find(
            { user: userId },
            {
                ...options,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Find analytics by voting event
     * 
     * @param {string} eventId - Voting event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Event analytics
     */
    async findByVotingEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.find(
            { event: eventId },
            {
                ...options,
                sort: options.sort || { timestamp: -1 }
            }
        );
    }

    /**
     * Find analytics in date range
     * 
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Analytics in range
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
     * Count events by type in date range
     * 
     * @param {string} eventType - Event type
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<number>} Event count
     */
    async countByTypeInRange(eventType, startDate, endDate) {
        if (!eventType || !startDate || !endDate) {
            throw new Error('Event type, start date, and end date are required');
        }

        return await this.count({
            eventType,
            timestamp: {
                $gte: startDate,
                $lte: endDate
            }
        });
    }

    /**
     * Get event type breakdown for a period
     * 
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Event type counts
     */
    async getEventTypeBreakdown(startDate, endDate) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        const breakdown = await this.Model.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        return breakdown.map(item => ({
            eventType: item._id,
            count: item.count
        }));
    }

    /**
     * Get user activity summary
     * 
     * @param {string} userId - User ID
     * @param {Date} [startDate] - Optional start date
     * @param {Date} [endDate] - Optional end date
     * @returns {Promise<Object>} User activity summary
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
                    _id: '$eventType',
                    count: { $sum: 1 },
                    lastActivity: { $max: '$timestamp' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        const totalEvents = summary.reduce((sum, item) => sum + item.count, 0);

        return {
            userId,
            totalEvents,
            eventBreakdown: summary.map(item => ({
                eventType: item._id,
                count: item.count,
                lastActivity: item.lastActivity
            }))
        };
    }

    /**
     * Get voting event analytics
     * 
     * @param {string} eventId - Voting event ID
     * @returns {Promise<Object>} Event analytics summary
     */
    async getVotingEventAnalytics(eventId) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        const analytics = await this.Model.aggregate([
            { $match: { event: this._toObjectId(eventId) } },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$user' }
                }
            }
        ]);

        const totalEvents = analytics.reduce((sum, item) => sum + item.count, 0);
        const uniqueUsersSet = new Set();
        
        analytics.forEach(item => {
            item.uniqueUsers.forEach(user => {
                if (user) uniqueUsersSet.add(user.toString());
            });
        });

        return {
            eventId,
            totalEvents,
            uniqueUsers: uniqueUsersSet.size,
            eventBreakdown: analytics.map(item => ({
                eventType: item._id,
                count: item.count,
                uniqueUsers: item.uniqueUsers.filter(u => u).length
            }))
        };
    }

    /**
     * Get daily activity for a date range
     * 
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Daily activity counts
     */
    async getDailyActivity(startDate, endDate) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        const dailyActivity = await this.Model.aggregate([
            {
                $match: {
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$user' }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1
                }
            }
        ]);

        return dailyActivity.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            count: item.count,
            uniqueUsers: item.uniqueUsers.filter(u => u).length
        }));
    }

    /**
     * Get hourly activity for a specific day
     * 
     * @param {Date} date - Date to analyze
     * @returns {Promise<Array>} Hourly activity counts
     */
    async getHourlyActivity(date) {
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
                $match: { _id: { $ne: null } }
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
     * Delete old analytics records
     * Cleanup for maintaining database size
     * 
     * @param {number} daysOld - Delete records older than this many days
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result
     */
    async deleteOldRecords(daysOld = 180, options = {}) {
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
     * Get overall platform statistics
     * 
     * @param {Date} [startDate] - Optional start date
     * @param {Date} [endDate] - Optional end date
     * @returns {Promise<Object>} Platform statistics
     */
    async getPlatformStats(startDate = null, endDate = null) {
        const matchQuery = {};
        
        if (startDate && endDate) {
            matchQuery.timestamp = {
                $gte: startDate,
                $lte: endDate
            };
        }

        const stats = await this.Model.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalEvents: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$user' },
                    uniqueVotingEvents: { $addToSet: '$event' }
                }
            }
        ]);

        if (stats.length === 0) {
            return {
                totalEvents: 0,
                uniqueUsers: 0,
                uniqueVotingEvents: 0
            };
        }

        const result = stats[0];

        return {
            totalEvents: result.totalEvents,
            uniqueUsers: result.uniqueUsers.filter(u => u).length,
            uniqueVotingEvents: result.uniqueVotingEvents.filter(e => e).length
        };
    }
}

export default AnalyticsRepository;
