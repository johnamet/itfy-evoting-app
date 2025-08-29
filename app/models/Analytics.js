/**
 * Analytics model class for the application.
 * Defines the Analytics schema with enhanced metrics, anomalies, and forecasts.
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

class Analytics extends BaseModel {
    constructor() {
        const schemaDefinition = {
            type: {
                type: String,
                required: true,
                enum: ['overview', 'voting', 'payments', 'users', 'events', 'geographic', 'anomalies', 'forecasts', 'retention']
            },
            period: {
                type: String,
                required: true,
                enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'all-time', 'custom']
            },
            dateRange: {
                start: { type: Date, required: true },
                end: { type: Date, required: true }
            },
            references: {
                event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: false },
                category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },
                candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: false },
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
                bundleId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoteBundle', required: false }
            },
            data: {
                overview: {
                    totalUsers: { type: Number, default: 0 },
                    totalEvents: { type: Number, default: 0 },
                    totalVotes: { type: Number, default: 0 },
                    totalRevenue: { type: Number, default: 0 },
                    activeEvents: { type: Number, default: 0 },
                    completedEvents: { type: Number, default: 0 },
                    totalCandidates: { type: Number, default: 0 },
                    totalCategories: { type: Number, default: 0 },
                    overallParticipationRate: { type: Number, default: 0 },
                    systemHealthScore: { type: Number, default: 0 },
                    ciParticipationRate: { type: Object, default: { lower: 0, upper: 0 } }
                },
                voting: {
                    totalVotes: { type: Number, default: 0 },
                    uniqueVoters: { type: Number, default: 0 },
                    averageVotesPerVoter: { type: Number, default: 0 },
                    votingRate: { type: Number, default: 0 },
                    peakVotingHour: { type: Number, default: 0 },
                    votesPerHour: [{ hour: Number, votes: Number, ci: { lower: Number, upper: Number } }],
                    topCandidates: [{
                        candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
                        votes: Number,
                        percentage: Number,
                        pValue: Number
                    }],
                    categoryBreakdown: [{
                        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
                        votes: Number,
                        percentage: Number,
                        pValue: Number
                    }],
                    anomalyScore: { type: Number, default: 0 }
                },
                payments: {
                    totalRevenue: { type: Number, default: 0 },
                    totalTransactions: { type: Number, default: 0 },
                    successfulPayments: { type: Number, default: 0 },
                    failedPayments: { type: Number, default: 0 },
                    averageTransactionValue: { type: Number, default: 0 },
                    revenueGrowth: { type: Number, default: 0 },
                    paymentMethods: [{
                        method: String,
                        count: Number,
                        revenue: Number
                    }],
                    couponUsage: {
                        totalCouponsUsed: { type: Number, default: 0 },
                        totalDiscount: { type: Number, default: 0 },
                        redemptionRate: { type: Number, default: 0 },
                        topCoupons: [{
                            coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
                            usage: Number,
                            discount: Number
                        }]
                    },
                    conversionFunnel: { type: Object, default: { paidToVotes: 0 } },
                    fraudIndicator: { type: Number, default: 0 }
                },
                users: {
                    activeUsers: { type: Number, default: 0 },
                    retentionRate: { type: Number, default: 0 },
                    sessionAvg: { type: Number, default: 0 },
                    roleBreakdown: [{ role: String, count: Number }]
                },
                events: {
                    totalEvents: { type: Number, default: 0 },
                    activeEvents: { type: Number, default: 0 },
                    completedEvents: { type: Number, default: 0 },
                    averageParticipation: { type: Number, default: 0 },
                    averageDuration: { type: Number, default: 0 },
                    geographicHeatmap: [{ region: String, votes: Number }]
                },
                geographic: {
                    topCountries: [{ country: String, votes: Number, users: Number }],
                    topCities: [{ city: String, country: String, votes: Number, users: Number }],
                    votingByLocation: [{
                        location: String,
                        coordinates: { lat: Number, lng: Number },
                        votes: Number,
                        events: Number
                    }]
                },
                anomalies: [{
                    type: String,
                    details: { eventId: mongoose.Schema.Types.ObjectId, timestamp: Date, zScore: Number }
                }],
                forecasts: {
                    revenueTrend: [{
                        period: String,
                        predicted: Number,
                        ciLow: Number,
                        ciHigh: Number
                    }],
                    voteTrend: [{
                        period: String,
                        predicted: Number,
                        ciLow: Number,
                        ciHigh: Number
                    }]
                },
                retention: {
                    cohortData: [{ period: String, retentionRate: Number, retained: Number }],
                    avgRetentionRate: { type: Number, default: 0 }
                }
            },
            metadata: {
                computedAt: { type: Date, default: Date.now },
                computationTime: { type: Number, default: 0 },
                dataPoints: { type: Number, default: 0 },
                version: { type: String, default: '2.0' },
                confidenceLevel: { type: Number, default: 95 },
                anomalyFlags: { type: Number, default: 0 },
                differentialPrivacyApplied: { type: Boolean, default: false }
            },
            expiresAt: {
                type: Date,
                required: true,
                default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
            },
            status: {
                type: String,
                enum: ['computing', 'completed', 'failed', 'expired'],
                default: 'computing'
            }
        };

        super(schemaDefinition, { collection: 'analytics', timestamps: true });

        // Indexes
        this.schema.index({ type: 1, period: 1 });
        this.schema.index({ 'dateRange.start': 1, 'dateRange.end': 1 });
        this.schema.index({ 'references.event': 1 });
        this.schema.index({ status: 1, expiresAt: 1 }, { expireAfterSeconds: 0 });
        this.schema.index({ 'data.anomalyScore': -1 });
        this.schema.index({ 'metadata.computedAt': -1 });

        // Virtuals
        this.schema.virtual('isAnomalous').get(function() {
            return this.data.anomalies.length > 0 || this.data.voting.anomalyScore > 0.5;
        });
        this.schema.virtual('isFresh').get(function() {
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
            return this.metadata.computedAt > hourAgo && this.status === 'completed';
        });

        // Static methods
        this.schema.statics.findByTypeAndPeriod = function(type, period, options = {}) {
            const query = { type, period, status: 'completed' };
            if (options.event) query['references.event'] = options.event;
            if (options.category) query['references.category'] = options.category;
            return this.findOne(query).sort({ 'metadata.computedAt': -1 });
        };

        this.schema.statics.findFreshOrCreate = async function(type, period, references = {}) {
            let analytics = await this.findOne({
                type,
                period,
                ...Object.keys(references).reduce((acc, key) => {
                    acc[`references.${key}`] = references[key];
                    return acc;
                }, {}),
                status: 'completed',
                expiresAt: { $gt: new Date() }
            }).sort({ 'metadata.computedAt': -1 });

            if (!analytics) {
                analytics = new this({
                    type,
                    period,
                    references,
                    dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
                    status: 'computing'
                });
                await analytics.save();
            }
            return analytics;
        };
    }

    getSchema() {
        return this.schema;
    }
}

export default mongoose.model('Analytics', new Analytics().getSchema());