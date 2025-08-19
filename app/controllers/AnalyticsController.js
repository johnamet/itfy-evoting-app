#!/usr/bin/env node
/**
 * Analytics Controller
 * 
 * Handles HTTP requests for analytics and dashboard statistics.
 * Provides endpoints for various types of analytics data.
 */

import BaseController from './BaseController.js';
import AnalyticsService from '../services/AnalyticsService.js';

class AnalyticsController extends BaseController {
    constructor() {
        super();
        this.analyticsService = new AnalyticsService();
    }

    /**
     * Get dashboard overview statistics
     * GET /api/analytics/dashboard/overview
     */
    async getDashboardOverview(req, res) {
        try {
            const result = await this.analyticsService.getDashboardOverview();

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Dashboard overview retrieved successfully');

        } catch (error) {
            console.error('Error in getDashboardOverview:', error);
            return this.handleError(res, new Error('Failed to retrieve dashboard overview'), 500);
        }
    }

    /**
     * Get dashboard data (alias for getDashboardOverview)
     * GET /api/analytics/dashboard
     */
    async getDashboard(req, res) {
        return this.getDashboardOverview(req, res);
    }

    /**
     * Get voting statistics (alias for getVotingAnalytics)
     * GET /api/analytics/voting/stats
     */
    async getVotingStats(req, res) {
        return this.getVotingAnalytics(req, res);
    }

    /**
     * Get voting analytics
     * GET /api/analytics/voting
     */
    async getVotingAnalytics(req, res) {
        try {
            const {
                period = 'daily',
                eventId = null,
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = req.query;

            // Parse dates if provided
            const options = {
                period,
                eventId,
                forceRefresh: forceRefresh === 'true',
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null
            };

            const result = await this.analyticsService.getVotingAnalytics(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Voting analytics retrieved successfully');

        } catch (error) {
            console.error('Error in getVotingAnalytics:', error);
            return this.handleError(res, 'Failed to retrieve voting analytics', 500);
        }
    }

    /**
     * Get payment analytics
     * GET /api/analytics/payments
     */
    async getPaymentAnalytics(req, res) {
        try {
            const {
                period = 'daily',
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = req.query;

            const options = {
                period,
                forceRefresh: forceRefresh === 'true',
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null
            };

            const result = await this.analyticsService.getPaymentAnalytics(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Payment analytics retrieved successfully');

        } catch (error) {
            console.error('Error in getPaymentAnalytics:', error);
            return this.handleError(res, 'Failed to retrieve payment analytics', 500);
        }
    }

    /**
     * Get user analytics
     * GET /api/analytics/users
     */
    async getUserAnalytics(req, res) {
        try {
            const {
                period = 'daily',
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = req.query;

            const options = {
                period,
                forceRefresh: forceRefresh === 'true',
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null
            };

            const result = await this.analyticsService.getUserAnalytics(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'User analytics retrieved successfully');

        } catch (error) {
            console.error('Error in getUserAnalytics:', error);
            return this.handleError(res, 'Failed to retrieve user analytics', 500);
        }
    }

    /**
     * Get event analytics
     * GET /api/analytics/events/:eventId?
     */
    async getEventAnalytics(req, res) {
        try {
            const { eventId } = req.params;
            const {
                period = 'daily',
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = req.query;

            const options = {
                period,
                eventId: eventId || null,
                forceRefresh: forceRefresh === 'true',
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null
            };

            const result = await this.analyticsService.getEventAnalytics(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Event analytics retrieved successfully');

        } catch (error) {
            console.error('Error in getEventAnalytics:', error);
            return this.handleError(res, 'Failed to retrieve event analytics', 500);
        }
    }

    /**
     * Get comprehensive analytics
     * GET /api/analytics/comprehensive
     */
    async getComprehensiveAnalytics(req, res) {
        try {
            const {
                period = 'daily',
                eventId = null,
                includeVoting = true,
                includePayments = true,
                includeUsers = true,
                includeEvents = true
            } = req.query;

            const options = {
                period,
                eventId,
                includeVoting: includeVoting !== 'false',
                includePayments: includePayments !== 'false',
                includeUsers: includeUsers !== 'false',
                includeEvents: includeEvents !== 'false'
            };

            const result = await this.analyticsService.getComprehensiveAnalytics(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Comprehensive analytics retrieved successfully');

        } catch (error) {
            console.error('Error in getComprehensiveAnalytics:', error);
            return this.handleError(res, 'Failed to retrieve comprehensive analytics', 500);
        }
    }

    /**
     * Get real-time statistics
     * GET /api/analytics/realtime
     */
    async getRealTimeStats(req, res) {
        try {
            const result = await this.analyticsService.getRealTimeStats();

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Real-time statistics retrieved successfully');

        } catch (error) {
            console.error('Error in getRealTimeStats:', error);
            return this.handleError(res, 'Failed to retrieve real-time statistics', 500);
        }
    }

    /**
     * Get analytics trends
     * GET /api/analytics/trends
     */
    async getTrends(req, res) {
        try {
            const {
                type = 'voting',
                period = 'daily',
                days = 30
            } = req.query;

            // For now, return basic trend data
            // This can be expanded with more sophisticated trend analysis
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - parseInt(days) * 24 * 60 * 60 * 1000);

            let result;
            switch (type) {
                case 'voting':
                    result = await this.analyticsService.getVotingAnalytics({
                        period,
                        startDate,
                        endDate
                    });
                    break;
                case 'payments':
                    result = await this.analyticsService.getPaymentAnalytics({
                        period,
                        startDate,
                        endDate
                    });
                    break;
                case 'users':
                    result = await this.analyticsService.getUserAnalytics({
                        period,
                        startDate,
                        endDate
                    });
                    break;
                default:
                    return this.handleError(res, 'Invalid trend type', 400);
            }

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, `${type} trends retrieved successfully`);

        } catch (error) {
            console.error('Error in getTrends:', error);
            return this.handleError(res, 'Failed to retrieve trends', 500);
        }
    }

    /**
     * Clear analytics cache
     * DELETE /api/analytics/cache/:type?
     */
    async clearCache(req, res) {
        try {
            const { type } = req.params;

            const result = await this.analyticsService.clearCache(type);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, null, result.message);

        } catch (error) {
            console.error('Error in clearCache:', error);
            return this.handleError(res, 'Failed to clear analytics cache', 500);
        }
    }

    /**
     * Schedule analytics computation
     * POST /api/analytics/schedule
     */
    async scheduleComputation(req, res) {
        try {
            const {
                type,
                period,
                eventId = null,
                priority = 'normal'
            } = req.body;

            if (!type || !period) {
                return this.handleError(res, 'Type and period are required', 400);
            }

            const result = await this.analyticsService.scheduleComputation(type, period, {
                eventId,
                priority
            });

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, {
                analyticsId: result.analyticsId,
                type: result.type,
                period: result.period,
                priority: result.priority
            }, result.message);

        } catch (error) {
            console.error('Error in scheduleComputation:', error);
            return this.handleError(res, 'Failed to schedule analytics computation', 500);
        }
    }

    /**
     * Get analytics health status
     * GET /api/analytics/health
     */
    async getHealthStatus(req, res) {
        try {
            const result = await this.analyticsService.getHealthStatus();

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Analytics health status retrieved successfully');

        } catch (error) {
            console.error('Error in getHealthStatus:', error);
            return this.handleError(res, 'Failed to retrieve analytics health status', 500);
        }
    }

    /**
     * Clean up expired analytics
     * DELETE /api/analytics/cleanup
     */
    async cleanupExpired(req, res) {
        try {
            const result = await this.analyticsService.cleanupExpired();

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, {
                deletedCount: result.deletedCount
            }, result.message);

        } catch (error) {
            console.error('Error in cleanupExpired:', error);
            return this.handleError(res, 'Failed to cleanup expired analytics', 500);
        }
    }

    /**
     * Export analytics data
     * GET /api/analytics/export
     */
    async exportAnalytics(req, res) {
        try {
            const {
                type = 'comprehensive',
                period = 'daily',
                format = 'json',
                eventId = null
            } = req.query;

            let result;
            switch (type) {
                case 'comprehensive':
                    result = await this.analyticsService.getComprehensiveAnalytics({
                        period,
                        eventId
                    });
                    break;
                case 'voting':
                    result = await this.analyticsService.getVotingAnalytics({
                        period,
                        eventId
                    });
                    break;
                case 'payments':
                    result = await this.analyticsService.getPaymentAnalytics({
                        period
                    });
                    break;
                case 'users':
                    result = await this.analyticsService.getUserAnalytics({
                        period
                    });
                    break;
                default:
                    return this.handleError(res, 'Invalid export type', 400);
            }

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            // Set appropriate headers for download
            const filename = `analytics_${type}_${period}_${new Date().toISOString().split('T')[0]}`;
            
            if (format === 'json') {
                return this.sendExportResponse(res, result.data, 'json', filename, true, {
                    type,
                    period,
                    eventId,
                    recordCount: Array.isArray(result.data) ? result.data.length : 1
                });
            } else {
                // For CSV format, implement CSV conversion
                const csvData = this.convertToCSV(result.data);
                return this.sendCSVDownload(res, csvData, `${filename}.csv`);
            }

        } catch (error) {
            console.error('Error in exportAnalytics:', error);
            return this.handleError(res, 'Failed to export analytics', 500);
        }
    }

    /**
     * Get analytics summary for specific date range
     * POST /api/analytics/summary
     */
    async getAnalyticsSummary(req, res) {
        try {
            const {
                startDate,
                endDate,
                types = ['voting', 'payments', 'users'],
                eventId = null
            } = req.body;

            if (!startDate || !endDate) {
                return this.handleError(res, 'Start date and end date are required', 400);
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start >= end) {
                return this.handleError(res, 'Start date must be before end date', 400);
            }

            const summary = {};
            const promises = [];

            if (types.includes('voting')) {
                promises.push(
                    this.analyticsService.getVotingAnalytics({
                        period: 'daily',
                        startDate: start,
                        endDate: end,
                        eventId
                    }).then(result => ({ type: 'voting', result }))
                );
            }

            if (types.includes('payments')) {
                promises.push(
                    this.analyticsService.getPaymentAnalytics({
                        period: 'daily',
                        startDate: start,
                        endDate: end
                    }).then(result => ({ type: 'payments', result }))
                );
            }

            if (types.includes('users')) {
                promises.push(
                    this.analyticsService.getUserAnalytics({
                        period: 'daily',
                        startDate: start,
                        endDate: end
                    }).then(result => ({ type: 'users', result }))
                );
            }

            const results = await Promise.all(promises);

            results.forEach(({ type, result }) => {
                if (result.success) {
                    summary[type] = result.data;
                } else {
                    summary[type] = { error: result.error };
                }
            });

            return this.sendSuccess(res, summary, 'Analytics summary retrieved successfully');

        } catch (error) {
            console.error('Error in getAnalyticsSummary:', error);
            return this.handleError(res, 'Failed to retrieve analytics summary', 500);
        }
    }

    /**
     * Get comprehensive collection statistics
     * GET /api/analytics/collections
     */
    async getCollectionStatistics(req, res) {
        try {
            const {
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = req.query;

            const options = {
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                forceRefresh: forceRefresh === 'true'
            };

            const result = await this.analyticsService.getCollectionStatistics(options);

            if (!result.success) {
                return this.handleError(res, new Error(result.error), 500);
            }

            return this.sendSuccess(res, result.data, 'Collection statistics retrieved successfully');

        } catch (error) {
            console.error('Error in getCollectionStatistics:', error);
            return this.handleError(res, new Error('Failed to retrieve collection statistics'), 500);
        }
    }

    /**
     * Get trend analysis
     * GET /api/analytics/trends/analysis
     */
    async getTrendAnalysis(req, res) {
        try {
            const {
                startDate = null,
                endDate = null,
                granularity = 'daily',
                forceRefresh = false
            } = req.query;

            const options = {
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                granularity,
                forceRefresh: forceRefresh === 'true'
            };

            const result = await this.analyticsService.getTrendAnalysis(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Trend analysis retrieved successfully');

        } catch (error) {
            console.error('Error in getTrendAnalysis:', error);
            return this.handleError(res, 'Failed to retrieve trend analysis', 500);
        }
    }

    /**
     * Get descriptive statistics for a collection
     * GET /api/analytics/descriptive/:collection
     */
    async getDescriptiveStatistics(req, res) {
        try {
            const { collection } = req.params;
            const {
                startDate = null,
                endDate = null,
                forceRefresh = false
            } = req.query;

            const validCollections = ['users', 'events', 'votes', 'payments', 'candidates', 'categories'];
            if (!validCollections.includes(collection.toLowerCase())) {
                return this.handleError(res, `Invalid collection. Must be one of: ${validCollections.join(', ')}`, 400);
            }

            const options = {
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                forceRefresh: forceRefresh === 'true'
            };

            const result = await this.analyticsService.getDescriptiveStatistics(collection, options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, `Descriptive statistics for ${collection} retrieved successfully`);

        } catch (error) {
            console.error('Error in getDescriptiveStatistics:', error);
            return this.handleError(res, 'Failed to retrieve descriptive statistics', 500);
        }
    }

    /**
     * Get comprehensive analytics summary with KPIs
     * GET /api/analytics/summary/comprehensive
     */
    async getComprehensiveAnalyticsSummary(req, res) {
        try {
            const {
                period = 'weekly',
                includeComparisons = true,
                forceRefresh = false
            } = req.query;

            const options = {
                period,
                includeComparisons: includeComparisons !== 'false',
                forceRefresh: forceRefresh === 'true'
            };

            const result = await this.analyticsService.getAnalyticsSummary(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            return this.sendSuccess(res, result.data, 'Comprehensive analytics summary retrieved successfully');

        } catch (error) {
            console.error('Error in getComprehensiveAnalyticsSummary:', error);
            return this.handleError(res, 'Failed to retrieve comprehensive analytics summary', 500);
        }
    }

    /**
     * Get dashboard metrics with enhanced overview
     * GET /api/analytics/dashboard/metrics
     */
    async getDashboardMetrics(req, res) {
        try {
            const {
                includeInsights = true,
                includeTrends = true,
                forceRefresh = false
            } = req.query;

            // Get enhanced dashboard overview
            const dashboardResult = await this.analyticsService.getDashboardOverview();
            
            if (!dashboardResult.success) {
                return this.handleError(res, dashboardResult.error, 500);
            }

            let metrics = dashboardResult.data;

            // Add additional metrics if requested
            if (includeTrends === 'true') {
                const trendResult = await this.analyticsService.getTrendAnalysis({
                    granularity: 'daily',
                    forceRefresh: forceRefresh === 'true'
                });
                
                if (trendResult.success) {
                    metrics.trends = trendResult.data;
                }
            }

            return this.sendSuccess(res, metrics, 'Dashboard metrics retrieved successfully');

        } catch (error) {
            console.error('Error in getDashboardMetrics:', error);
            return this.handleError(res, 'Failed to retrieve dashboard metrics', 500);
        }
    }

    /**
     * Get analytics performance report
     * GET /api/analytics/performance
     */
    async getPerformanceReport(req, res) {
        try {
            const {
                period = 'monthly',
                includeComparisons = true
            } = req.query;

            // Get comprehensive analytics summary
            const summaryResult = await this.analyticsService.getAnalyticsSummary({
                period,
                includeComparisons: includeComparisons !== 'false',
                forceRefresh: true
            });

            if (!summaryResult.success) {
                return this.handleError(res, summaryResult.error, 500);
            }

            // Get collection statistics
            const collectionResult = await this.analyticsService.getCollectionStatistics({
                forceRefresh: true
            });

            const performanceReport = {
                period,
                generatedAt: new Date(),
                summary: summaryResult.data,
                collections: collectionResult.success ? collectionResult.data : null,
                recommendations: this._generateRecommendations(summaryResult.data)
            };

            return this.sendSuccess(res, performanceReport, 'Performance report generated successfully');

        } catch (error) {
            console.error('Error in getPerformanceReport:', error);
            return this.handleError(res, 'Failed to generate performance report', 500);
        }
    }

    /**
     * Generate recommendations based on analytics data
     * @param {Object} summaryData - Analytics summary data
     * @returns {Array} Array of recommendations
     */
    _generateRecommendations(summaryData) {
        const recommendations = [];

        // Growth recommendations
        if (summaryData.kpis?.userGrowthRate < 5) {
            recommendations.push({
                type: 'growth',
                priority: 'high',
                title: 'Improve User Acquisition',
                description: 'User growth rate is below 5%. Consider implementing referral programs or marketing campaigns.',
                metrics: { currentGrowthRate: summaryData.kpis.userGrowthRate }
            });
        }

        // Engagement recommendations
        if (summaryData.kpis?.votingParticipationRate < 30) {
            recommendations.push({
                type: 'engagement',
                priority: 'medium',
                title: 'Increase Voting Participation',
                description: 'Voting participation is below 30%. Consider sending reminders or improving event visibility.',
                metrics: { currentParticipationRate: summaryData.kpis.votingParticipationRate }
            });
        }

        // Revenue recommendations
        if (summaryData.kpis?.paymentSuccessRate < 90) {
            recommendations.push({
                type: 'revenue',
                priority: 'high',
                title: 'Improve Payment Success Rate',
                description: 'Payment success rate is below 90%. Review payment flow and address common failure points.',
                metrics: { currentSuccessRate: summaryData.kpis.paymentSuccessRate }
            });
        }

        // System health recommendations
        if (summaryData.kpis?.systemHealthScore < 80) {
            recommendations.push({
                type: 'system',
                priority: 'high',
                title: 'Address System Health Issues',
                description: 'System health score is below 80. Review system performance and address identified issues.',
                metrics: { currentHealthScore: summaryData.kpis.systemHealthScore }
            });
        }

        return recommendations;
    }

    /**
     * Convert data to CSV format
     * @param {Array|Object} data - Data to convert
     * @returns {String} CSV formatted string
     */
    convertToCSV(data) {
        if (!data) return '';
        
        // Handle array of objects
        if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]);
            const csvHeaders = headers.join(',');
            
            const csvRows = data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes in values
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            );
            
            return [csvHeaders, ...csvRows].join('\n');
        }
        
        // Handle single object
        if (typeof data === 'object' && data !== null) {
            const entries = Object.entries(data);
            return entries.map(([key, value]) => `${key},${value}`).join('\n');
        }
        
        return String(data);
    }

    /**
     * Get event participation analytics
     * GET /api/analytics/events/participation
     */
    async getEventParticipationAnalytics(req, res) {
        try {
            const { startDate, endDate, format } = req.query;

            const options = {};
            if (startDate) options.startDate = startDate;
            if (endDate) options.endDate = endDate;

            const result = await this.analyticsService.getEventParticipationAnalytics(options);

            if (!result.success) {
                return this.handleError(res, result.error, 500);
            }

            // Handle different output formats
            if (format === 'csv') {
                const csvData = this._convertToCSV(result.data);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="event-participation-analytics.csv"');
                return res.send(csvData);
            }

            return this.sendSuccess(res, result.data, 'Event participation analytics retrieved successfully', {
                cached: result.cached,
                metadata: result.metadata
            });

        } catch (error) {
            console.error('Error in getEventParticipationAnalytics:', error);
            return this.handleError(res, new Error('Failed to retrieve event participation analytics'), 500);
        }
    }
}

export default AnalyticsController;
