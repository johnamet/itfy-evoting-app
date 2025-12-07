/**
 * Analytics Service
 * Handles business logic for analytics processing with real-time updates.
 */

import BaseService from './BaseService.js';
import AnalyticsRepository from '../repositories/AnalyticsRepository.js';
import CacheService from './CacheService.js';
import mongoose from 'mongoose';

class AnalyticsService extends BaseService {
    constructor() {
        super();
        this.repository = new AnalyticsRepository();
        this.cachePrefix = 'analytics:';
        this.defaultCacheTTL = 3600000; // 1 hour
        this.changeStreams = new Map();
        this.changeStreamsInitialized = false;
    }

    async setupChangeStreams() {
        try {
            // Check if database is connected
            if (mongoose.connection.readyState !== 1) {
                console.log('Database not connected, skipping change streams setup');
                return;
            }

            // Check if already initialized
            if (this.changeStreamsInitialized) {
                return;
            }

            const db = mongoose.connection.db;
            if (!db) {
                console.log('Database instance not available, skipping change streams setup');
                return;
            }

            ['votes', 'payments'].forEach(collection => {
                try {
                    const stream = db.collection(collection).watch([], { fullDocument: 'updateLookup' });
                    if (stream && typeof stream.on === 'function') {
                        stream.on('change', (change) => this.handleChangeStream(change, collection));
                        stream.on('error', (error) => {
                            console.error(`Change stream error for ${collection}:`, error);
                            this.changeStreams.delete(collection);
                        });
                        this.changeStreams.set(collection, stream);
                        console.log(`Change stream setup for ${collection} collection`);
                    }
                } catch (error) {
                    console.error(`Failed to setup change stream for ${collection}:`, error);
                }
            });

            this.changeStreamsInitialized = true;
        } catch (error) {
            console.error('Error setting up change streams:', error);
        }
    }

    handleChangeStream(change, collection) {
        if (change.operationType === 'insert' || change.operationType === 'update') {
            this.updateIncrementalAnalytics(collection, change.fullDocument);
        }
    }

    async updateIncrementalAnalytics(collection, doc) {
        // Ensure change streams are set up
        await this.setupChangeStreams();

        const now = new Date();
        const period = 'hourly';
        const references = collection === 'votes' ? { event: doc.event } : {};
        let analytics = await this.repository.findFreshOrCreate(collection === 'votes' ? 'voting' : 'payments', period, references);
        if (analytics.status === 'computing' || analytics.isExpired) {
            await this.computeAndUpdate(analytics, now, now);
        } else {
            await this.incrementalUpdate(analytics, doc);
        }
    }

    async incrementalUpdate(analytics, doc) {
        const data = analytics.data[analytics.type];
        if (analytics.type === 'voting') {
            data.totalVotes += 1;
            data.uniqueVoters = new Set([...(data.uniqueVoters || []), doc.voter.email]).size;
        } else if (analytics.type === 'payments') {
            data.totalTransactions += 1;
            if (doc.status === 'success') data.totalRevenue += doc.finalAmount;
        }
        analytics.metadata.computedAt = new Date();
        await analytics.save();
        CacheService.set(`${this.cachePrefix}${analytics.type}:${analytics.period}`, data, this.defaultCacheTTL);
    }

    async computeAndUpdate(analytics, startDate, endDate) {
        // Map analytics types to repository method names
        const methodMap = {
            'voting': 'computeVotingAnalytics',
            'payments': 'computePaymentAnalytics', // Note: singular 'Payment' in repository
            'overview': 'computeOverviewAnalytics',
            'anomaly': 'computeAnomalyAnalytics',
            'forecasts': 'computeForecasts'
        };

        const method = methodMap[analytics.type];
        if (!method || !this.repository[method]) {
            throw new Error(`Analytics method for type '${analytics.type}' not found`);
        }

        const data = await this.repository[method](startDate, endDate, analytics.references.event);
        Object.assign(analytics, data);
        // await analytics.markCompleted(data.metadata.computationTime);
        CacheService.set(`${this.cachePrefix}${analytics.type}:${analytics.period}`, analytics.data[analytics.type], this.defaultCacheTTL);
    }

    async getDashboardOverview(options = {}) {
        try {
            const { period = 'daily' } = options;
            // Initialize change streams if not already done
            await this.setupChangeStreams();

            const cacheKey = `${this.cachePrefix}dashboard:overview`;
            let overview = CacheService.get(cacheKey);
            if (overview) return overview;
            const {start, end} = this.getDateRange(period)
            overview = await this.repository.computeOverviewAnalytics(start, end);
            CacheService.set(cacheKey, overview.data.overview, this.defaultCacheTTL);
            return overview.data.overview;
        } catch (error) {
            console.error('Error getting dashboard overview:', error);
            throw error;
        }
    }

    async getVotingAnalytics(options = {}) {
        try {
            const { period = 'daily', eventId = null, startDate = null, endDate = null, forceRefresh = false } = options;
            const cacheKey = `${this.cachePrefix}voting:${period}:${eventId || 'all'}`;
            if (!forceRefresh) {
                const cached = await CacheService.get(cacheKey);
                if (cached) return cached;
            }

            const references = eventId ? { event: eventId } : {};
            let analytics = await this.repository.findFreshOrCreate('voting', period, references);
            if (analytics.status === 'computing' || analytics.isExpired || forceRefresh) {
                const { start, end } = this.getDateRange(period, startDate, endDate);
                await this.computeAndUpdate(analytics, start, end);
            }
            return analytics.data.voting;
        } catch (error) {
            console.error('Error getting voting analytics:', error);
            throw error;
        }
    }

    async getPaymentAnalytics(options = {}) {
        try {
            const { period = 'daily', startDate = null, endDate = null, forceRefresh = false } = options;
            const cacheKey = `${this.cachePrefix}payments:${period}`;
            if (!forceRefresh) {
                const cached = CacheService.get(cacheKey);
                if (cached) return cached;
            }

            let analytics = await this.repository.findFreshOrCreate('payments', period);
            if (analytics.status === 'computing' || analytics.isExpired || forceRefresh) {
                const { start, end } = this.getDateRange(period, startDate, endDate);
                await this.computeAndUpdate(analytics, start, end);
            }
            return analytics.data.payments;
        } catch (error) {
            console.error('Error getting payments analytics:', error);
            throw error;
        }
    }

    async getAnomalyAnalytics(options = {}) {
        try {
            const { period = 'daily', startDate = null, endDate = null } = options;
            const cacheKey = `${this.cachePrefix}anomalies:${period}`;
            let cached = await CacheService.get(cacheKey);
            if (cached) return cached;

            const { start, end } = this.getDateRange(period, startDate, endDate);
            const analytics = await this.repository.computeAnomalyAnalytics(start, end);
            CacheService.set(cacheKey, analytics.data.anomalies, this.defaultCacheTTL);
            return analytics.data.anomalies;
        } catch (error) {
            console.error('Error getting anomaly analytics:', error);
            throw error;
        }
    }

    async getForecasts(options = {}) {
        try {
            const { period = 'monthly', startDate = null, endDate = null } = options;
            const cacheKey = `${this.cachePrefix}forecasts:${period}`;
            let cached = CacheService.get(cacheKey);
            if (cached) return cached;

            const { start, end } = this.getDateRange(period, startDate, endDate);
            const analytics = await this.repository.computeForecasts(start, end);
            CacheService.set(cacheKey, analytics.data.forecasts, this.defaultCacheTTL);
            return analytics.data.forecasts;
        } catch (error) {
            console.error('Error getting forecasts:', error);
            throw error;
        }
    }

    getDateRange(period, startDate, endDate) {
        const now = new Date();
        if (period === 'custom' && startDate && endDate) return { start: new Date(startDate), end: new Date(endDate) };
        const ranges = {
            hourly: { start: new Date(now.getTime() - 60 * 60 * 1000), end: now },
            daily: { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now },
            weekly: { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now },
            monthly: { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now },
            yearly: { start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), end: now },
            'all-time': { start: new Date(0), end: now }
        };
        return ranges[period] || ranges.daily;
    }

    /**
     * Clean up change streams
     */
    async cleanup() {
        try {
            for (const [collection, stream] of this.changeStreams) {
                if (stream && typeof stream.close === 'function') {
                    await stream.close();
                    console.log(`Closed change stream for ${collection}`);
                }
            }
            this.changeStreams.clear();
            this.changeStreamsInitialized = false;
        } catch (error) {
            console.error('Error cleaning up change streams:', error);
        }
    }
}

export default AnalyticsService;
