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
            // Filter out null or undefined collections
            const validCollections = Object.entries(collections)
                .filter(([_, data]) => data && data !== null && typeof data === 'object')
                .reduce((acc, [name, data]) => {
                    acc[name] = data;
                    return acc;
                }, {});

            const totalCollections = Object.keys(validCollections).length;
            const totalDocuments = Object.values(validCollections).reduce((sum, col) => sum + (col.count || 0), 0);

            console.log('Collection Statistics:', validCollections);

            const enhancedStats = {
                overview: {
                    totalCollections,
                    timestamp: new Date(),
                    period: {
                        startDate,
                        endDate,
                        description: this._getPeriodDescription(startDate, endDate)
                    }
                },
                collections: validCollections,
                summary: {
                    totalDocuments,
                    averageDocumentsPerCollection: totalCollections > 0
                        ? Math.round(totalDocuments / totalCollections)
                        : 0,
                    largestCollection: this._findLargestCollection(validCollections),
                    smallestCollection: this._findSmallestCollection(validCollections)
                },
                growth: await this._calculateCollectionGrowth(validCollections, startDate, endDate)
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
     * @param {Date|null} startDate - Period start
     * @param {Date|null} endDate - Period end
     * @returns {Promise<Object>} Growth statistics
     * @private
     */
    async _calculateCollectionGrowth(collections, startDate, endDate) {
        try {
            // If no start/end date, use all-time stats
            if (!startDate || !endDate) {
                // Get earliest and latest dates from repository if possible
                const allTimeData = await this.repository.getCollectionStatistics({});

                const filteredAllTimeData = Object.entries(allTimeData).filter(([_, data]) => data && data !== null && typeof data === 'object');
                const totalDocuments = Object.values(filteredAllTimeData).reduce((sum, col) => sum + (col.count || 0), 0);

                // No previous period, so growth is not applicable
                const growthByCollection = {};
                Object.keys(filteredAllTimeData).forEach(collectionName => {
                    const current = filteredAllTimeData[collectionName]?.count || 0;
                    growthByCollection[collectionName] = {
                        current,
                        previous: null,
                        growth: null,
                        growthRate: null,
                        trend: 'stable'
                    };
                });

                return {
                    totalDocuments,
                    totalGrowth: null,
                    totalGrowthRate: null,
                    growthByCollection,
                    velocity: null,
                    period: {
                        current: null,
                        previous: null
                    },
                    insights: [
                        {
                            type: 'info',
                            message: 'General growth insight: All-time statistics only. Specify startDate and endDate for period-based growth.',
                            priority: 'low'
                        }
                    ]
                };
            }

            const currentPeriod = { start: startDate, end: endDate };
            const periodLength = endDate - startDate;
            const previousPeriod = { 
                start: new Date(startDate.getTime() - periodLength), 
                end: startDate 
            };

            // Get historical data for comparison
            const [currentData, previousData] = await Promise.all([
                this.repository.getCollectionStatistics({ 
                    startDate: currentPeriod.start, 
                    endDate: currentPeriod.end 
                }),
                this.repository.getCollectionStatistics({ 
                    startDate: previousPeriod.start, 
                    endDate: previousPeriod.end 
                })
            ]);

            const currentTotal = Object.values(collections).reduce((sum, col) => sum + (col.count || 0), 0);
            const previousTotal = Object.values(previousData).reduce((sum, col) => sum + (col.count || 0), 0);

            // Calculate overall growth
            const totalGrowth = currentTotal - previousTotal;
            const totalGrowthRate = previousTotal > 0 ? ((totalGrowth / previousTotal) * 100) : 0;

            // Calculate growth by collection
            const growthByCollection = {};
            Object.keys(collections).forEach(collectionName => {
                const current = collections[collectionName]?.count || 0;
                const previous = previousData[collectionName]?.count || 0;
                const growth = current - previous;
                const growthRate = previous > 0 ? ((growth / previous) * 100) : 0;

                growthByCollection[collectionName] = {
                    current,
                    previous,
                    growth,
                    growthRate: Math.round(growthRate * 100) / 100,
                    trend: this._calculateTrend(growthRate)
                };
            });

            // Calculate growth velocity (acceleration)
            const velocity = await this._calculateGrowthVelocity(collections, currentPeriod);

            return {
                totalDocuments: currentTotal,
                totalGrowth,
                totalGrowthRate: Math.round(totalGrowthRate * 100) / 100,
                growthByCollection,
                velocity,
                period: {
                    current: currentPeriod,
                    previous: previousPeriod
                },
                insights: this._generateGrowthInsights(growthByCollection, totalGrowthRate)
            };
        } catch (error) {
            console.error('Error calculating collection growth:', error);
            return {
                totalDocuments: 0,
                totalGrowth: 0,
                totalGrowthRate: 0,
                growthByCollection: {},
                error: error.message
            };
        }
    }

    /**
     * Calculate growth velocity (rate of change of growth rate)
     * @param {Object} collections - Current collections data
     * @param {Object} period - Current period
     * @returns {Promise<Object>} Velocity metrics
     * @private
     */
    async _calculateGrowthVelocity(collections, period) {
        try {
            const periodLength = period.end - period.start;
            const intervals = 4; // Quarter the period for velocity calculation
            const intervalLength = periodLength / intervals;
            
            const velocityData = [];
            
            for (let i = 0; i < intervals; i++) {
                const intervalStart = new Date(period.start.getTime() + (i * intervalLength));
                const intervalEnd = new Date(period.start.getTime() + ((i + 1) * intervalLength));
                
                const intervalData = await this.repository.getCollectionStatistics({
                    startDate: intervalStart,
                    endDate: intervalEnd
                });
                
                const totalDocs = Object.values(intervalData).reduce((sum, col) => sum + (col.count || 0), 0);
                velocityData.push({
                    interval: i + 1,
                    totalDocuments: totalDocs,
                    period: { start: intervalStart, end: intervalEnd }
                });
            }

            // Calculate velocity between intervals
            const velocities = [];
            for (let i = 1; i < velocityData.length; i++) {
                const current = velocityData[i].totalDocuments;
                const previous = velocityData[i - 1].totalDocuments;
                const velocity = current - previous;
                velocities.push(velocity);
            }

            const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
            const acceleration = velocities.length > 1 ? 
                (velocities[velocities.length - 1] - velocities[0]) / (velocities.length - 1) : 0;

            return {
                averageVelocity: Math.round(avgVelocity * 100) / 100,
                acceleration: Math.round(acceleration * 100) / 100,
                trend: this._calculateTrend(avgVelocity),
                intervals: velocityData
            };
        } catch (error) {
            console.error('Error calculating growth velocity:', error);
            return {
                averageVelocity: 0,
                acceleration: 0,
                trend: 'stable',
                error: error.message
            };
        }
    }

    /**
     * Calculate trend direction based on growth rate
     * @param {number} growthRate - Growth rate percentage
     * @returns {string} Trend direction
     * @private
     */
    _calculateTrend(growthRate) {
        if (growthRate > 5) return 'strongly_positive';
        if (growthRate > 1) return 'positive';
        if (growthRate > -1) return 'stable';
        if (growthRate > -5) return 'negative';
        return 'strongly_negative';
    }

    /**
     * Generate growth insights based on collection data
     * @param {Object} growthByCollection - Growth data by collection
     * @param {number} totalGrowthRate - Overall growth rate
     * @returns {Array} Growth insights
     * @private
     */
    _generateGrowthInsights(growthByCollection, totalGrowthRate) {
        const insights = [];

        // Overall growth insight
        if (totalGrowthRate > 10) {
            insights.push({
                type: 'positive',
                message: `Strong overall growth of ${totalGrowthRate.toFixed(1)}%`,
                priority: 'high'
            });
        } else if (totalGrowthRate < -5) {
            insights.push({
                type: 'warning',
                message: `Concerning decline of ${Math.abs(totalGrowthRate).toFixed(1)}%`,
                priority: 'high'
            });
        }

        // Collection-specific insights
        Object.entries(growthByCollection).forEach(([collection, data]) => {
            if (data.growthRate > 20) {
                insights.push({
                    type: 'positive',
                    message: `${collection} showing exceptional growth (${data.growthRate.toFixed(1)}%)`,
                    collection,
                    priority: 'medium'
                });
            } else if (data.growthRate < -10) {
                insights.push({
                    type: 'warning',
                    message: `${collection} experiencing significant decline (${Math.abs(data.growthRate).toFixed(1)}%)`,
                    collection,
                    priority: 'high'
                });
            }
        });

        // Identify fastest and slowest growing collections
        const sortedCollections = Object.entries(growthByCollection)
            .sort((a, b) => b[1].growthRate - a[1].growthRate);

        if (sortedCollections.length > 0) {
            const fastest = sortedCollections[0];
            const slowest = sortedCollections[sortedCollections.length - 1];

            insights.push({
                type: 'info',
                message: `Fastest growing: ${fastest[0]} (${fastest[1].growthRate.toFixed(1)}%)`,
                priority: 'low'
            });

            insights.push({
                type: 'info',
                message: `Slowest growing: ${slowest[0]} (${slowest[1].growthRate.toFixed(1)}%)`,
                priority: 'low'
            });
        }

        return insights;
    }

    /**
     * Calculate time-series growth data
     * @param {string} collection - Collection name
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {string} interval - Interval (daily, weekly, monthly)
     * @returns {Promise<Array>} Time series data
     */
    async calculateTimeSeriesGrowth(collection, startDate, endDate, interval = 'daily') {
        try {
            const timePoints = this._generateTimePoints(startDate, endDate, interval);
            const timeSeriesData = [];

            for (let i = 0; i < timePoints.length; i++) {
                const point = timePoints[i];
                const collectionData = await this.repository.getCollectionStatistics({
                    startDate: point.start,
                    endDate: point.end
                });

                const count = collectionData[collection]?.count || 0;
                const previousCount = i > 0 ? timeSeriesData[i - 1].count : 0;
                const growth = count - previousCount;
                const growthRate = previousCount > 0 ? ((growth / previousCount) * 100) : 0;

                timeSeriesData.push({
                    date: point.date,
                    count,
                    growth,
                    growthRate: Math.round(growthRate * 100) / 100,
                    period: point
                });
            }

            // Calculate moving averages
            const windowSize = Math.min(7, timeSeriesData.length);
            timeSeriesData.forEach((point, index) => {
                if (index >= windowSize - 1) {
                    const window = timeSeriesData.slice(index - windowSize + 1, index + 1);
                    point.movingAverage = window.reduce((sum, p) => sum + p.count, 0) / windowSize;
                    point.movingAverageGrowth = window.reduce((sum, p) => sum + p.growthRate, 0) / windowSize;
                }
            });

            return timeSeriesData;
        } catch (error) {
            console.error('Error calculating time series growth:', error);
            throw error;
        }
    }

    /**
     * Generate time points for time series analysis
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {string} interval - Interval type
     * @returns {Array} Time points
     * @private
     */
    _generateTimePoints(startDate, endDate, interval) {
        const points = [];
        let current = new Date(startDate);
        const end = new Date(endDate);

        const intervalMs = {
            'daily': 24 * 60 * 60 * 1000,
            'weekly': 7 * 24 * 60 * 60 * 1000,
            'monthly': 30 * 24 * 60 * 60 * 1000
        };

        const step = intervalMs[interval] || intervalMs.daily;

        while (current < end) {
            const pointEnd = new Date(Math.min(current.getTime() + step, end.getTime()));
            points.push({
                date: new Date(current),
                start: new Date(current),
                end: pointEnd
            });
            current = new Date(pointEnd);
        }

        return points;
    }

    /**
     * Calculate rolling growth metrics
     * @param {string} collection - Collection name
     * @param {number} windowDays - Rolling window in days
     * @returns {Promise<Object>} Rolling metrics
     */
    async calculateRollingGrowth(collection, windowDays = 30) {
        try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (windowDays * 24 * 60 * 60 * 1000));

            const timeSeriesData = await this.calculateTimeSeriesGrowth(
                collection, 
                startDate, 
                endDate, 
                'daily'
            );

            if (timeSeriesData.length === 0) {
                return {
                    rollingAverage: 0,
                    rollingGrowthRate: 0,
                    volatility: 0,
                    trend: 'stable'
                };
            }

            // Calculate rolling metrics
            const counts = timeSeriesData.map(point => point.count);
            const growthRates = timeSeriesData.map(point => point.growthRate);

            const rollingAverage = counts.reduce((sum, count) => sum + count, 0) / counts.length;
            const rollingGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;

            // Calculate volatility (standard deviation of growth rates)
            const variance = growthRates.reduce((sum, rate) => {
                return sum + Math.pow(rate - rollingGrowthRate, 2);
            }, 0) / growthRates.length;
            const volatility = Math.sqrt(variance);

            // Determine trend
            const recentGrowth = growthRates.slice(-7).reduce((sum, rate) => sum + rate, 0) / 7;
            const trend = this._calculateTrend(recentGrowth);

            return {
                rollingAverage: Math.round(rollingAverage * 100) / 100,
                rollingGrowthRate: Math.round(rollingGrowthRate * 100) / 100,
                volatility: Math.round(volatility * 100) / 100,
                trend,
                windowDays,
                dataPoints: timeSeriesData.length
            };
        } catch (error) {
            console.error('Error calculating rolling growth:', error);
            throw error;
        }
    }    /**
     * Calculate growth trend direction
     * @param {Object} growthByCollection - Growth data by collection
     * @returns {string} Trend direction
     * @private
     */
    _calculateGrowthTrend(growthByCollection) {
        const positiveGrowth = Object.values(growthByCollection).filter(col => col.growth > 0).length;
        const negativeGrowth = Object.values(growthByCollection).filter(col => col.growth < 0).length;
        const total = Object.keys(growthByCollection).length;
        
        const positiveRatio = positiveGrowth / total;
        
        if (positiveRatio >= 0.7) return 'strong_growth';
        if (positiveRatio >= 0.5) return 'moderate_growth';
        if (positiveRatio >= 0.3) return 'mixed';
        if (positiveRatio > 0) return 'moderate_decline';
        return 'strong_decline';
    }

    /**
     * Calculate growth momentum
     * @param {Object} current - Current period data
     * @param {Object} previous - Previous period data
     * @returns {string} Momentum indicator
     * @private
     */
    _calculateGrowthMomentum(current, previous) {
        // This would be enhanced with more historical data in a full implementation
        const currentTotal = Object.values(current).reduce((sum, col) => sum + (col.total || col.count || 0), 0);
        const previousTotal = Object.values(previous).reduce((sum, col) => sum + (col.total || col.count || 0), 0);
        
        const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
        
        if (growth > 20) return 'accelerating';
        if (growth > 5) return 'growing';
        if (growth > -5) return 'stable';
        if (growth > -20) return 'slowing';
        return 'declining';
    }

    /**
     * Calculate volatility from array of values
     * @param {Array} values - Array of numeric values
     * @returns {number} Volatility measure
     * @private
     */
    _calculateVolatility(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Generate growth insights
     * @param {Object} growthByCollection - Growth data by collection
     * @param {number} totalGrowth - Overall growth percentage
     * @returns {Array} Array of insight objects
     * @private
     */
    _generateGrowthInsights(growthByCollection, totalGrowth) {
        const insights = [];
        
        // Overall growth insights
        if (totalGrowth > 25) {
            insights.push({
                type: 'positive',
                category: 'overall_growth',
                message: `Exceptional growth of ${totalGrowth.toFixed(1)}% across all collections`,
                priority: 'high'
            });
        } else if (totalGrowth > 10) {
            insights.push({
                type: 'positive',
                category: 'overall_growth',
                message: `Strong growth of ${totalGrowth.toFixed(1)}% across collections`,
                priority: 'medium'
            });
        } else if (totalGrowth < -10) {
            insights.push({
                type: 'warning',
                category: 'overall_growth',
                message: `Concerning decline of ${Math.abs(totalGrowth).toFixed(1)}% in total documents`,
                priority: 'high'
            });
        }
        
        // Individual collection insights
        Object.entries(growthByCollection).forEach(([collection, data]) => {
            if (data.growth > 50) {
                insights.push({
                    type: 'positive',
                    category: 'collection_growth',
                    message: `${collection} showing exceptional growth of ${data.growth.toFixed(1)}%`,
                    priority: 'medium'
                });
            } else if (data.growth < -25) {
                insights.push({
                    type: 'warning',
                    category: 'collection_decline',
                    message: `${collection} declining significantly by ${Math.abs(data.growth).toFixed(1)}%`,
                    priority: 'high'
                });
            }
        });
        
        // Top and bottom performers
        const sortedCollections = Object.entries(growthByCollection)
            .sort((a, b) => b[1].growth - a[1].growth);
            
        if (sortedCollections.length > 0) {
            const topPerformer = sortedCollections[0];
            const bottomPerformer = sortedCollections[sortedCollections.length - 1];
            
            insights.push({
                type: 'info',
                category: 'performance',
                message: `Top performer: ${topPerformer[0]} (+${topPerformer[1].growth.toFixed(1)}%)`,
                priority: 'low'
            });
            
            if (bottomPerformer[1].growth < 0) {
                insights.push({
                    type: 'info',
                    category: 'performance',
                    message: `Needs attention: ${bottomPerformer[0]} (${bottomPerformer[1].growth.toFixed(1)}%)`,
                    priority: 'medium'
                });
            }
        }
        
        return insights;
    }

    /**
     * Determine period type from date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {string} Period type
     * @private
     */
    _determinePeriodType(startDate, endDate) {
        const durationMs = endDate - startDate;
        const days = durationMs / (24 * 60 * 60 * 1000);
        
        if (days <= 1) return 'daily';
        if (days <= 7) return 'weekly';
        if (days <= 31) return 'monthly';
        if (days <= 92) return 'quarterly';
        if (days <= 366) return 'yearly';
        return 'custom';
    }

    /**
     * Calculate voting analytics growth
     * @param {Object} options - Options including date range and period type
     * @returns {Promise<Object>} Voting growth analytics
     */
    async calculateVotingGrowth(options = {}) {
        try {
            const { 
                period = 'daily', 
                periodCount = 7,
                endDate = new Date(),
                eventId = null 
            } = options;

            const periods = this._generateDatePeriods(period, periodCount, endDate);
            const votingData = [];

            for (const periodData of periods) {
                const matchQuery = {
                    votedAt: { $gte: periodData.start, $lte: periodData.end }
                };

                if (eventId) {
                    matchQuery.eventId = eventId;
                }

                const [totalVotes, uniqueVoters, eventVotes] = await Promise.all([
                    Vote.countDocuments(matchQuery),
                    Vote.distinct('userId', matchQuery).then(users => users.length),
                    Vote.aggregate([
                        { $match: matchQuery },
                        {
                            $group: {
                                _id: '$eventId',
                                votes: { $sum: 1 },
                                voters: { $addToSet: '$userId' }
                            }
                        },
                        {
                            $project: {
                                eventId: '$_id',
                                votes: 1,
                                uniqueVoters: { $size: '$voters' }
                            }
                        }
                    ])
                ]);

                votingData.push({
                    period: periodData.label,
                    date: periodData.end,
                    totalVotes,
                    uniqueVoters,
                    averageVotesPerVoter: uniqueVoters > 0 ? (totalVotes / uniqueVoters) : 0,
                    eventBreakdown: eventVotes
                });
            }

            return {
                data: votingData,
                growth: this._calculateTimeSeriesGrowth(votingData, 'totalVotes'),
                voterGrowth: this._calculateTimeSeriesGrowth(votingData, 'uniqueVoters'),
                trends: this._analyzeTrends(votingData, ['totalVotes', 'uniqueVoters']),
                summary: {
                    totalPeriods: votingData.length,
                    avgVotesPerPeriod: votingData.reduce((sum, p) => sum + p.totalVotes, 0) / votingData.length,
                    avgVotersPerPeriod: votingData.reduce((sum, p) => sum + p.uniqueVoters, 0) / votingData.length,
                    peakVotingPeriod: votingData.reduce((max, p) => p.totalVotes > max.totalVotes ? p : max, votingData[0])
                }
            };

        } catch (error) {
            console.error('Error calculating voting growth:', error);
            throw error;
        }
    }

    /**
     * Calculate user analytics growth
     * @param {Object} options - Options including date range and period type
     * @returns {Promise<Object>} User growth analytics
     */
    async calculateUserGrowth(options = {}) {
        try {
            const { 
                period = 'daily', 
                periodCount = 7,
                endDate = new Date(),
                includeActivity = true 
            } = options;

            const periods = this._generateDatePeriods(period, periodCount, endDate);
            const userData = [];

            for (const periodData of periods) {
                const matchQuery = {
                    createdAt: { $gte: periodData.start, $lte: periodData.end }
                };

                const [newUsers, activeUsers, usersByRole, userActivity] = await Promise.all([
                    User.countDocuments(matchQuery),
                    User.countDocuments({
                        lastLoginAt: { $gte: periodData.start, $lte: periodData.end }
                    }),
                    User.aggregate([
                        { $match: matchQuery },
                        {
                            $group: {
                                _id: '$role.name',
                                count: { $sum: 1 }
                            }
                        }
                    ]),
                    includeActivity ? Activity.aggregate([
                        {
                            $match: {
                                createdAt: { $gte: periodData.start, $lte: periodData.end }
                            }
                        },
                        {
                            $group: {
                                _id: '$userId',
                                activities: { $sum: 1 }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalActivities: { $sum: '$activities' },
                                activeUsers: { $sum: 1 },
                                avgActivitiesPerUser: { $avg: '$activities' }
                            }
                        }
                    ]).then(result => result[0] || { totalActivities: 0, activeUsers: 0, avgActivitiesPerUser: 0 }) : null
                ]);

                const roleBreakdown = usersByRole.reduce((acc, role) => {
                    acc[role._id] = role.count;
                    return acc;
                }, {});

                userData.push({
                    period: periodData.label,
                    date: periodData.end,
                    newUsers,
                    activeUsers,
                    roleBreakdown,
                    activity: userActivity
                });
            }

            return {
                data: userData,
                growth: {
                    newUsers: this._calculateTimeSeriesGrowth(userData, 'newUsers'),
                    activeUsers: this._calculateTimeSeriesGrowth(userData, 'activeUsers')
                },
                trends: this._analyzeTrends(userData, ['newUsers', 'activeUsers']),
                retention: await this._calculateUserRetention(periods),
                summary: {
                    totalPeriods: userData.length,
                    avgNewUsersPerPeriod: userData.reduce((sum, p) => sum + p.newUsers, 0) / userData.length,
                    avgActiveUsersPerPeriod: userData.reduce((sum, p) => sum + p.activeUsers, 0) / userData.length,
                    peakRegistrationPeriod: userData.reduce((max, p) => p.newUsers > max.newUsers ? p : max, userData[0])
                }
            };

        } catch (error) {
            console.error('Error calculating user growth:', error);
            throw error;
        }
    }

    /**
     * Calculate revenue analytics growth
     * @param {Object} options - Options including date range and period type
     * @returns {Promise<Object>} Revenue growth analytics
     */
    async calculateRevenueGrowth(options = {}) {
        try {
            const { 
                period = 'daily', 
                periodCount = 7,
                endDate = new Date(),
                currency = 'GHS' 
            } = options;

            const periods = this._generateDatePeriods(period, periodCount, endDate);
            const revenueData = [];

            for (const periodData of periods) {
                const matchQuery = {
                    status: 'success',
                    paidAt: { $gte: periodData.start, $lte: periodData.end }
                };

                const [revenueStats, paymentMethods, transactionVolume] = await Promise.all([
                    Payment.aggregate([
                        { $match: matchQuery },
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: '$finalAmount' },
                                totalTransactions: { $sum: 1 },
                                avgTransactionValue: { $avg: '$finalAmount' },
                                maxTransaction: { $max: '$finalAmount' },
                                minTransaction: { $min: '$finalAmount' }
                            }
                        }
                    ]).then(result => result[0] || {
                        totalRevenue: 0,
                        totalTransactions: 0,
                        avgTransactionValue: 0,
                        maxTransaction: 0,
                        minTransaction: 0
                    }),
                    Payment.aggregate([
                        { $match: matchQuery },
                        {
                            $group: {
                                _id: '$paymentMethod',
                                revenue: { $sum: '$finalAmount' },
                                transactions: { $sum: 1 }
                            }
                        }
                    ]),
                    Payment.aggregate([
                        { $match: matchQuery },
                        {
                            $group: {
                                _id: {
                                    $dateToString: {
                                        format: period === 'hourly' ? '%Y-%m-%d %H:00' : '%Y-%m-%d',
                                        date: '$paidAt'
                                    }
                                },
                                revenue: { $sum: '$finalAmount' },
                                transactions: { $sum: 1 }
                            }
                        },
                        { $sort: { '_id': 1 } }
                    ])
                ]);

                const paymentMethodBreakdown = paymentMethods.reduce((acc, method) => {
                    acc[method._id] = {
                        revenue: method.revenue,
                        transactions: method.transactions,
                        avgValue: method.transactions > 0 ? method.revenue / method.transactions : 0
                    };
                    return acc;
                }, {});

                revenueData.push({
                    period: periodData.label,
                    date: periodData.end,
                    ...revenueStats,
                    paymentMethods: paymentMethodBreakdown,
                    transactionVolume: transactionVolume,
                    currency
                });
            }

            return {
                data: revenueData,
                growth: {
                    revenue: this._calculateTimeSeriesGrowth(revenueData, 'totalRevenue'),
                    transactions: this._calculateTimeSeriesGrowth(revenueData, 'totalTransactions'),
                    avgValue: this._calculateTimeSeriesGrowth(revenueData, 'avgTransactionValue')
                },
                trends: this._analyzeTrends(revenueData, ['totalRevenue', 'totalTransactions', 'avgTransactionValue']),
                forecasting: this._generateRevenueForecast(revenueData),
                summary: {
                    totalPeriods: revenueData.length,
                    totalRevenue: revenueData.reduce((sum, p) => sum + p.totalRevenue, 0),
                    totalTransactions: revenueData.reduce((sum, p) => sum + p.totalTransactions, 0),
                    avgRevenuePerPeriod: revenueData.reduce((sum, p) => sum + p.totalRevenue, 0) / revenueData.length,
                    peakRevenuePeriod: revenueData.reduce((max, p) => p.totalRevenue > max.totalRevenue ? p : max, revenueData[0])
                }
            };

        } catch (error) {
            console.error('Error calculating revenue growth:', error);
            throw error;
        }
    }

    /**
     * Calculate user retention rates
     * @param {Array} periods - Array of period objects
     * @returns {Promise<Object>} Retention analytics
     * @private
     */
    async _calculateUserRetention(periods) {
        try {
            if (periods.length < 2) {
                return { retentionRate: null, note: 'Insufficient periods for retention calculation' };
            }

            const retentionData = [];

            for (let i = 1; i < periods.length; i++) {
                const currentPeriod = periods[i];
                const previousPeriod = periods[i - 1];

                // Get users from previous period
                const previousUsers = await User.find({
                    createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end }
                }).select('_id');

                if (previousUsers.length === 0) {
                    retentionData.push({
                        period: currentPeriod.label,
                        retentionRate: 0,
                        retainedUsers: 0,
                        totalPreviousUsers: 0
                    });
                    continue;
                }

                const previousUserIds = previousUsers.map(u => u._id);

                // Check how many of those users were active in current period
                const retainedUsers = await User.countDocuments({
                    _id: { $in: previousUserIds },
                    lastLoginAt: { $gte: currentPeriod.start, $lte: currentPeriod.end }
                });

                const retentionRate = (retainedUsers / previousUsers.length) * 100;

                retentionData.push({
                    period: currentPeriod.label,
                    retentionRate: Math.round(retentionRate * 100) / 100,
                    retainedUsers,
                    totalPreviousUsers: previousUsers.length
                });
            }

            const avgRetentionRate = retentionData.length > 0 
                ? retentionData.reduce((sum, r) => sum + r.retentionRate, 0) / retentionData.length 
                : 0;

            return {
                retentionData,
                avgRetentionRate: Math.round(avgRetentionRate * 100) / 100,
                trend: retentionData.length > 1 
                    ? (retentionData[retentionData.length - 1].retentionRate - retentionData[0].retentionRate)
                    : 0
            };

        } catch (error) {
            console.error('Error calculating user retention:', error);
            return { error: error.message };
        }
    }

    /**
     * Generate revenue forecast using linear regression
     * @param {Array} revenueData - Historical revenue data
     * @returns {Object} Forecast data
     * @private
     */
    _generateRevenueForecast(revenueData) {
        try {
            if (revenueData.length < 3) {
                return { forecast: null, note: 'Insufficient data for forecasting' };
            }

            // Simple linear regression for next 3 periods
            const revenues = revenueData.map(d => d.totalRevenue);
            const n = revenues.length;
            const x = revenueData.map((_, i) => i);
            
            // Calculate slope and intercept
            const sumX = x.reduce((a, b) => a + b, 0);
            const sumY = revenues.reduce((a, b) => a + b, 0);
            const sumXY = x.reduce((sum, xi, i) => sum + xi * revenues[i], 0);
            const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            // Generate forecast for next 3 periods
            const forecast = [];
            for (let i = 1; i <= 3; i++) {
                const nextPeriodIndex = n + i - 1;
                const predictedRevenue = Math.max(0, slope * nextPeriodIndex + intercept);
                
                forecast.push({
                    period: `Forecast ${i}`,
                    predictedRevenue: Math.round(predictedRevenue * 100) / 100,
                    confidence: Math.max(0.5, 1 - (i * 0.15)) // Decreasing confidence
                });
            }

            // Calculate trend direction
            const recentTrend = slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable';
            const trendStrength = Math.abs(slope) / (sumY / n); // Relative to average

            return {
                forecast,
                trend: {
                    direction: recentTrend,
                    strength: Math.round(trendStrength * 10000) / 100, // As percentage
                    slope: Math.round(slope * 100) / 100
                },
                confidence: {
                    overall: Math.max(0.6, 1 - (Math.abs(slope) / (sumY / n)) * 0.1),
                    note: 'Confidence decreases with prediction distance and data volatility'
                }
            };

        } catch (error) {
            console.error('Error generating revenue forecast:', error);
            return { forecast: null, error: error.message };
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
