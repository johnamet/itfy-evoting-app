#!/usr/bin/env node
/**
 * Analytics Repository
 * 
 * Handles database operations for analytics data.
 * Provides methods for creating, retrieving, and managing analytics records.
 */

import BaseRepository from './BaseRepository.js';
import Analytics from '../models/Analytics.js';
import Vote from '../models/Vote.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Candidate from '../models/Candidate.js';
import Category from '../models/Category.js';
import Activity from '../models/Activity.js';
import Form from '../models/Form.js';

class AnalyticsRepository extends BaseRepository {
    constructor() {
        super(Analytics);
    }

    /**
     * Find analytics by type and period
     * @param {string} type - Analytics type
     * @param {string} period - Time period
     * @param {Object} options - Additional options
     * @returns {Promise<Object|null>}
     */
    async findByTypeAndPeriod(type, period, options = {}) {
        return await this.model.findByTypeAndPeriod(type, period, options);
    }

    /**
     * Find fresh analytics or create placeholder
     * @param {string} type - Analytics type
     * @param {string} period - Time period
     * @param {Object} references - Reference entities
     * @returns {Promise<Object>}
     */
    async findFreshOrCreate(type, period, references = {}) {
        return await this.model.findFreshOrCreate(type, period, references);
    }

    /**
     * Compute overview analytics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @returns {Promise<Object>}
     */
    async computeOverviewAnalytics(startDate, endDate) {
        const startTime = Date.now();

        try {
            // Get basic counts
            const [
                totalUsers,
                totalEvents,
                totalVotes,
                totalCandidates,
                totalCategories,
                activeEvents,
                completedEvents,
                totalRevenue
            ] = await Promise.all([
                User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Event.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Vote.countDocuments({ votedAt: { $gte: startDate, $lte: endDate } }),
                Candidate.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Category.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Event.countDocuments({
                    status: 'active',
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate }
                }),
                Event.countDocuments({
                    status: 'completed',
                    endDate: { $gte: startDate, $lte: endDate }
                }),
                Payment.aggregate([
                    {
                        $match: {
                            status: 'success',
                            paidAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$finalAmount' }
                        }
                    }
                ]).then(result => result[0]?.total || 0)
            ]);

            const overviewData = {
                totalUsers,
                totalEvents,
                totalVotes,
                totalRevenue,
                activeEvents,
                completedEvents,
                totalCandidates,
                totalCategories
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'overview',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { overview: overviewData },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: Object.keys(overviewData).length
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing overview analytics:', error);
            throw error;
        }
    }

    /**
     * Compute voting analytics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @param {string} eventId - Optional event ID filter
     * @returns {Promise<Object>}
     */
    async computeVotingAnalytics(startDate, endDate, eventId = null) {
        const startTime = Date.now();

        try {
            const matchStage = {
                votedAt: { $gte: startDate, $lte: endDate }
            };
            if (eventId) matchStage.event = eventId;

            // Get voting metrics
            const [votingStats, topCandidates, categoryBreakdown, votesPerHour] = await Promise.all([
                // Basic voting statistics
                Vote.aggregate([
                    { $match: matchStage },
                              // Expand bundles
                    { $unwind: "$voteBundles" },

                    // Join with bundle collection to fetch vote value
                    {
                        $lookup: {
                            from: "voteBundles",
                            localField: "voteBundles",
                            foreignField: "_id",
                            as: "bundle"
                        }
                    },
                    { $unwind: "$bundle" },

                    {
                        $group: {
                            _id: null,
                            totalVotes: { $sum: '$bundle.votes' },
                            uniqueVoters: { $addToSet: '$voter.email' }
                        }
                    },
                    {
                        $project: {
                            totalVotes: 1,
                            uniqueVoters: { $size: '$uniqueVoters' },
                            averageVotesPerVoter: {
                                $cond: {
                                    if: { $gt: [{ $size: '$uniqueVoters' }, 0] },
                                    then: { $divide: ['$totalVotes', { $size: '$uniqueVoters' }] },
                                    else: 0
                                }
                            }
                        }
                    }
                ]),

                // Top candidates by votes
                Vote.aggregate([
                    { $match: matchStage },

                    // Expand bundles
                    { $unwind: "$voteBundles" },

                    // Join with bundle collection to fetch vote value
                    {
                        $lookup: {
                            from: "voteBundles",
                            localField: "voteBundles",
                            foreignField: "_id",
                            as: "bundle"
                        }
                    },
                    { $unwind: "$bundle" },

                    // Group by candidate and sum bundle.votes
                    {
                        $group: {
                            _id: "$candidate",
                            totalVotes: { $sum: "$bundle.votes" }
                        }
                    },

                    { $sort: { totalVotes: -1 } },
                    { $limit: 10 },

                    // Lookup candidate details
                    {
                        $lookup: {
                            from: "candidates",
                            localField: "_id",
                            foreignField: "_id",
                            as: "candidateInfo"
                        }
                    },

                    // Final projection
                    {
                        $project: {
                            candidate: "$_id",
                            totalVotes: 1,
                            candidateName: { $arrayElemAt: ["$candidateInfo.name", 0] }
                        }
                    }
                ]),
                // Category breakdown
                Vote.aggregate([
                    { $match: matchStage },

                    // Expand bundles
                    { $unwind: "$voteBundles" },

                    // Join with bundles collection to get vote counts
                    {
                        $lookup: {
                            from: "voteBundles",
                            localField: "voteBundles",
                            foreignField: "_id",
                            as: "bundle"
                        }
                    },
                    { $unwind: "$bundle" },

                    // Group by category and sum bundle votes -> votes per category
                    {
                        $group: {
                            _id: "$category",
                            votes: { $sum: "$bundle.votes" }
                        }
                    },

                    { $sort: { votes: -1 } },

                    // Compute grand total of votes across all categories
                    {
                        $group: {
                            _id: null,
                            categories: { $push: "$$ROOT" },
                            totalVotes: { $sum: "$votes" }
                        }
                    },

                    // Unwind categories back out, but with totalVotes included
                    { $unwind: "$categories" },

                    {
                        $project: {
                            category: "$categories._id",
                            votes: "$categories.votes",
                            totalVotes: 1
                        }
                    },

                    // Lookup category details
                    {
                        $lookup: {
                            from: "categories",
                            localField: "category",
                            foreignField: "_id",
                            as: "categoryInfo"
                        }
                    },
                    { $unwind: "$categoryInfo" },

                    // Final projection
                    {
                        $project: {
                            category: 1,
                            votes: 1,
                            totalVotes: 1,
                            categoryName: "$categoryInfo.name"
                        }
                    }
                ]),
                // Votes per hour
                Vote.aggregate([
                    { $match: matchStage },

                    // Expand bundles
                    { $unwind: "$voteBundles" },

                    // Join with bundles collection to get vote counts
                    {
                        $lookup: {
                            from: "voteBundles",
                            localField: "voteBundles",
                            foreignField: "_id",
                            as: "bundle"
                        }
                    },
                    { $unwind: "$bundle" },

                    // Group by hour of votedAt and sum bundle votes
                    {
                        $group: {
                            _id: { $hour: "$votedAt" },
                            totalVotes: { $sum: "$bundle.votes" }
                        }
                    },

                    { $sort: { "_id": 1 } },

                    // Final projection
                    {
                        $project: {
                            hour: "$_id",
                            votes: "$totalVotes",
                            _id: 0
                        }
                    }
                ])
            ]);

            // Calculate percentages for top candidates
            const totalVotes = votingStats[0]?.totalVotes || 0;
            const topCandidatesWithPercentage = topCandidates.map(candidate => ({
                ...candidate,
                votes: candidate.totalVotes,
                percentage: totalVotes > 0 ? (candidate.totalVotes / totalVotes) * 100 : 0
            }));

            // Calculate percentages for categories
            const categoryBreakdownWithPercentage = categoryBreakdown.map(category => ({
                ...category,
                percentage: totalVotes > 0 ? (category.votes / totalVotes) * 100 : 0
            }));

            // Find peak voting hour
            const peakVotingHour = votesPerHour.reduce((peak, current) =>
                current.votes > (peak?.votes || 0) ? current : peak, null)?.hour || 0;

            const votingData = {
                totalVotes: votingStats[0]?.totalVotes || 0,
                uniqueVoters: votingStats[0]?.uniqueVoters || 0,
                averageVotesPerVoter: votingStats[0]?.averageVotesPerVoter || 0,
                votingRate: totalVotes > 0 ? (votingStats[0]?.uniqueVoters || 0) / totalVotes : 0,
                peakVotingHour,
                votesPerHour,
                topCandidates: topCandidatesWithPercentage,
                categoryBreakdown: categoryBreakdownWithPercentage
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'voting',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                references: eventId ? { event: eventId } : {},
                data: { voting: votingData },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: totalVotes
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing voting analytics:', error);
            throw error;
        }
    }

    /**
     * Compute payment analytics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @returns {Promise<Object>}
     */
    async computePaymentAnalytics(startDate, endDate) {
        const startTime = Date.now();

        try {
            const [paymentStats, paymentMethods, couponStats] = await Promise.all([
                // Basic payment statistics
                Payment.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            revenue: {
                                $sum: {
                                    $cond: [{ $eq: ['$status', 'success'] }, '$finalAmount', 0]
                                }
                            }
                        }
                    }
                ]),

                // Payment methods breakdown
                Payment.aggregate([
                    {
                        $match: {
                            status: 'success',
                            paidAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: '$paystackData.channel',
                            count: { $sum: 1 },
                            revenue: { $sum: '$finalAmount' }
                        }
                    },
                    { $sort: { revenue: -1 } }
                ]),

                // Coupon usage statistics
                Payment.aggregate([
                    {
                        $match: {
                            status: 'success',
                            coupon: { $exists: true, $ne: null },
                            paidAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: '$coupon',
                            usage: { $sum: 1 },
                            discount: { $sum: '$discountAmount' }
                        }
                    },
                    { $sort: { usage: -1 } },
                    { $limit: 10 },
                    {
                        $lookup: {
                            from: 'coupons',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'couponInfo'
                        }
                    }
                ])
            ]);

            // Process payment statistics
            const successfulPayments = paymentStats.find(stat => stat._id === 'success') || { count: 0, revenue: 0 };
            const failedPayments = paymentStats.find(stat => stat._id === 'failed') || { count: 0, revenue: 0 };
            const totalTransactions = paymentStats.reduce((sum, stat) => sum + stat.count, 0);
            const totalRevenue = paymentStats.reduce((sum, stat) => sum + stat.revenue, 0);

            const paymentData = {
                totalRevenue,
                totalTransactions,
                successfulPayments: successfulPayments.count,
                failedPayments: failedPayments.count,
                averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
                revenueGrowth: 0, // This would need historical comparison
                paymentMethods: paymentMethods.map(method => ({
                    method: method._id || 'unknown',
                    count: method.count,
                    revenue: method.revenue
                })),
                couponUsage: {
                    totalCouponsUsed: couponStats.length,
                    totalDiscount: couponStats.reduce((sum, coupon) => sum + coupon.discount, 0),
                    topCoupons: couponStats.map(coupon => ({
                        coupon: coupon._id,
                        usage: coupon.usage,
                        discount: coupon.discount
                    }))
                }
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'payments',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { payments: paymentData },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: totalTransactions
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing payment analytics:', error);
            throw error;
        }
    }

    /**
     * Compute user analytics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @returns {Promise<Object>}
     */
    async computeUserAnalytics(startDate, endDate) {
        const startTime = Date.now();

        try {
            const [userStats, usersByRole, topActiveUsers, registrationTrend] = await Promise.all([
                // Basic user statistics
                User.aggregate([
                    {
                        $facet: {
                            total: [
                                { $match: { createdAt: { $lte: endDate } } },
                                { $count: 'count' }
                            ],
                            new: [
                                { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
                                { $count: 'count' }
                            ],
                            active: [
                                { $match: { lastLogin: { $gte: startDate, $lte: endDate } } },
                                { $count: 'count' }
                            ]
                        }
                    }
                ]),

                // Users by role
                User.aggregate([
                    { $match: { createdAt: { $lte: endDate } } },
                    {
                        $lookup: {
                            from: 'roles',
                            localField: 'role',
                            foreignField: '_id',
                            as: 'roleInfo'
                        }
                    },
                    {
                        $group: {
                            _id: { $arrayElemAt: ['$roleInfo.name', 0] },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: -1 } }
                ]),

                // Top active users
                Activity.aggregate([
                    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
                    {
                        $group: {
                            _id: '$user',
                            activities: { $sum: 1 },
                            lastActive: { $max: '$createdAt' }
                        }
                    },
                    { $sort: { activities: -1 } },
                    { $limit: 10 },
                    {
                        $lookup: {
                            from: 'users',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'userInfo'
                        }
                    }
                ]),

                // Registration trend (daily)
                User.aggregate([
                    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$createdAt'
                                }
                            },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id': 1 } },
                    {
                        $project: {
                            date: { $dateFromString: { dateString: '$_id' } },
                            count: 1,
                            _id: 0
                        }
                    }
                ])
            ]);

            const stats = userStats[0];
            const totalUsers = stats.total[0]?.count || 0;
            const newUsers = stats.new[0]?.count || 0;
            const activeUsers = stats.active[0]?.count || 0;

            const userData = {
                totalUsers,
                newUsers,
                activeUsers,
                userGrowthRate: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0,
                averageSessionDuration: 0, // Would need session tracking
                usersByRole: usersByRole.map(role => ({
                    role: role._id || 'unknown',
                    count: role.count
                })),
                registrationTrend,
                topActiveUsers: topActiveUsers.map(user => ({
                    user: user._id,
                    activities: user.activities,
                    lastActive: user.lastActive
                }))
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'users',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { users: userData },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: totalUsers
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing user analytics:', error);
            throw error;
        }
    }

    /**
     * Get dashboard overview stats
     * @returns {Promise<Object>}
     */
    async getDashboardOverview() {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

            // Try to get cached overview analytics
            let analytics = await this.findByTypeAndPeriod('overview', 'daily');

            if (!analytics || analytics.isExpired) {
                // Compute fresh analytics
                const analyticsData = await this.computeOverviewAnalytics(yesterday, now);

                if (analytics) {
                    // Update existing record
                    Object.assign(analytics, analyticsData);
                    await analytics.save();
                } else {
                    // Create new record
                    analytics = new this.model(analyticsData);
                    await analytics.save();
                }
            }

            return analytics.data.overview;

        } catch (error) {
            console.error('Error getting dashboard overview:', error);
            throw error;
        }
    }

    /**
     * Get collection statistics with optional caching
     * @param {Object} options - Query options
     * @returns {Promise<Object>}
     */
    async getCollectionStatistics(options = {}) {
        try {
            const { startDate, endDate } = options;

            // Convert string dates to Date objects if needed
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            // For now, directly compute the statistics
            // In a production environment, you might want to cache these results
            const stats = await this.computeCollectionStatistics(start, end);

            console.log(stats)
            return stats.data.collections;

        } catch (error) {
            console.error('Error getting collection statistics:', error);
            throw error;
        }
    }

    /**
     * Compute comprehensive collection statistics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @returns {Promise<Object>}
     */
    async computeCollectionStatistics(startDate, endDate) {
        const startTime = Date.now();

        try {
            // Get statistics for all collections
            const [
                userStats,
                eventStats,
                voteStats,
                candidateStats,
                categoryStats,
                paymentStats,
                activityStats
            ] = await Promise.all([
                this._getUserCollectionStats(startDate, endDate),
                this._getEventCollectionStats(startDate, endDate),
                this._getVoteCollectionStats(startDate, endDate),
                this._getCandidateCollectionStats(startDate, endDate),
                this._getCategoryCollectionStats(startDate, endDate),
                this._getPaymentCollectionStats(startDate, endDate),
                this._getActivityCollectionStats(startDate, endDate)
            ]);

            const collectionStats = {
                users: userStats,
                events: eventStats,
                votes: voteStats,
                candidates: candidateStats,
                categories: categoryStats,
                payments: paymentStats,
                activities: activityStats,
                summary: {
                    totalCollections: 7,
                    totalDocuments: userStats.total + eventStats.total + voteStats.total +
                        candidateStats.total + categoryStats.total + paymentStats.total + activityStats.total,
                    growthRate: this._calculateOverallGrowthRate([userStats, eventStats, voteStats, candidateStats, categoryStats, paymentStats, activityStats])
                }
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'collections',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { collections: collectionStats },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: collectionStats.summary.totalDocuments
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing collection statistics:', error);
            throw error;
        }
    }

    /**
     * Compute trend analysis for multiple metrics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @param {string} granularity - Time granularity (daily, weekly, monthly)
     * @returns {Promise<Object>}
     */
    async computeTrendAnalysis(startDate, endDate, granularity = 'daily') {
        const startTime = Date.now();

        try {
            const dateFormat = this._getDateFormat(granularity);
            const [votingTrend, revenueTrend, userGrowthTrend, eventTrend] = await Promise.all([
                this._getVotingTrend(startDate, endDate, dateFormat),
                this._getRevenueTrend(startDate, endDate, dateFormat),
                this._getUserGrowthTrend(startDate, endDate, dateFormat),
                this._getEventTrend(startDate, endDate, dateFormat)
            ]);

            // Calculate growth rates and trends
            const trendData = {
                voting: {
                    data: votingTrend,
                    growthRate: this._calculateGrowthRate(votingTrend, 'votes'),
                    trend: this._calculateTrendDirection(votingTrend, 'votes'),
                    volatility: this._calculateVolatility(votingTrend, 'votes')
                },
                revenue: {
                    data: revenueTrend,
                    growthRate: this._calculateGrowthRate(revenueTrend, 'revenue'),
                    trend: this._calculateTrendDirection(revenueTrend, 'revenue'),
                    volatility: this._calculateVolatility(revenueTrend, 'revenue')
                },
                users: {
                    data: userGrowthTrend,
                    growthRate: this._calculateGrowthRate(userGrowthTrend, 'newUsers'),
                    trend: this._calculateTrendDirection(userGrowthTrend, 'newUsers'),
                    volatility: this._calculateVolatility(userGrowthTrend, 'newUsers')
                },
                events: {
                    data: eventTrend,
                    growthRate: this._calculateGrowthRate(eventTrend, 'newEvents'),
                    trend: this._calculateTrendDirection(eventTrend, 'newEvents'),
                    volatility: this._calculateVolatility(eventTrend, 'newEvents')
                }
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'trends',
                period: granularity,
                dateRange: { start: startDate, end: endDate },
                data: { trends: trendData },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: votingTrend.length + revenueTrend.length + userGrowthTrend.length + eventTrend.length
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing trend analysis:', error);
            throw error;
        }
    }

    /**
     * Get enhanced dashboard overview with more detailed metrics
     * @returns {Promise<Object>}
     */
    async getEnhancedDashboardOverview() {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

            // Get current and historical data for comparison
            const [currentStats, weeklyStats, monthlyStats, recentActivity] = await Promise.all([
                this.computeOverviewAnalytics(yesterday, now),
                this.computeOverviewAnalytics(lastWeek, yesterday),
                this.computeOverviewAnalytics(lastMonth, lastWeek),
                this._getRecentActivity(24) // Last 24 hours
            ]);

            const current = currentStats.data.overview;
            const weekly = weeklyStats.data.overview;
            const monthly = monthlyStats.data.overview;

            // Calculate growth rates
            const growthRates = {
                users: this._calculatePercentageChange(current.totalUsers, weekly.totalUsers),
                events: this._calculatePercentageChange(current.totalEvents, weekly.totalEvents),
                votes: this._calculatePercentageChange(current.totalVotes, weekly.totalVotes),
                revenue: this._calculatePercentageChange(current.totalRevenue, weekly.totalRevenue)
            };

            // Enhanced overview with trends and insights
            const enhancedOverview = {
                ...current,
                growthRates,
                trends: {
                    weekly: {
                        users: weekly.totalUsers,
                        events: weekly.totalEvents,
                        votes: weekly.totalVotes,
                        revenue: weekly.totalRevenue
                    },
                    monthly: {
                        users: monthly.totalUsers,
                        events: monthly.totalEvents,
                        votes: monthly.totalVotes,
                        revenue: monthly.totalRevenue
                    }
                },
                recentActivity,
                insights: this._generateInsights(current, weekly, monthly, growthRates),
                lastUpdated: now
            };

            return enhancedOverview;

        } catch (error) {
            console.error('Error getting enhanced dashboard overview:', error);
            throw error;
        }
    }

    // Helper methods for collection statistics
    async _getUserCollectionStats(startDate, endDate) {
        const [total, newInPeriod, activeInPeriod, byRole] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            User.countDocuments({ lastLogin: { $gte: startDate, $lte: endDate } }),
            User.aggregate([
                {
                    $lookup: {
                        from: 'roles',
                        localField: 'role',
                        foreignField: '_id',
                        as: 'roleInfo'
                    }
                },
                {
                    $group: {
                        _id: { $arrayElemAt: ['$roleInfo.name', 0] },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        return {
            total,
            newInPeriod,
            activeInPeriod,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            distribution: byRole,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000)))
        };
    }

    async _getEventCollectionStats(startDate, endDate) {
        const [total, newInPeriod, activeInPeriod, byStatus, eventParticipation] = await Promise.all([
            Event.countDocuments(),
            Event.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            Event.countDocuments({
                status: 'active',
                startDate: { $lte: endDate },
                endDate: { $gte: startDate }
            }),
            Event.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),
            // Get event participation data through registration forms
            Event.aggregate([
                {
                    $match: {
                        registrations: { $exists: true, $ne: null }
                    }
                },
                {
                    $lookup: {
                        from: 'forms',
                        localField: 'registrations',
                        foreignField: '_id',
                        as: 'registrationForm'
                    }
                },
                {
                    $unwind: {
                        path: '$registrationForm',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        status: 1,
                        startDate: 1,
                        endDate: 1,
                        submissionCount: {
                            $size: { $ifNull: ['$registrationForm.submissions', []] }
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalParticipants: { $sum: '$submissionCount' },
                        eventsWithRegistration: { $sum: 1 },
                        averageParticipantsPerEvent: { $avg: '$submissionCount' },
                        eventParticipationDetails: {
                            $push: {
                                eventId: '$_id',
                                eventTitle: '$title',
                                participantCount: '$submissionCount',
                                eventStatus: '$status'
                            }
                        }
                    }
                }
            ])
        ]);

        // Extract participation data
        const participationData = eventParticipation[0] || {
            totalParticipants: 0,
            eventsWithRegistration: 0,
            averageParticipantsPerEvent: 0,
            eventParticipationDetails: []
        };

        return {
            total,
            newInPeriod,
            activeInPeriod,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            distribution: byStatus,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))),
            eventParticipation: {
                totalParticipants: participationData.totalParticipants,
                eventsWithRegistration: participationData.eventsWithRegistration,
                averageParticipantsPerEvent: Math.round(participationData.averageParticipantsPerEvent || 0),
                participationRate: total > 0 ? (participationData.eventsWithRegistration / total) * 100 : 0,
                topParticipatedEvents: participationData.eventParticipationDetails
                    .sort((a, b) => b.participantCount - a.participantCount)
                    .slice(0, 5)
            }
        };
    }

    async _getVoteCollectionStats(startDate, endDate) {
        const [total, newInPeriod, uniqueVoters, byCategory] = await Promise.all([
            Vote.countDocuments(),
            Vote.countDocuments({ votedAt: { $gte: startDate, $lte: endDate } }),
            Vote.distinct('voter.email', { votedAt: { $gte: startDate, $lte: endDate } }),
            Vote.aggregate([
                { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                }
            ])
        ]);

        return {
            total,
            newInPeriod,
            uniqueVoters: uniqueVoters.length,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            distribution: byCategory,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))),
            averagePerVoter: uniqueVoters.length > 0 ? newInPeriod / uniqueVoters.length : 0
        };
    }

    async _getCandidateCollectionStats(startDate, endDate) {
        const [total, newInPeriod, withVotes, topCandidates] = await Promise.all([
            Candidate.countDocuments(),
            Candidate.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            Vote.distinct('candidate', { votedAt: { $gte: startDate, $lte: endDate } }),
            Vote.aggregate([
                { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$candidate',
                        votes: { $sum: 1 }
                    }
                },
                { $sort: { votes: -1 } },
                { $limit: 5 }
            ])
        ]);

        return {
            total,
            newInPeriod,
            withVotes: withVotes.length,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            topPerformers: topCandidates,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))),
            participationRate: total > 0 ? (withVotes.length / total) * 100 : 0
        };
    }

    async _getCategoryCollectionStats(startDate, endDate) {
        const [total, newInPeriod, withVotes, voteDistribution] = await Promise.all([
            Category.countDocuments(),
            Category.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            Vote.distinct('category', { votedAt: { $gte: startDate, $lte: endDate } }),
            Vote.aggregate([
                { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$category',
                        votes: { $sum: 1 }
                    }
                },
                { $sort: { votes: -1 } }
            ])
        ]);

        return {
            total,
            newInPeriod,
            withVotes: withVotes.length,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            voteDistribution,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))),
            participationRate: total > 0 ? (withVotes.length / total) * 100 : 0
        };
    }

    async _getPaymentCollectionStats(startDate, endDate) {
        const [total, newInPeriod, successful, totalRevenue] = await Promise.all([
            Payment.countDocuments(),
            Payment.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            Payment.countDocuments({
                status: 'success',
                paidAt: { $gte: startDate, $lte: endDate }
            }),
            Payment.aggregate([
                {
                    $match: {
                        status: 'success',
                        paidAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$finalAmount' }
                    }
                }
            ])
        ]);

        return {
            total,
            newInPeriod,
            successful,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            successRate: newInPeriod > 0 ? (successful / newInPeriod) * 100 : 0,
            totalRevenue: totalRevenue[0]?.total || 0,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))),
            averageTransactionValue: successful > 0 ? (totalRevenue[0]?.total || 0) / successful : 0
        };
    }

    async _getActivityCollectionStats(startDate, endDate) {
        const [total, newInPeriod, uniqueUsers, byType] = await Promise.all([
            Activity.countDocuments(),
            Activity.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
            Activity.distinct('user', { createdAt: { $gte: startDate, $lte: endDate } }),
            Activity.aggregate([
                { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ])
        ]);

        return {
            total,
            newInPeriod,
            uniqueUsers: uniqueUsers.length,
            growthRate: total > 0 ? (newInPeriod / total) * 100 : 0,
            distribution: byType,
            averagePerDay: newInPeriod / Math.max(1, Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))),
            averagePerUser: uniqueUsers.length > 0 ? newInPeriod / uniqueUsers.length : 0
        };
    }

    // Helper methods for trend analysis
    _getDateFormat(granularity) {
        switch (granularity) {
            case 'daily': return '%Y-%m-%d';
            case 'weekly': return '%Y-%U';
            case 'monthly': return '%Y-%m';
            default: return '%Y-%m-%d';
        }
    }

    async _getVotingTrend(startDate, endDate, dateFormat) {
        return await Vote.aggregate([
            { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$votedAt' } },
                    votes: { $sum: 1 },
                    uniqueVoters: { $addToSet: '$voter.email' }
                }
            },
            {
                $project: {
                    date: { $dateFromString: { dateString: '$_id' } },
                    votes: 1,
                    uniqueVoters: { $size: '$uniqueVoters' },
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    async _getRevenueTrend(startDate, endDate, dateFormat) {
        return await Payment.aggregate([
            {
                $match: {
                    status: 'success',
                    paidAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$paidAt' } },
                    revenue: { $sum: '$finalAmount' },
                    transactions: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: { $dateFromString: { dateString: '$_id' } },
                    revenue: 1,
                    transactions: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    async _getUserGrowthTrend(startDate, endDate, dateFormat) {
        return await User.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                    newUsers: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: { $dateFromString: { dateString: '$_id' } },
                    newUsers: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    async _getEventTrend(startDate, endDate, dateFormat) {
        return await Event.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
                    newEvents: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: { $dateFromString: { dateString: '$_id' } },
                    newEvents: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    async _getRecentActivity(hours = 24) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        return await Activity.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    lastActivity: { $max: '$createdAt' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
    }

    // Statistical helper methods
    _calculateGrowthRate(data, field) {
        if (data.length < 2) return 0;
        const first = data[0][field] || 0;
        const last = data[data.length - 1][field] || 0;
        return first > 0 ? ((last - first) / first) * 100 : 0;
    }

    _calculateTrendDirection(data, field) {
        if (data.length < 2) return 'stable';
        const values = data.map(d => d[field] || 0);
        const trend = values.reduce((acc, val, idx) => {
            if (idx === 0) return acc;
            return acc + (val > values[idx - 1] ? 1 : val < values[idx - 1] ? -1 : 0);
        }, 0);

        if (trend > 0) return 'increasing';
        if (trend < 0) return 'decreasing';
        return 'stable';
    }

    _calculateVolatility(data, field) {
        if (data.length < 2) return 0;
        const values = data.map(d => d[field] || 0);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    _calculatePercentageChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }

    _calculateOverallGrowthRate(collectionStats) {
        const totalGrowth = collectionStats.reduce((sum, stats) => sum + stats.growthRate, 0);
        return totalGrowth / collectionStats.length;
    }

    _generateInsights(current, weekly, monthly, growthRates) {
        const insights = [];

        // Growth insights
        if (growthRates.users > 10) {
            insights.push({
                type: 'positive',
                category: 'growth',
                message: `User growth is strong at ${growthRates.users.toFixed(1)}% this week`
            });
        } else if (growthRates.users < -5) {
            insights.push({
                type: 'warning',
                category: 'growth',
                message: `User growth is declining at ${growthRates.users.toFixed(1)}% this week`
            });
        }

        // Revenue insights
        if (growthRates.revenue > 15) {
            insights.push({
                type: 'positive',
                category: 'revenue',
                message: `Revenue is growing strongly at ${growthRates.revenue.toFixed(1)}% this week`
            });
        }

        // Voting insights
        if (growthRates.votes > 20) {
            insights.push({
                type: 'positive',
                category: 'engagement',
                message: `Voting activity is up ${growthRates.votes.toFixed(1)}% this week`
            });
        }

        // Event insights
        if (current.activeEvents > 5) {
            insights.push({
                type: 'info',
                category: 'events',
                message: `${current.activeEvents} events are currently active`
            });
        }

        return insights;
    }

    /**
     * Clean up expired analytics
     * @returns {Promise<number>} Number of deleted records
     */
    async cleanupExpired() {
        try {
            const result = await this.model.deleteMany({
                $or: [
                    { status: 'expired' },
                    { expiresAt: { $lt: new Date() } },
                    { status: 'failed', createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
                ]
            });

            return result.deletedCount;
        } catch (error) {
            console.error('Error cleaning up expired analytics:', error);
            throw error;
        }
    }

    /**
     * Compute detailed event participation analytics
     * @param {Date} startDate - Start date for computation
     * @param {Date} endDate - End date for computation
     * @returns {Promise<Object>}
     */
    async computeEventParticipationAnalytics(startDate, endDate) {
        const startTime = Date.now();

        try {
            // Get detailed event participation data
            const [participationByEvent, participationTrends, topEvents] = await Promise.all([
                // Participation data for each event
                Event.aggregate([
                    {
                        $match: {
                            registrations: { $exists: true, $ne: null },
                            createdAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $lookup: {
                            from: 'forms',
                            localField: 'registrations',
                            foreignField: '_id',
                            as: 'registrationForm'
                        }
                    },
                    {
                        $unwind: {
                            path: '$registrationForm',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            status: 1,
                            startDate: 1,
                            endDate: 1,
                            location: 1,
                            submissionCount: {
                                $size: { $ifNull: ['$registrationForm.submissions', []] }
                            },
                            formTitle: '$registrationForm.title',
                            formStatus: '$registrationForm.status'
                        }
                    }
                ]),

                // Participation trends over time
                Event.aggregate([
                    {
                        $match: {
                            registrations: { $exists: true, $ne: null },
                            createdAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $lookup: {
                            from: 'forms',
                            localField: 'registrations',
                            foreignField: '_id',
                            as: 'registrationForm'
                        }
                    },
                    {
                        $unwind: {
                            path: '$registrationForm',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $group: {
                            _id: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$createdAt'
                                }
                            },
                            totalParticipants: {
                                $sum: { $size: { $ifNull: ['$registrationForm.submissions', []] } }
                            },
                            eventsCount: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]),

                // Top participated events
                Event.aggregate([
                    {
                        $match: {
                            registrations: { $exists: true, $ne: null }
                        }
                    },
                    {
                        $lookup: {
                            from: 'forms',
                            localField: 'registrations',
                            foreignField: '_id',
                            as: 'registrationForm'
                        }
                    },
                    {
                        $unwind: {
                            path: '$registrationForm',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            status: 1,
                            location: 1,
                            submissionCount: {
                                $size: { $ifNull: ['$registrationForm.submissions', []] }
                            }
                        }
                    },
                    { $sort: { submissionCount: -1 } },
                    { $limit: 10 }
                ])
            ]);

            // Calculate summary statistics
            const totalParticipants = participationByEvent.reduce((sum, event) => sum + event.submissionCount, 0);
            const totalEventsWithRegistration = participationByEvent.length;
            const averageParticipantsPerEvent = totalEventsWithRegistration > 0 ? totalParticipants / totalEventsWithRegistration : 0;

            const participationData = {
                summary: {
                    totalParticipants,
                    totalEventsWithRegistration,
                    averageParticipantsPerEvent: Math.round(averageParticipantsPerEvent * 100) / 100
                },
                eventDetails: participationByEvent.map(event => ({
                    eventId: event._id,
                    eventTitle: event.title,
                    eventStatus: event.status,
                    eventLocation: event.location,
                    participantCount: event.submissionCount,
                    registrationFormTitle: event.formTitle,
                    registrationFormStatus: event.formStatus,
                    eventStartDate: event.startDate,
                    eventEndDate: event.endDate
                })),
                participationTrends: participationTrends.map(trend => ({
                    date: trend._id,
                    totalParticipants: trend.totalParticipants,
                    eventsCount: trend.eventsCount,
                    averagePerEvent: trend.eventsCount > 0 ? Math.round((trend.totalParticipants / trend.eventsCount) * 100) / 100 : 0
                })),
                topEvents: topEvents.map(event => ({
                    eventId: event._id,
                    eventTitle: event.title,
                    eventStatus: event.status,
                    eventLocation: event.location,
                    participantCount: event.submissionCount
                }))
            };

            const computationTime = Date.now() - startTime;

            return {
                type: 'eventParticipation',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { eventParticipation: participationData },
                metadata: {
                    computedAt: new Date(),
                    computationTime,
                    dataPoints: totalEventsWithRegistration
                },
                status: 'completed'
            };

        } catch (error) {
            console.error('Error computing event participation analytics:', error);
            throw error;
        }
    }
}

export default AnalyticsRepository;
