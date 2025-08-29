/**
 * Analytics Repository
 * Handles database operations for analytics data with enhanced aggregations.
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

    async findByTypeAndPeriod(type, period, options = {}) {
        return await this.model.findByTypeAndPeriod(type, period, options);
    }

    async findFreshOrCreate(type, period, references = {}) {
        return await this.model.findFreshOrCreate(type, period, references);
    }

    async computeOverviewAnalytics(startDate, endDate) {
        const startTime = Date.now();
        try {
            const [totalUsers, totalEvents, totalVotes, totalCandidates, totalCategories, activeEvents, completedEvents] = await Promise.all([
                User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Event.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Vote.countDocuments({ votedAt: { $gte: startDate, $lte: endDate } }),
                Candidate.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Category.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
                Event.countDocuments({ status: 'active', startDate: { $lte: endDate }, endDate: { $gte: startDate } }),
                Event.countDocuments({ status: 'completed', endDate: { $lte: endDate } })
            ]);

            const paymentAgg = await Payment.aggregate([
                { $match: { status: 'success', paidAt: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, totalRevenue: { $sum: '$finalAmount' } } }
            ]);
            const totalRevenue = paymentAgg[0]?.totalRevenue || 0;

            const votes = await Vote.countDocuments({ votedAt: { $gte: startDate, $lte: endDate } });
            const payments = await Payment.countDocuments({ paidAt: { $gte: startDate, $lte: endDate }, status: 'success' });
            const participationRate = payments > 0 ? (votes / payments) * 100 : 0;
            const ci = this.calculateConfidenceInterval(votes, payments);

            const overviewData = {
                totalUsers,
                totalEvents,
                totalVotes,
                totalRevenue,
                activeEvents,
                completedEvents,
                totalCandidates,
                totalCategories,
                overallParticipationRate: participationRate,
                ciParticipationRate: ci,
                systemHealthScore: this.calculateSystemHealthScore(totalEvents, activeEvents, completedEvents)
            };

            return {
                type: 'overview',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { overview: overviewData },
                metadata: {
                    computedAt: new Date(),
                    computationTime: Date.now() - startTime,
                    dataPoints: Object.keys(overviewData).length
                },
                status: 'completed'
            };
        } catch (error) {
            console.error('Error computing overview analytics:', error);
            throw error;
        }
    }

    async computeVotingAnalytics(startDate, endDate, eventId = null) {
        const startTime = Date.now();
        try {
            const matchStage = { votedAt: { $gte: startDate, $lte: endDate } };
            if (eventId) matchStage.event = eventId;

            const [votingStats, votesPerHour, topCandidates, categoryBreakdown] = await Promise.all([
                Vote.aggregate([
                    { $match: matchStage },
                    { $group: { _id: null, totalVotes: { $sum: 1 }, uniqueVoters: { $addToSet: '$voter.email' } } }
                ]),
                Vote.aggregate([
                    { $match: matchStage },
                    { $group: { _id: { $hour: '$votedAt' }, votes: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ]),
                Vote.aggregate([
                    { $match: matchStage },
                    { $group: { _id: '$candidate', votes: { $sum: 1 } } },
                    { $lookup: { from: 'candidates', localField: '_id', foreignField: '_id', as: 'candidate' } },
                    { $project: { candidate: { $arrayElemAt: ['$candidate', 0] }, votes: 1, percentage: { $multiply: [{ $divide: ['$votes', { $sum: '$votes' }] }, 100] } } },
                    { $sort: { votes: -1 } },
                    { $limit: 5 }
                ]),
                Vote.aggregate([
                    { $match: matchStage },
                    { $group: { _id: '$category', votes: { $sum: 1 } } },
                    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
                    { $project: { category: { $arrayElemAt: ['$category', 0] }, votes: 1, percentage: { $multiply: [{ $divide: ['$votes', { $sum: '$votes' }] }, 100] } } },
                    { $sort: { votes: -1 } }
                ])
            ]);

            const totalVotes = votingStats[0]?.totalVotes || 0;
            const uniqueVoters = votingStats[0]?.uniqueVoters?.length || 0;
            const anomalyScore = this.calculateAnomalyScore(votesPerHour);

            return {
                type: 'voting',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: {
                    voting: {
                        totalVotes,
                        uniqueVoters,
                        averageVotesPerVoter: uniqueVoters > 0 ? totalVotes / uniqueVoters : 0,
                        votingRate: uniqueVoters > 0 ? (totalVotes / uniqueVoters) * 100 : 0,
                        peakVotingHour: votesPerHour.reduce((max, curr) => max.votes > curr.votes ? max : curr, { votes: 0 })._id,
                        votesPerHour: votesPerHour.map(h => ({ hour: h._id, votes: h.votes, ci: this.calculateConfidenceInterval(h.votes, totalVotes / 24) })),
                        topCandidates: topCandidates.map(c => ({ candidate: c.candidate._id, votes: c.votes, percentage: c.percentage, pValue: this.calculatePValue(c.votes, totalVotes) })),
                        categoryBreakdown: categoryBreakdown.map(c => ({ category: c.category._id, votes: c.votes, percentage: c.percentage, pValue: this.calculatePValue(c.votes, totalVotes) })),
                        anomalyScore
                    }
                },
                metadata: { computedAt: new Date(), computationTime: Date.now() - startTime, dataPoints: totalVotes }
            };
        } catch (error) {
            console.error('Error computing voting analytics:', error);
            throw error;
        }
    }

    async computePaymentAnalytics(startDate, endDate) {
        const startTime = Date.now();
        try {
            const paymentAgg = await Payment.aggregate([
                { $match: { paidAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        total: { $sum: '$finalAmount' },
                        avg: { $avg: '$finalAmount' }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            const totalTransactions = paymentAgg.reduce((sum, p) => sum + p.count, 0);
            const totalRevenue = paymentAgg.find(p => p._id === 'success')?.total || 0;
            const successfulPayments = paymentAgg.find(p => p._id === 'success')?.count || 0;
            const failedPayments = paymentAgg.find(p => p._id === 'failed')?.count || 0;
            const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
            const conversionFunnel = await this.calculateConversionFunnel(startDate, endDate);

            const couponAgg = await Payment.aggregate([
                { $match: { paidAt: { $gte: startDate, $lte: endDate }, status: 'success' } },
                { $lookup: { from: 'couponusages', localField: '_id', foreignField: 'paymentId', as: 'coupons' } },
                {
                    $group: {
                        _id: null,
                        totalCouponsUsed: { $sum: { $size: '$coupons' } },
                        totalDiscount: { $sum: { $sum: '$coupons.discountAmount' } }
                    }
                }
            ]);
            const totalCouponsUsed = couponAgg[0]?.totalCouponsUsed || 0;
            const totalDiscount = couponAgg[0]?.totalDiscount || 0;
            const redemptionRate = totalCouponsUsed > 0 ? (totalDiscount / totalRevenue) * 100 : 0;
            const fraudIndicator = this.calculateFraudIndicator(failedPayments, totalTransactions);

            return {
                type: 'payments',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: {
                    payments: {
                        totalRevenue,
                        totalTransactions,
                        successfulPayments,
                        failedPayments,
                        averageTransactionValue,
                        revenueGrowth: this.calculateGrowthRate(totalRevenue, startDate, endDate),
                        paymentMethods: [],
                        couponUsage: { totalCouponsUsed, totalDiscount, redemptionRate, topCoupons: [] },
                        conversionFunnel,
                        fraudIndicator
                    }
                },
                metadata: { computedAt: new Date(), computationTime: Date.now() - startTime, dataPoints: totalTransactions }
            };
        } catch (error) {
            console.error('Error computing payment analytics:', error);
            throw error;
        }
    }

    async computeAnomalyAnalytics(startDate, endDate) {
        const startTime = Date.now();
        try {
            const voteAgg = await Vote.aggregate([
                { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d %H:00', date: '$votedAt' } }, votes: { $sum: 1 } } }
            ]);
            const anomalies = this.detectAnomalies(voteAgg.map(v => v.votes));

            return {
                type: 'anomalies',
                period: 'daily',
                dateRange: { start: startDate, end: endDate },
                data: { anomalies },
                metadata: { computedAt: new Date(), computationTime: Date.now() - startTime, anomalyFlags: anomalies.length }
            };
        } catch (error) {
            console.error('Error computing anomaly analytics:', error);
            throw error;
        }
    }

    async computeForecasts(startDate, endDate) {
        const startTime = Date.now();
        try {
            const revenueData = await Payment.aggregate([
                { $match: { status: 'success', paidAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), $lte: endDate } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
                        totalRevenue: { $sum: '$finalAmount' }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            const voteData = await Vote.aggregate([
                { $match: { votedAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), $lte: endDate } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$votedAt' } },
                        totalVotes: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            const revenueForecast = this.generateForecast(revenueData.map(d => d.totalRevenue));
            const voteForecast = this.generateForecast(voteData.map(d => d.totalVotes));

            return {
                type: 'forecasts',
                period: 'monthly',
                dateRange: { start: startDate, end: endDate },
                data: { forecasts: { revenueTrend: revenueForecast, voteTrend: voteForecast } },
                metadata: { computedAt: new Date(), computationTime: Date.now() - startTime }
            };
        } catch (error) {
            console.error('Error computing forecasts:', error);
            throw error;
        }
    }

    // Helper methods
    calculateConfidenceInterval(n, N) {
        if (N === 0) return { lower: 0, upper: 0 };
        const p = n / N;
        const z = 1.96; // 95% CI
        const se = Math.sqrt((p * (1 - p)) / N);
        const margin = z * se;
        return { lower: Math.max(0, p - margin), upper: Math.min(1, p + margin) };
    }

    calculatePValue(observed, total) {
        // Simplified chi-square p-value approximation
        const expected = total / 2;
        const chiSquare = Math.pow(observed - expected, 2) / expected;
        return chiSquare > 3.841 ? 0.05 : 1; // 95% significance threshold
    }

    calculateAnomalyScore(data) {
        const mean = data.reduce((sum, d) => sum + d.votes, 0) / data.length;
        const stdDev = Math.sqrt(data.reduce((sum, d) => sum + Math.pow(d.votes - mean, 2), 0) / data.length);
        return data.some(d => (d.votes - mean) / stdDev > 3) ? 0.8 : 0; // 3σ threshold
    }

    detectAnomalies(data) {
        const mean = data.reduce((sum, d) => sum + d, 0) / data.length;
        const stdDev = Math.sqrt(data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / data.length);
        return data.filter(d => (d - mean) / stdDev > 3).map(d => ({ type: 'vote_spike', details: { timestamp: new Date(), zScore: (d - mean) / stdDev } }));
    }

    async calculateGrowthRate(current, startDate, endDate) {
        const prevPeriod = new Date(startDate.getTime() - (endDate - startDate));
        const prevRevenue = await Payment.aggregate([
            { $match: { status: 'success', paidAt: { $gte: prevPeriod, $lt: startDate } } },
            { $group: { _id: null, total: { $sum: '$finalAmount' } } }
        ]);
        return prevRevenue[0]?.total > 0 ? ((current - prevRevenue[0].total) / prevRevenue[0].total) * 100 : 0;
    }

    calculateConversionFunnel(startDate, endDate) {
        return Payment.aggregate([
            { $match: { paidAt: { $gte: startDate, $lte: endDate } } },
            { $lookup: { from: 'votes', localField: '_id', foreignField: 'paymentId', as: 'votes' } },
            {
                $group: {
                    _id: null,
                    totalPayments: { $sum: 1 },
                    votesCast: { $sum: { $size: '$votes' } }
                }
            }
        ]).then(result => ({ paidToVotes: result[0]?.votesCast / result[0]?.totalPayments || 0 }));
    }

    calculateFraudIndicator(failed, total) {
        const rate = total > 0 ? failed / total : 0;
        return rate > 0.1 ? 0.9 : rate * 10; // Scale 0-1, flag if >10%
    }

    calculateSystemHealthScore(totalEvents, activeEvents, completedEvents) {
        return totalEvents > 0 ? (activeEvents / totalEvents * 50 + completedEvents / totalEvents * 50) : 0;
    }

    generateForecast(data) {
        if (data.length < 3) return [];
        const x = Array.from({ length: data.length }, (_, i) => i);
        const y = data;
        const n = data.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const forecast = [];
        for (let i = 1; i <= 3; i++) {
            const pred = slope * (n + i - 1) + intercept;
            forecast.push({ period: `next_${i}_month`, predicted: Math.max(0, pred), ciLow: pred * 0.9, ciHigh: pred * 1.1 });
        }
        return forecast;
    }
}

export default AnalyticsRepository;