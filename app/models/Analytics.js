#!/usr/bin/env node
/**
 * Analytics model class for the application.
 * This file defines the Analytics class which extends the BaseModel class.
 * Stores pre-computed analytics data for efficient dashboard queries.
 * 
 * @module Analytics
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

/**
 * Analytics model class extending BaseModel.
 * Represents analytics data with various metrics and time-based aggregations.
 * 
 * @class
 * @extends BaseModel
 */
class Analytics extends BaseModel {
    /**
     * Initializes the Analytics schema with fields for different types of analytics data.
     */
    constructor() {
        const schemaDefinition = {
            // Analytics type and scope
            type: {
                type: String,
                required: true,
                enum: [
                    'overview',
                    'voting',
                    'events',
                    'payments',
                    'users',
                    'candidates',
                    'categories',
                    'geographic',
                    'trends'
                ]
            },
            
            // Time period for the analytics
            period: {
                type: String,
                required: true,
                enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly', 'all-time']
            },
            
            // Date range for the analytics
            dateRange: {
                start: {
                    type: Date,
                    required: true
                },
                end: {
                    type: Date,
                    required: true
                }
            },
            
            // Reference entities (optional)
            references: {
                event: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Event',
                    required: false
                },
                category: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Category',
                    required: false
                },
                candidate: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Candidate',
                    required: false
                },
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: false
                }
            },
            
            // Analytics data
            data: {
                // Overview metrics
                overview: {
                    totalUsers: { type: Number, default: 0 },
                    totalEvents: { type: Number, default: 0 },
                    totalVotes: { type: Number, default: 0 },
                    totalRevenue: { type: Number, default: 0 },
                    activeEvents: { type: Number, default: 0 },
                    completedEvents: { type: Number, default: 0 },
                    totalCandidates: { type: Number, default: 0 },
                    totalCategories: { type: Number, default: 0 }
                },
                
                // Voting metrics
                voting: {
                    totalVotes: { type: Number, default: 0 },
                    uniqueVoters: { type: Number, default: 0 },
                    averageVotesPerVoter: { type: Number, default: 0 },
                    votingRate: { type: Number, default: 0 },
                    peakVotingHour: { type: Number, default: 0 },
                    votesPerHour: [{ hour: Number, votes: Number }],
                    topCandidates: [{
                        candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
                        votes: Number,
                        percentage: Number
                    }],
                    categoryBreakdown: [{
                        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
                        votes: Number,
                        percentage: Number
                    }]
                },
                
                // Event metrics
                events: {
                    totalEvents: { type: Number, default: 0 },
                    activeEvents: { type: Number, default: 0 },
                    completedEvents: { type: Number, default: 0 },
                    upcomingEvents: { type: Number, default: 0 },
                    averageParticipation: { type: Number, default: 0 },
                    averageDuration: { type: Number, default: 0 },
                    topEvents: [{
                        event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
                        votes: Number,
                        participants: Number,
                        revenue: Number
                    }],
                    eventsByStatus: [{
                        status: String,
                        count: Number
                    }]
                },
                
                // Payment metrics
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
                        topCoupons: [{
                            coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
                            usage: Number,
                            discount: Number
                        }]
                    }
                },
                
                // User metrics
                users: {
                    totalUsers: { type: Number, default: 0 },
                    newUsers: { type: Number, default: 0 },
                    activeUsers: { type: Number, default: 0 },
                    userGrowthRate: { type: Number, default: 0 },
                    averageSessionDuration: { type: Number, default: 0 },
                    usersByRole: [{
                        role: String,
                        count: Number
                    }],
                    registrationTrend: [{
                        date: Date,
                        count: Number
                    }],
                    topActiveUsers: [{
                        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                        activities: Number,
                        lastActive: Date
                    }]
                },
                
                // Geographic metrics
                geographic: {
                    totalLocations: { type: Number, default: 0 },
                    topCountries: [{
                        country: String,
                        votes: Number,
                        users: Number
                    }],
                    topCities: [{
                        city: String,
                        country: String,
                        votes: Number,
                        users: Number
                    }],
                    votingByLocation: [{
                        location: String,
                        coordinates: {
                            lat: Number,
                            lng: Number
                        },
                        votes: Number,
                        events: Number
                    }]
                },
                
                // Trend data
                trends: {
                    votingTrend: [{
                        date: Date,
                        votes: Number,
                        uniqueVoters: Number
                    }],
                    revenueTrend: [{
                        date: Date,
                        revenue: Number,
                        transactions: Number
                    }],
                    userGrowthTrend: [{
                        date: Date,
                        newUsers: Number,
                        totalUsers: Number
                    }],
                    eventTrend: [{
                        date: Date,
                        newEvents: Number,
                        activeEvents: Number
                    }]
                }
            },
            
            // Metadata
            metadata: {
                computedAt: {
                    type: Date,
                    default: Date.now
                },
                computationTime: {
                    type: Number, // milliseconds
                    default: 0
                },
                dataPoints: {
                    type: Number,
                    default: 0
                },
                version: {
                    type: String,
                    default: '1.0'
                }
            },
            
            // Cache control
            expiresAt: {
                type: Date,
                required: true,
                default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            },
            
            // Status
            status: {
                type: String,
                enum: ['computing', 'completed', 'failed', 'expired'],
                default: 'computing'
            }
        };

        super(schemaDefinition, { collection: 'analytics' });
    }

    /**
     * Returns the Mongoose schema with additional indexes and methods.
     * @returns {mongoose.Schema} The constructed schema.
     */
    getSchema() {
        const schema = super.getSchema();

        // Indexes for efficient queries
        schema.index({ type: 1, period: 1 });
        schema.index({ 'dateRange.start': 1, 'dateRange.end': 1 });
        schema.index({ 'references.event': 1 });
        schema.index({ 'references.category': 1 });
        schema.index({ 'references.candidate': 1 });
        schema.index({ status: 1 });
        schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

        // Compound indexes for common queries
        schema.index({ type: 1, period: 1, 'references.event': 1 });
        schema.index({ type: 1, status: 1, expiresAt: 1 });

        // Virtual for checking if analytics is expired
        schema.virtual('isExpired').get(function() {
            return new Date() > this.expiresAt;
        });

        // Virtual for checking if analytics is fresh
        schema.virtual('isFresh').get(function() {
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
            return this.metadata.computedAt > hourAgo && this.status === 'completed';
        });

        // Static method to find analytics by type and period
        schema.statics.findByTypeAndPeriod = function(type, period, options = {}) {
            const query = { type, period, status: 'completed' };
            
            if (options.event) query['references.event'] = options.event;
            if (options.category) query['references.category'] = options.category;
            if (options.candidate) query['references.candidate'] = options.candidate;
            if (options.user) query['references.user'] = options.user;
            
            return this.findOne(query).sort({ 'metadata.computedAt': -1 });
        };

        // Static method to find fresh analytics or create placeholder
        schema.statics.findFreshOrCreate = async function(type, period, references = {}) {
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
                // Create placeholder for background computation
                analytics = new this({
                    type,
                    period,
                    references,
                    dateRange: {
                        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                        end: new Date()
                    },
                    status: 'computing'
                });
                await analytics.save();
            }

            return analytics;
        };

        // Instance method to mark as completed
        schema.methods.markCompleted = function(computationTime = 0) {
            this.status = 'completed';
            this.metadata.computedAt = new Date();
            this.metadata.computationTime = computationTime;
            return this.save();
        };

        // Instance method to mark as failed
        schema.methods.markFailed = function() {
            this.status = 'failed';
            return this.save();
        };

        return schema;
    }
}

export default mongoose.model('Analytics', new Analytics().getSchema());
