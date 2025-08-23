#!/usr/bin/env node
/**
 * Activity Repository
 * 
 * Extends BaseRepository to provide Activity-specific database operations.
 * Includes activity tracking, user activity logs, and audit trail management.
 */

import BaseRepository from './BaseRepository.js';
import Activity from '../models/Activity.js';
import mongoose from 'mongoose';

class ActivityRepository extends BaseRepository {
    
    constructor() {
        // Get the Activity model
        super(Activity);
    }

    /**
     * Log an activity
     * @param {Object} activityData - Activity data
     * @returns {Promise<Object>} Created activity log
     */
    async logActivity(activityData) {
        try {
            // Validate required fields
            await this.validateActivityData(activityData);

            // Add timestamp if not provided
            const activity = {
                ...activityData,
                timestamp: activityData.timestamp || new Date()
            };

            return await this.create(activity);
        } catch (error) {
            throw this._handleError(error, 'logActivity');
        }
    }

    /**
     * Get activities by user
     * @param {String|ObjectId} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} User activities
     */
    async getActivitiesByUser(userId, options = {}) {
        try {
            return await this.find({
                user: userId
            }, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActivitiesByUser');
        }
    }

    /**
     * Get activities by action type
     * @param {String} action - Action type ('create', 'update', 'delete', 'view')
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Activities by action
     */
    async getActivitiesByAction(action, options = {}) {
        try {
            return await this.find({
                action: action
            }, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActivitiesByAction');
        }
    }

    /**
     * Get activities by target type
     * @param {String} targetType - Target type ('user', 'candidate', 'event', 'vote')
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Activities by target type
     */
    async getActivitiesByTargetType(targetType, options = {}) {
        try {
            return await this.find({
                targetType: targetType
            }, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActivitiesByTargetType');
        }
    }

    /**
     * Get activities for a specific target
     * @param {String} targetType - Target type
     * @param {String|ObjectId} targetId - Target ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Activities for target
     */
    async getActivitiesForTarget(targetType, targetId, options = {}) {
        try {
            return await this.find({
                targetType: targetType,
                targetId: targetId
            }, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActivitiesForTarget');
        }
    }

    /**
     * Get activities within date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Activities within date range
     */
    async getActivitiesByDateRange(startDate, endDate, options = {}) {
        try {
            return await this.find({
                timestamp: {
                    $gte: startDate,
                    $lte: endDate
                }
            }, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActivitiesByDateRange');
        }
    }

    /**
     * Get recent activities
     * @param {Number} limit - Number of recent activities to retrieve
     * @param {Object} filter - Additional filter criteria
     * @returns {Promise<Array>} Recent activities
     */
    async getRecentActivities(limit = 50, filter = {}) {
        try {
            return await this.find(filter, {
                limit,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getRecentActivities');
        }
    }

    /**
     * Get activity statistics
     * @param {Object} filter - Filter criteria
     * @returns {Promise<Object>} Activity statistics
     */
    async getActivityStatistics(filter = {}) {
        try {
            const pipeline = [
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalActivities: { $sum: 1 },
                        actionStats: {
                            $push: '$action'
                        },
                        targetTypeStats: {
                            $push: '$targetType'
                        },
                        uniqueUsers: { $addToSet: '$user' },
                        earliestActivity: { $min: '$timestamp' },
                        latestActivity: { $max: '$timestamp' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalActivities: 1,
                        uniqueUsersCount: { $size: '$uniqueUsers' },
                        earliestActivity: 1,
                        latestActivity: 1
                    }
                }
            ];

            // Get action statistics
            const actionPipeline = [
                { $match: filter },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ];

            // Get target type statistics
            const targetTypePipeline = [
                { $match: filter },
                {
                    $group: {
                        _id: '$targetType',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ];

            const [generalStats] = await this.aggregate(pipeline);
            const actionStats = await this.aggregate(actionPipeline);
            const targetTypeStats = await this.aggregate(targetTypePipeline);

            return {
                ...(generalStats || {
                    totalActivities: 0,
                    uniqueUsersCount: 0,
                    earliestActivity: null,
                    latestActivity: null
                }),
                actionBreakdown: actionStats,
                targetTypeBreakdown: targetTypeStats
            };
        } catch (error) {
            throw this._handleError(error, 'getActivityStatistics');
        }
    }

    /**
     * Get user activity summary
     * @param {String|ObjectId} userId - User ID
     * @param {Object} filter - Additional filter criteria
     * @returns {Promise<Object>} User activity summary
     */
    async getUserActivitySummary(userId, filter = {}) {
        try {
            const pipeline = [
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        ...filter
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalActivities: { $sum: 1 },
                        actionBreakdown: {
                            $push: '$action'
                        },
                        targetTypeBreakdown: {
                            $push: '$targetType'
                        },
                        firstActivity: { $min: '$timestamp' },
                        lastActivity: { $max: '$timestamp' }
                    }
                }
            ];

            // Get detailed breakdowns
            const actionBreakdownPipeline = [
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        ...filter
                    }
                },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ];

            const targetTypeBreakdownPipeline = [
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        ...filter
                    }
                },
                {
                    $group: {
                        _id: '$targetType',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ];

            const [summary] = await this.aggregate(pipeline);
            const actionBreakdown = await this.aggregate(actionBreakdownPipeline);
            const targetTypeBreakdown = await this.aggregate(targetTypeBreakdownPipeline);

            return {
                userId,
                ...(summary || {
                    totalActivities: 0,
                    firstActivity: null,
                    lastActivity: null
                }),
                actionBreakdown,
                targetTypeBreakdown
            };
        } catch (error) {
            throw this._handleError(error, 'getUserActivitySummary');
        }
    }

    /**
     * Get activities with pagination
     * @param {Number} page - Page number (1-based)
     * @param {Number} limit - Items per page
     * @param {Object} filter - Filter criteria
     * @returns {Promise<Object>} Paginated activities
     */
    async getActivitiesWithPagination(page = 1, limit = 20, filter = {}) {
        try {
            const skip = (page - 1) * limit;
            
            const activities = await this.find(filter, {
                skip,
                limit,
                populate: [
                    { path: 'user', select: 'name email' }
                ],
                sort: { timestamp: -1 }
            });

            const total = await this.countDocuments(filter);
            const totalPages = Math.ceil(total / limit);

            return {
                activities,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw this._handleError(error, 'getActivitiesWithPagination');
        }
    }

    /**
     * Delete old activities
     * @param {Date} olderThan - Delete activities older than this date
     * @returns {Promise<Object>} Deletion result
     */
    async deleteOldActivities(olderThan) {
        try {
            const result = await this.deleteMany({
                timestamp: { $lt: olderThan }
            });

            return {
                deletedCount: result.deletedCount,
                deletedBefore: olderThan
            };
        } catch (error) {
            throw this._handleError(error, 'deleteOldActivities');
        }
    }

    /**
     * Get activity timeline for a user
     * @param {String|ObjectId} userId - User ID
     * @param {Number} days - Number of days to look back
     * @returns {Promise<Array>} Activity timeline
     */
    async getUserActivityTimeline(userId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const pipeline = [
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        timestamp: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            date: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$timestamp'
                                }
                            }
                        },
                        activities: {
                            $push: {
                                action: '$action',
                                targetType: '$targetType',
                                targetId: '$targetId',
                                timestamp: '$timestamp'
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id.date': -1 }
                },
                {
                    $project: {
                        _id: 0,
                        date: '$_id.date',
                        activities: 1,
                        count: 1
                    }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getUserActivityTimeline');
        }
    }

    /**
     * Validate activity data
     * @param {Object} activityData - Activity data to validate
     * @returns {Promise<Boolean>} True if valid
     */
    async validateActivityData(activityData) {
        try {
            const errors = [];

            // Validate user (optional for site visits)
            if (!activityData.user && activityData.action !== 'site_visit') {
                errors.push('User ID is required for non-site-visit activities');
            }

            // Validate action
            const validActions = ['create', 'update', 'delete', 'view', 'site_visit', 'end', 'cancel', 'publish', 'start'];
            if (!activityData.action || !validActions.includes(activityData.action)) {
                errors.push(`Action must be one of: ${validActions.join(', ')}`);
            }

            // Validate targetType
            const validTargetTypes = ['user', 'candidate', 'event', 'vote', 'site'];
            if (!activityData.targetType || !validTargetTypes.includes(activityData.targetType)) {
                errors.push(`Target type must be one of: ${validTargetTypes.join(', ')}`);
            }

            // Validate targetId
            if (!activityData.targetId) {
                errors.push('Target ID is required');
            }

            // Validate timestamp (if provided)
            if (activityData.timestamp && !(activityData.timestamp instanceof Date)) {
                errors.push('Timestamp must be a valid Date object');
            }

            // Validate siteVisits structure (if provided)
            if (activityData.siteVisits) {
                if (typeof activityData.siteVisits !== 'object') {
                    errors.push('Site visits data must be an object');
                }
                
                if (activityData.siteVisits.totalVisits && typeof activityData.siteVisits.totalVisits !== 'number') {
                    errors.push('Total visits must be a number');
                }
            }

            if (errors.length > 0) {
                throw new Error(`Validation errors: ${errors.join(', ')}`);
            }

            return true;
        } catch (error) {
            throw this._handleError(error, 'validateActivityData');
        }
    }

    /**
     * Bulk log activities
     * @param {Array} activitiesData - Array of activity data
     * @returns {Promise<Object>} Bulk creation results
     */
    async bulkLogActivities(activitiesData) {
        try {
            const createdActivities = [];
            const errors = [];

            for (const activityData of activitiesData) {
                try {
                    const activity = await this.logActivity(activityData);
                    createdActivities.push(activity);
                } catch (error) {
                    errors.push({
                        activityData,
                        error: error.message
                    });
                }
            }

            return {
                success: createdActivities,
                errors: errors,
                successCount: createdActivities.length,
                errorCount: errors.length
            };
        } catch (error) {
            throw this._handleError(error, 'bulkLogActivities');
        }
    }

    /**
     * Get most active users
     * @param {Number} limit - Number of users to return
     * @param {Object} filter - Additional filter criteria
     * @returns {Promise<Array>} Most active users
     */
    async getMostActiveUsers(limit = 10, filter = {}) {
        try {
            const pipeline = [
                { $match: filter },
                {
                    $group: {
                        _id: '$user',
                        activityCount: { $sum: 1 },
                        lastActivity: { $max: '$timestamp' },
                        actions: { $addToSet: '$action' }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'userInfo'
                    }
                },
                {
                    $addFields: {
                        user: { $arrayElemAt: ['$userInfo', 0] }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        userId: '$_id',
                        user: { name: 1, email: 1 },
                        activityCount: 1,
                        lastActivity: 1,
                        uniqueActions: { $size: '$actions' }
                    }
                },
                { $sort: { activityCount: -1 } },
                { $limit: limit }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getMostActiveUsers');
        }
    }

    /**
     * Track site visits efficiently by updating a single document
     * @param {String|ObjectId} userId - User ID (optional, null for anonymous visits)
     * @param {String} page - Page visited (optional, default 'homepage')
     * @param {Object} metadata - Additional metadata (IP, user agent, etc.)
     * @returns {Promise<Object>} Site visit tracking result
     */
    async trackSiteVisit(userId = null, page = 'homepage', metadata = {}) {
        try {
            const today = new Date();
            const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            const hour = today.getHours();
            
            // // Create unique identifier for the site visit document
            // const siteVisitId = `site_visit_${dateKey}`;
            
            // Find or create the site visit document for today
            const updateQuery = {
                action: 'site_visit',
                targetType: 'site',
                // targetId: siteVisitId,
                user: null // Site visits are tracked separately from user activities
            };

            const siteVisitData = {
                timestamp: today,
                siteVisits: {
                    date: dateKey,
                    totalVisits: 1,
                    pages: {
                        [page]: 1
                    },
                    hourly: {
                        [hour]: 1
                    },
                    users: userId ? [userId] : [],
                    anonymousVisits: userId ? 0 : 1,
                    lastUpdated: today,
                    metadata: metadata ? [metadata] : []
                }
            };

            // Try to update existing document, or create new one
            // const existingDoc = await this.model.findOne(updateQuery);

            const existingDoc = await this.model.findOne({action: 'site_visit'})
            
            if (existingDoc) {
                existingDoc.targetId = existingDoc._id
                // Update existing site visit document
                const updateData = {
                    $inc: {
                        'siteVisits.totalVisits': 1,
                        [`siteVisits.pages.${page}`]: 1,
                        [`siteVisits.hourly.${hour}`]: 1
                    },
                    $set: {
                        'siteVisits.lastUpdated': today,
                        timestamp: today
                    }
                };

                // Add user to users array if not anonymous and not already present
                if (userId) {
                    updateData.$addToSet = { 'siteVisits.users': userId };
                } else {
                    updateData.$inc['siteVisits.anonymousVisits'] = 1;
                }

                // Add metadata if provided
                if (metadata && Object.keys(metadata).length > 0) {
                    updateData.$push = { 'siteVisits.metadata': metadata };
                }

                const updated = await this.model.findOneAndUpdate(
                    updateQuery,
                    updateData,
                    { new: true, upsert: false }
                );

                return {
                    success: true,
                    isUpdate: true,
                    siteVisitData: updated.siteVisits,
                    documentId: updated._id
                };
            } else {
                // Create new site visit document
                const newSiteVisit = await this.model.create({
                    ...updateQuery,
                    ...siteVisitData
                });

                return {
                    success: true,
                    isUpdate: false,
                    siteVisitData: newSiteVisit.siteVisits,
                    documentId: newSiteVisit._id
                };
            }
        } catch (error) {
            throw this._handleError(error, 'trackSiteVisit');
        }
    }

    /**
     * Get site visit statistics
     * @param {String} dateRange - Date range ('today', 'week', 'month', 'year')
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Site visit statistics
     */
    async getSiteVisitStatistics(dateRange = 'today', options = {}) {
        try {
            let startDate, endDate;
            const now = new Date();

            switch (dateRange) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    endDate = now;
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear() + 1, 0, 0);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
            }

            const pipeline = [
                {
                    $match: {
                        action: 'site_visit',
                        targetType: 'site',
                        timestamp: {
                            $gte: startDate,
                            $lt: endDate
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalVisits: { $sum: '$siteVisits.totalVisits' },
                        totalUniqueUsers: { $sum: { $size: '$siteVisits.users' } },
                        totalAnonymousVisits: { $sum: '$siteVisits.anonymousVisits' },
                        pageVisits: { $push: '$siteVisits.pages' },
                        hourlyVisits: { $push: '$siteVisits.hourly' },
                        dates: { $push: '$siteVisits.date' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalVisits: 1,
                        totalUniqueUsers: 1,
                        totalAnonymousVisits: 1,
                        dateRange: {
                            from: startDate,
                            to: endDate,
                            period: dateRange
                        }
                    }
                }
            ];

            const [statistics] = await this.aggregate(pipeline);

            // Get page statistics separately
            const pageStatsPipeline = [
                {
                    $match: {
                        action: 'site_visit',
                        targetType: 'site',
                        timestamp: {
                            $gte: startDate,
                            $lt: endDate
                        }
                    }
                },
                {
                    $project: {
                        pages: { $objectToArray: '$siteVisits.pages' }
                    }
                },
                { $unwind: '$pages' },
                {
                    $group: {
                        _id: '$pages.k',
                        visits: { $sum: '$pages.v' }
                    }
                },
                { $sort: { visits: -1 } }
            ];

            const pageStats = await this.aggregate(pageStatsPipeline);

            return {
                ...(statistics || {
                    totalVisits: 0,
                    totalUniqueUsers: 0,
                    totalAnonymousVisits: 0,
                    dateRange: {
                        from: startDate,
                        to: endDate,
                        period: dateRange
                    }
                }),
                pageBreakdown: pageStats.map(stat => ({
                    page: stat._id,
                    visits: stat.visits
                }))
            };
        } catch (error) {
            throw this._handleError(error, 'getSiteVisitStatistics');
        }
    }

    /**
     * Get hourly visit patterns
     * @param {Date} date - Specific date (optional, defaults to today)
     * @returns {Promise<Array>} Hourly visit pattern
     */
    async getHourlyVisitPattern(date = null) {
        try {
            const targetDate = date || new Date();
            const dateKey = targetDate.toISOString().split('T')[0];

            const siteVisit = await this.model.findOne({
                action: 'site_visit',
                targetType: 'site',
                'siteVisits.date': dateKey
            });

            if (!siteVisit) {
                return Array.from({ length: 24 }, (_, hour) => ({
                    hour,
                    visits: 0
                }));
            }

            const hourlyData = siteVisit.siteVisits.hourly || {};
            
            return Array.from({ length: 24 }, (_, hour) => ({
                hour,
                visits: hourlyData[hour] || 0
            }));
        } catch (error) {
            throw this._handleError(error, 'getHourlyVisitPattern');
        }
    }

    /**
     * Clean up old site visit metadata to prevent document bloat
     * @param {Number} maxMetadataEntries - Maximum metadata entries to keep per document
     * @returns {Promise<Object>} Cleanup result
     */
    async cleanupSiteVisitMetadata(maxMetadataEntries = 100) {
        try {
            const siteVisitDocs = await this.model.find({
                action: 'site_visit',
                targetType: 'site',
                'siteVisits.metadata': { $exists: true }
            });

            let cleanedCount = 0;

            for (const doc of siteVisitDocs) {
                if (doc.siteVisits.metadata && doc.siteVisits.metadata.length > maxMetadataEntries) {
                    // Keep only the most recent metadata entries
                    const recentMetadata = doc.siteVisits.metadata.slice(-maxMetadataEntries);
                    
                    await this.model.updateOne(
                        { _id: doc._id },
                        { $set: { 'siteVisits.metadata': recentMetadata } }
                    );
                    
                    cleanedCount++;
                }
            }

            return {
                cleanedDocuments: cleanedCount,
                maxMetadataEntries
            };
        } catch (error) {
            throw this._handleError(error, 'cleanupSiteVisitMetadata');
        }
    }
}

export default ActivityRepository;
