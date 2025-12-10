/**
 * AnalyticsService
 * 
 * Handles platform analytics, event tracking, user activity analysis,
 * and comprehensive reporting across the voting platform.
 * 
 * @extends BaseService
 * @module services/AnalyticsService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class AnalyticsService extends BaseService {
    constructor(repositories) {
        super(repositories, {
            serviceName: 'AnalyticsService',
            primaryRepository: 'analytics',
        });
    }

    /**
     * Track event (create analytics record)
     */
    async trackEvent(analyticsData) {
        return this.runInContext('trackEvent', async () => {
            // Validate required fields
            this.validateRequiredFields(analyticsData, [
                'eventType', 'entityType', 'entityId'
            ]);

            const record = await this.repo('analytics').create({
                ...analyticsData,
                timestamp: new Date(),
            });

            return this.handleSuccess({ record }, 'Event tracked successfully');
        });
    }

    /**
     * Get platform overview statistics
     */
    async getPlatformOverview() {
        return this.runInContext('getPlatformOverview', async () => {
            // Total counts
            const totalUsers = await this.repo('user').count({ status: 'active' });
            const totalEvents = await this.repo('event').count();
            const activeEvents = await this.repo('event').count({ status: 'active' });
            const totalVotes = await this.repo('vote').count();
            const totalCandidates = await this.repo('candidate').count();

            // Revenue statistics
            const revenueData = await this.repo('payment').aggregate([
                { $match: { status: 'successful' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                    },
                },
            ]);

            // Recent activity
            const recentVotes = await this.repo('vote').find(
                {},
                { limit: 5, sort: { createdAt: -1 } }
            );

            const recentEvents = await this.repo('event').find(
                {},
                { limit: 5, sort: { createdAt: -1 } }
            );

            return this.handleSuccess({
                overview: {
                    users: {
                        total: totalUsers,
                    },
                    events: {
                        total: totalEvents,
                        active: activeEvents,
                    },
                    votes: {
                        total: totalVotes,
                    },
                    candidates: {
                        total: totalCandidates,
                    },
                    revenue: {
                        total: revenueData[0]?.totalRevenue || 0,
                        transactions: revenueData[0]?.transactionCount || 0,
                    },
                    recentActivity: {
                        votes: recentVotes,
                        events: recentEvents,
                    },
                },
            }, 'Platform overview retrieved successfully');
        });
    }

    /**
     * Get user activity analytics
     */
    async getUserActivityAnalytics(userId, period = 'month') {
        return this.runInContext('getUserActivityAnalytics', async () => {
            const dateRange = this.getDateRange(period);

            // Votes cast
            const voteCount = await this.repo('vote').count({
                voterId: userId,
                createdAt: { $gte: dateRange.start, $lte: dateRange.end },
            });

            // Events created (if organizer)
            const eventCount = await this.repo('event').count({
                createdBy: userId,
                createdAt: { $gte: dateRange.start, $lte: dateRange.end },
            });

            // Payments made
            const paymentData = await this.repo('payment').aggregate([
                {
                    $match: {
                        userId,
                        status: 'successful',
                        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalSpent: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                    },
                },
            ]);

            // Activity timeline
            const activityTimeline = await this.repo('activity').aggregate([
                {
                    $match: {
                        userId,
                        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        actions: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            return this.handleSuccess({
                userId,
                period,
                analytics: {
                    votes: voteCount,
                    eventsCreated: eventCount,
                    payments: {
                        total: paymentData[0]?.totalSpent || 0,
                        count: paymentData[0]?.transactionCount || 0,
                    },
                    activityTimeline,
                },
            }, 'User analytics retrieved successfully');
        });
    }

    /**
     * Get event performance analytics
     */
    async getEventPerformanceAnalytics(eventId) {
        return this.runInContext('getEventPerformanceAnalytics', async () => {
            const event = await this.repo('event').findById(eventId);

            if (!event) {
                throw new Error('Event not found');
            }

            // Vote statistics
            const totalVotes = await this.repo('vote').count({ eventId });
            const uniqueVoters = await this.repo('vote').distinct('voterId', { eventId });

            // Voting timeline
            const votingTimeline = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d %H:00',
                                date: '$createdAt',
                            },
                        },
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Candidate performance
            const candidatePerformance = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { votes: -1 } },
            ]);

            // Get candidate details
            const candidateIds = candidatePerformance.map(c => c._id);
            const candidates = await this.repo('candidate').find({
                _id: { $in: candidateIds },
            });

            const candidateMap = new Map(
                candidates.map(c => [c._id.toString(), c])
            );

            const enrichedPerformance = candidatePerformance.map((c, index) => {
                const candidate = candidateMap.get(c._id.toString());
                return {
                    rank: index + 1,
                    candidateId: c._id,
                    name: candidate?.name,
                    photo: candidate?.photo,
                    votes: c.votes,
                    percentage: totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(2) : 0,
                };
            });

            // Revenue statistics
            const revenueData = await this.repo('payment').aggregate([
                { $match: { eventId, status: 'successful' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        transactions: { $sum: 1 },
                    },
                },
            ]);

            // Engagement metrics
            const candidateCount = await this.repo('candidate').count({
                eventId,
                status: 'approved',
            });

            const participationRate = totalVotes > 0 && uniqueVoters.length > 0
                ? ((totalVotes / uniqueVoters.length) * 100).toFixed(2)
                : 0;

            return this.handleSuccess({
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    startDate: event.startDate,
                    endDate: event.endDate,
                },
                analytics: {
                    votes: {
                        total: totalVotes,
                        uniqueVoters: uniqueVoters.length,
                        timeline: votingTimeline,
                    },
                    candidates: {
                        total: candidateCount,
                        performance: enrichedPerformance,
                    },
                    revenue: {
                        total: revenueData[0]?.totalRevenue || 0,
                        transactions: revenueData[0]?.transactions || 0,
                    },
                    engagement: {
                        participationRate,
                    },
                },
            }, 'Event analytics retrieved successfully');
        });
    }

    /**
     * Get revenue analytics
     */
    async getRevenueAnalytics(filters = {}) {
        return this.runInContext('getRevenueAnalytics', async () => {
            const query = { status: 'successful' };

            // Apply date range
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            // Total revenue
            const totalRevenue = await this.repo('payment').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                        average: { $avg: '$amount' },
                    },
                },
            ]);

            // Revenue by event
            const byEvent = await this.repo('payment').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$eventId',
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 },
                    },
                },
                { $sort: { revenue: -1 } },
                { $limit: 10 },
            ]);

            // Revenue over time
            const overTime = await this.repo('payment').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Revenue by payment method (if tracked)
            const byMethod = await this.repo('payment').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$metadata.paymentMethod',
                        revenue: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
            ]);

            return this.handleSuccess({
                analytics: {
                    total: totalRevenue[0]?.total || 0,
                    transactions: totalRevenue[0]?.count || 0,
                    average: totalRevenue[0]?.average || 0,
                    byEvent,
                    overTime,
                    byMethod,
                },
            }, 'Revenue analytics retrieved successfully');
        });
    }

    /**
     * Get voting trends analytics
     */
    async getVotingTrends(period = 'week') {
        return this.runInContext('getVotingTrends', async () => {
            const dateRange = this.getDateRange(period);

            // Votes over time
            const votesOverTime = await this.repo('vote').aggregate([
                {
                    $match: {
                        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Most active events
            const mostActiveEvents = await this.repo('vote').aggregate([
                {
                    $match: {
                        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    },
                },
                {
                    $group: {
                        _id: '$eventId',
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { votes: -1 } },
                { $limit: 5 },
            ]);

            // Peak voting hours
            const peakHours = await this.repo('vote').aggregate([
                {
                    $match: {
                        createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    },
                },
                {
                    $group: {
                        _id: {
                            $hour: '$createdAt',
                        },
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { votes: -1 } },
            ]);

            return this.handleSuccess({
                period,
                trends: {
                    votesOverTime,
                    mostActiveEvents,
                    peakHours,
                },
            }, 'Voting trends retrieved successfully');
        });
    }

    /**
     * Generate comprehensive report
     */
    async generateReport(reportType, filters = {}) {
        return this.runInContext('generateReport', async () => {
            let reportData = {};

            switch (reportType) {
                case 'platform':
                    reportData = await this.getPlatformOverview();
                    break;

                case 'revenue':
                    reportData = await this.getRevenueAnalytics(filters);
                    break;

                case 'voting':
                    reportData = await this.getVotingTrends(filters.period || 'month');
                    break;

                case 'event':
                    if (!filters.eventId) {
                        throw new Error('Event ID required for event report');
                    }
                    reportData = await this.getEventPerformanceAnalytics(filters.eventId);
                    break;

                case 'user':
                    if (!filters.userId) {
                        throw new Error('User ID required for user report');
                    }
                    reportData = await this.getUserActivityAnalytics(
                        filters.userId,
                        filters.period || 'month'
                    );
                    break;

                default:
                    throw new Error('Invalid report type');
            }

            return this.handleSuccess({
                reportType,
                generatedAt: new Date(),
                filters,
                data: reportData.data,
            }, 'Report generated successfully');
        });
    }

    /**
     * Get system health metrics
     */
    async getSystemHealthMetrics() {
        return this.runInContext('getSystemHealthMetrics', async () => {
            // Recent error rate (from activity logs)
            const recentErrors = await this.repo('activity').count({
                action: 'error',
                createdAt: { $gte: this.addDays(new Date(), -1) },
            });

            // Active sessions (approximate from recent activities)
            const activeSessions = await this.repo('activity').distinct('userId', {
                createdAt: { $gte: this.addHours(new Date(), -1) }, // Last hour
            });

            // Database counts
            const dbMetrics = {
                users: await this.repo('user').count(),
                events: await this.repo('event').count(),
                votes: await this.repo('vote').count(),
                payments: await this.repo('payment').count(),
            };

            return this.handleSuccess({
                health: {
                    status: 'healthy',
                    errorRate: recentErrors,
                    activeSessions: activeSessions.length,
                    database: dbMetrics,
                    timestamp: new Date(),
                },
            }, 'System health metrics retrieved');
        });
    }
}
