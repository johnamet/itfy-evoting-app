#!/usr/bin/env node
/**
 * Analytics Service
 * 
 * Handles business logic for analytics data processing and computation.
 * Provides methods for generating various types of analytics and dashboard stats.
 */

import BaseService from './BaseService.js';
import AnalyticsRepository from '../repositories/AnalyticsRepository.js';
import CacheService from './CacheService.js';

class AnalyticsService extends BaseService {
    constructor() {
        super();
        this.repository = new AnalyticsRepository();
        this.cachePrefix = 'analytics:';
        this.defaultCacheTTL = 3600000; // 1 hour in milliseconds (cache service expects milliseconds)
    }

    /**
     * Get dashboard overview statistics
     * @returns {Promise<Object>}
     */
    async getDashboardOverview() {
        try {
            const cacheKey = `${this.cachePrefix}dashboard:overview`;
            
            // Try to get from cache first
            let overview = CacheService.get(cacheKey);
            if (overview) {
                return {
                    success: true,
                    data: overview,
                    cached: true
                };
            }

            // Get from repository
            overview = await this.repository.getDashboardOverview();
            
            // Cache the result
            CacheService.set(cacheKey, overview, this.defaultCacheTTL);

            return {
                success: true,
                data: overview,
                cached: false
            };

        } catch (error) {
            console.error('Error getting dashboard overview:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get voting analytics
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getVotingAnalytics(options = {}) {
        try {
            const {
                period = 'daily',
                eventId = null,
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = options;

            const cacheKey = `${this.cachePrefix}voting:${period}:${eventId || 'all'}`;
            
            // Try cache first unless force refresh
            if (!forceRefresh) {
                const cached = CacheService.get(cacheKey);
                if (cached) {
                    return {
                        success: true,
                        data: cached,
                        cached: true
                    };
                }
            }

            // Get or create analytics
            const references = eventId ? { event: eventId } : {};
            let analytics = await this.repository.findFreshOrCreate('voting', period, references);

            // If analytics is computing or expired, compute fresh data
            if (analytics.status === 'computing' || analytics.isExpired) {
                const computeStartDate = startDate || this.getDateRangeForPeriod(period).start;
                const computeEndDate = endDate || this.getDateRangeForPeriod(period).end;

                const analyticsData = await this.repository.computeVotingAnalytics(
                    computeStartDate,
                    computeEndDate,
                    eventId
                );

                // Update the analytics record
                Object.assign(analytics, analyticsData);
                await analytics.markCompleted(analyticsData.metadata.computationTime);
            }

            // Cache the result
            CacheService.set(cacheKey, analytics.data.voting, this.defaultCacheTTL);

            return {
                success: true,
                data: analytics.data.voting,
                metadata: analytics.metadata,
                cached: false
            };

        } catch (error) {
            console.error('Error getting voting analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get payment analytics
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getPaymentAnalytics(options = {}) {
        try {
            const {
                period = 'daily',
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = options;

            const cacheKey = `${this.cachePrefix}payments:${period}`;
            
            // Try cache first unless force refresh
            if (!forceRefresh) {
                const cached = CacheService.get(cacheKey);
                if (cached) {
                    return {
                        success: true,
                        data: cached,
                        cached: true
                    };
                }
            }

            // Get or create analytics
            let analytics = await this.repository.findFreshOrCreate('payments', period);

            // If analytics is computing or expired, compute fresh data
            if (analytics.status === 'computing' || analytics.isExpired) {
                const computeStartDate = startDate || this.getDateRangeForPeriod(period).start;
                const computeEndDate = endDate || this.getDateRangeForPeriod(period).end;

                const analyticsData = await this.repository.computePaymentAnalytics(
                    computeStartDate,
                    computeEndDate
                );

                // Update the analytics record
                Object.assign(analytics, analyticsData);
                await analytics.markCompleted(analyticsData.metadata.computationTime);
            }

            // Cache the result
            CacheService.set(cacheKey, analytics.data.payments, this.defaultCacheTTL);

            return {
                success: true,
                data: analytics.data.payments,
                metadata: analytics.metadata,
                cached: false
            };

        } catch (error) {
            console.error('Error getting payment analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user analytics
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getUserAnalytics(options = {}) {
        try {
            const {
                period = 'daily',
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = options;

            const cacheKey = `${this.cachePrefix}users:${period}`;
            
            // Try cache first unless force refresh
            if (!forceRefresh) {
                const cached = CacheService.get(cacheKey);
                if (cached) {
                    return {
                        success: true,
                        data: cached,
                        cached: true
                    };
                }
            }

            // Get or create analytics
            let analytics = await this.repository.findFreshOrCreate('users', period);

            // If analytics is computing or expired, compute fresh data
            if (analytics.status === 'computing' || analytics.isExpired) {
                const computeStartDate = startDate || this.getDateRangeForPeriod(period).start;
                const computeEndDate = endDate || this.getDateRangeForPeriod(period).end;

                const analyticsData = await this.repository.computeUserAnalytics(
                    computeStartDate,
                    computeEndDate
                );

                // Update the analytics record
                Object.assign(analytics, analyticsData);
                await analytics.markCompleted(analyticsData.metadata.computationTime);
            }

            // Cache the result
            CacheService.set(cacheKey, analytics.data.users, this.defaultCacheTTL);

            return {
                success: true,
                data: analytics.data.users,
                metadata: analytics.metadata,
                cached: false
            };

        } catch (error) {
            console.error('Error getting user analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get event analytics
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getEventAnalytics(options = {}) {
        try {
            const {
                period = 'daily',
                eventId = null,
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = options;

            const cacheKey = `${this.cachePrefix}events:${period}:${eventId || 'all'}`;
            
            // Try cache first unless force refresh
            if (!forceRefresh) {
                const cached = CacheService.get(cacheKey);
                if (cached) {
                    return {
                        success: true,
                        data: cached,
                        cached: true
                    };
                }
            }

            // For now, return basic event analytics
            // This can be expanded with more sophisticated event-specific metrics
            const votingAnalytics = await this.getVotingAnalytics({ 
                period, 
                eventId, 
                startDate, 
                endDate, 
                forceRefresh: true 
            });

            if (!votingAnalytics.success) {
                return votingAnalytics;
            }

            const eventData = {
                totalVotes: votingAnalytics.data.totalVotes,
                uniqueVoters: votingAnalytics.data.uniqueVoters,
                topCandidates: votingAnalytics.data.topCandidates,
                categoryBreakdown: votingAnalytics.data.categoryBreakdown,
                votingTrend: votingAnalytics.data.votesPerHour
            };

            // Cache the result
            CacheService.set(cacheKey, eventData, this.defaultCacheTTL);

            return {
                success: true,
                data: eventData,
                cached: false
            };

        } catch (error) {
            console.error('Error getting event analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get comprehensive analytics for a specific period
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getComprehensiveAnalytics(options = {}) {
        try {
            const {
                period = 'daily',
                eventId = null,
                includeVoting = true,
                includePayments = true,
                includeUsers = true,
                includeEvents = true
            } = options;

            const results = {};

            // Get all requested analytics in parallel
            const promises = [];

            if (includeVoting) {
                promises.push(
                    this.getVotingAnalytics({ period, eventId }).then(result => ({
                        type: 'voting',
                        result
                    }))
                );
            }

            if (includePayments) {
                promises.push(
                    this.getPaymentAnalytics({ period }).then(result => ({
                        type: 'payments',
                        result
                    }))
                );
            }

            if (includeUsers) {
                promises.push(
                    this.getUserAnalytics({ period }).then(result => ({
                        type: 'users',
                        result
                    }))
                );
            }

            if (includeEvents) {
                promises.push(
                    this.getEventAnalytics({ period, eventId }).then(result => ({
                        type: 'events',
                        result
                    }))
                );
            }

            const analyticsResults = await Promise.all(promises);

            // Process results
            let hasErrors = false;
            const errors = [];

            analyticsResults.forEach(({ type, result }) => {
                if (result.success) {
                    results[type] = result.data;
                } else {
                    hasErrors = true;
                    errors.push({ type, error: result.error });
                }
            });

            return {
                success: !hasErrors,
                data: results,
                errors: hasErrors ? errors : undefined,
                period,
                eventId,
                generatedAt: new Date()
            };

        } catch (error) {
            console.error('Error getting comprehensive analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get real-time statistics
     * @returns {Promise<Object>}
     */
    async getRealTimeStats() {
        try {
            const cacheKey = `${this.cachePrefix}realtime:stats`;
            
            // Check cache with shorter TTL for real-time data
            let stats = CacheService.get(cacheKey);
            if (stats) {
                return {
                    success: true,
                    data: stats,
                    cached: true
                };
            }

            // Get real-time data (last 24 hours)
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const analyticsData = await this.repository.computeOverviewAnalytics(yesterday, now);
            stats = analyticsData.data.overview;

            // Add real-time specific metrics
            stats.lastUpdated = new Date();
            stats.isRealTime = true;

            // Cache with shorter TTL (5 minutes = 300000ms)
            CacheService.set(cacheKey, stats, 300000);

            return {
                success: true,
                data: stats,
                cached: false
            };

        } catch (error) {
            console.error('Error getting real-time stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get comprehensive collection statistics
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getCollectionStatistics(options = {}) {
        try {
            const {
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = options;

            const cacheKey = `${this.cachePrefix}collections:stats:${startDate || 'all'}:${endDate || 'all'}`;
            
            // Check cache unless forced refresh
            if (!forceRefresh) {
                let stats = CacheService.get(cacheKey);
                if (stats) {
                    return {
                        success: true,
                        data: stats,
                        cached: true
                    };
                }
            }

            // Get collection statistics from repository
            const collections = await this.repository.getCollectionStatistics({
                startDate,
                endDate
            });

            // Enhance with additional metrics
            const enhancedStats = {
                overview: {
                    totalCollections: Object.keys(collections).length,
                    timestamp: new Date(),
                    period: {
                        startDate,
                        endDate,
                        description: this._getPeriodDescription(startDate, endDate)
                    }
                },
                collections: collections,
                summary: {
                    totalDocuments: Object.values(collections).reduce((sum, col) => sum + (col.count || 0), 0),
                    averageDocumentsPerCollection: Math.round(
                        Object.values(collections).reduce((sum, col) => sum + (col.count || 0), 0) / 
                        Object.keys(collections).length
                    ),
                    largestCollection: this._findLargestCollection(collections),
                    smallestCollection: this._findSmallestCollection(collections)
                },
                growth: await this._calculateCollectionGrowth(collections, startDate, endDate)
            };

            // Cache the result
            CacheService.set(cacheKey, enhancedStats, this.defaultCacheTTL);

            return {
                success: true,
                data: enhancedStats,
                cached: false
            };

        } catch (error) {
            console.error('Error getting collection statistics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clear analytics cache
     * @param {string} type - Optional analytics type to clear
     * @returns {Promise<Object>}
     */
    async clearCache(type = null) {
        try {
            // For now, just clear all caches since we don't have pattern deletion
            // In a real implementation, you might want to iterate through cache keys
            CacheService.clearAll();

            return {
                success: true,
                message: `Cleared analytics cache entries`,
                pattern: type ? `${this.cachePrefix}${type}:*` : `${this.cachePrefix}*`
            };

        } catch (error) {
            console.error('Error clearing analytics cache:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Schedule analytics computation
     * @param {string} type - Analytics type
     * @param {string} period - Time period
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async scheduleComputation(type, period, options = {}) {
        try {
            const { eventId = null, priority = 'normal' } = options;
            
            // Create placeholder analytics record
            const references = eventId ? { event: eventId } : {};
            const analytics = await this.repository.findFreshOrCreate(type, period, references);

            // In a real implementation, this would queue a background job
            // For now, we'll just mark it as scheduled
            console.log(`Scheduled ${type} analytics computation for ${period} period`);

            return {
                success: true,
                message: `Scheduled ${type} analytics computation`,
                analyticsId: analytics._id,
                type,
                period,
                priority
            };

        } catch (error) {
            console.error('Error scheduling analytics computation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get date range for a given period
     * @param {string} period - Time period
     * @returns {Object} Date range with start and end dates
     */
    getDateRangeForPeriod(period) {
        const now = new Date();
        let start, end;

        switch (period) {
            case 'hourly':
                start = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
                end = now;
                break;
            case 'daily':
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
                end = now;
                break;
            case 'weekly':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
                end = now;
                break;
            case 'monthly':
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
                end = now;
                break;
            case 'yearly':
                start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 365 days ago
                end = now;
                break;
            case 'all-time':
                start = new Date('2020-01-01'); // Arbitrary start date
                end = now;
                break;
            default:
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                end = now;
        }

        return { start, end };
    }

    /**
     * Clean up expired analytics
     * @returns {Promise<Object>}
     */
    async cleanupExpired() {
        try {
            const deletedCount = await this.repository.cleanupExpired();

            return {
                success: true,
                message: `Cleaned up ${deletedCount} expired analytics records`,
                deletedCount
            };

        } catch (error) {
            console.error('Error cleaning up expired analytics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get analytics health status
     * @returns {Promise<Object>}
     */
    async getHealthStatus() {
        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

            // Check recent analytics computations
            const recentAnalytics = await this.repository.find({
                'metadata.computedAt': { $gte: oneHourAgo }
            });

            const totalRecords = await this.repository.countDocuments();
            const completedRecords = await this.repository.countDocuments({ status: 'completed' });
            const failedRecords = await this.repository.countDocuments({ status: 'failed' });
            const computingRecords = await this.repository.countDocuments({ status: 'computing' });

            const healthStatus = {
                status: 'healthy',
                totalRecords,
                completedRecords,
                failedRecords,
                computingRecords,
                recentComputations: recentAnalytics.length,
                successRate: totalRecords > 0 ? (completedRecords / totalRecords) * 100 : 0,
                lastUpdated: now
            };

            // Determine overall health
            if (failedRecords > completedRecords * 0.1) { // More than 10% failed
                healthStatus.status = 'degraded';
            }
            if (computingRecords > 10) { // Too many stuck computations
                healthStatus.status = 'unhealthy';
            }

            return {
                success: true,
                data: healthStatus
            };

        } catch (error) {
            console.error('Error getting analytics health status:', error);
            return {
                success: false,
                error: error.message,
                data: {
                    status: 'error',
                    lastUpdated: new Date()
                }
            };
        }
    }

    /**
     * Get period description for display
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {String} Period description
     * @private
     */
    _getPeriodDescription(startDate, endDate) {
        if (!startDate && !endDate) {
            return 'All time';
        }
        if (!startDate) {
            return `Up to ${endDate.toDateString()}`;
        }
        if (!endDate) {
            return `From ${startDate.toDateString()}`;
        }
        return `${startDate.toDateString()} to ${endDate.toDateString()}`;
    }

    /**
     * Find the collection with most documents
     * @param {Object} collections - Collections data
     * @returns {Object} Largest collection info
     * @private
     */
    _findLargestCollection(collections) {
        let largest = null;
        let maxCount = 0;

        for (const [name, data] of Object.entries(collections)) {
            if ((data.count || 0) > maxCount) {
                maxCount = data.count || 0;
                largest = { name, count: maxCount, ...data };
            }
        }

        return largest;
    }

    /**
     * Find the collection with fewest documents
     * @param {Object} collections - Collections data
     * @returns {Object} Smallest collection info
     * @private
     */
    _findSmallestCollection(collections) {
        let smallest = null;
        let minCount = Infinity;

        for (const [name, data] of Object.entries(collections)) {
            if ((data.count || 0) < minCount) {
                minCount = data.count || 0;
                smallest = { name, count: minCount, ...data };
            }
        }

        return smallest;
    }

    /**
     * Calculate collection growth rates
     * @param {Object} collections - Current collections data
     * @param {Date} startDate - Period start
     * @param {Date} endDate - Period end
     * @returns {Promise<Object>} Growth statistics
     * @private
     */
    async _calculateCollectionGrowth(collections, startDate, endDate) {
        try {
            // For now, return basic growth metrics
            // In a full implementation, you'd compare with previous periods
            const totalCurrent = Object.values(collections).reduce((sum, col) => sum + (col.count || 0), 0);
            
            return {
                totalDocuments: totalCurrent,
                periodGrowth: null, // Would need historical data
                growthRate: null,   // Would need historical data
                note: 'Historical comparison not implemented'
            };
        } catch (error) {
            console.error('Error calculating collection growth:', error);
            return {
                totalDocuments: 0,
                periodGrowth: null,
                growthRate: null,
                error: error.message
            };
        }
    }

    /**
     * Get event participation analytics
     * @param {Object} options - Options including date range
     * @returns {Promise<Object>}
     */
    async getEventParticipationAnalytics(options = {}) {
        try {
            const { startDate, endDate } = options;
            
            // Convert string dates to Date objects if needed
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();

            const cacheKey = `${this.cachePrefix}event-participation:${start.getTime()}-${end.getTime()}`;
            
            // Try to get from cache first
            let analytics = CacheService.get(cacheKey);
            if (analytics) {
                return {
                    success: true,
                    data: analytics,
                    cached: true
                };
            }

            // Get from repository
            const analyticsData = await this.repository.computeEventParticipationAnalytics(start, end);
            
            // Cache the result for a shorter period since this is more dynamic
            CacheService.set(cacheKey, analyticsData.data.eventParticipation, this.defaultCacheTTL / 2);

            return {
                success: true,
                data: analyticsData.data.eventParticipation,
                cached: false,
                metadata: analyticsData.metadata
            };

        } catch (error) {
            console.error('Error getting event participation analytics:', error);
            throw error;
        }
    }
}

export default AnalyticsService;
