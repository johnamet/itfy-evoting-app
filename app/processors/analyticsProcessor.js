import { analyticsQueue } from '../config/queue.js';
import AnalyticsService from '../services/AnalyticsService.js';
import logger from '../utils/Logger.js';

// Analytics job processor
analyticsQueue.process('track-user-activity', async (job) => {
    const { userId, activity, metadata } = job.data;
    
    try {
        logger.info(`Tracking user activity for user ${userId}: ${activity.type}`);
        
        await AnalyticsService.trackUserActivity(userId, activity, metadata);
        
        return { success: true, message: 'User activity tracked successfully' };
    } catch (error) {
        logger.error('Failed to track user activity:', error);
        throw error;
    }
});

analyticsQueue.process('generate-analytics-report', async (job) => {
    const { reportType, timeRange, filters } = job.data;
    
    try {
        logger.info(`Generating ${reportType} analytics report for ${timeRange}`);
        
        const report = await AnalyticsService.generateReport(reportType, timeRange, filters);
        
        return { success: true, report, message: 'Analytics report generated' };
    } catch (error) {
        logger.error('Failed to generate analytics report:', error);
        throw error;
    }
});

analyticsQueue.process('calculate-engagement-metrics', async (job) => {
    const { eventId, timeRange } = job.data;
    
    try {
        logger.info(`Calculating engagement metrics for event ${eventId}`);
        
        const metrics = await AnalyticsService.calculateEngagementMetrics(eventId, timeRange);
        
        return { success: true, metrics, message: 'Engagement metrics calculated' };
    } catch (error) {
        logger.error('Failed to calculate engagement metrics:', error);
        throw error;
    }
});

analyticsQueue.process('update-dashboard-metrics', async (job) => {
    const { dashboardId, metrics } = job.data;
    
    try {
        logger.info(`Updating dashboard metrics for dashboard ${dashboardId}`);
        
        await AnalyticsService.updateDashboardMetrics(dashboardId, metrics);
        
        return { success: true, message: 'Dashboard metrics updated' };
    } catch (error) {
        logger.error('Failed to update dashboard metrics:', error);
        throw error;
    }
});

analyticsQueue.process('process-event-analytics', async (job) => {
    const { eventId, analyticsData } = job.data;
    
    try {
        logger.info(`Processing event analytics for event ${eventId}`);
        
        const result = await AnalyticsService.processEventAnalytics(eventId, analyticsData);
        
        return { success: true, result, message: 'Event analytics processed' };
    } catch (error) {
        logger.error('Failed to process event analytics:', error);
        throw error;
    }
});

analyticsQueue.process('cleanup-old-analytics', async (job) => {
    const { retentionDays = 90 } = job.data;
    
    try {
        logger.info(`Cleaning up analytics data older than ${retentionDays} days`);
        
        const cleaned = await AnalyticsService.cleanupOldAnalytics(retentionDays);
        
        return { success: true, cleaned, message: `Cleaned ${cleaned} old analytics records` };
    } catch (error) {
        logger.error('Failed to cleanup old analytics:', error);
        throw error;
    }
});

analyticsQueue.process('calculate-growth-metrics', async (job) => {
    const { timeRange, comparisonPeriod } = job.data;
    
    try {
        logger.info(`Calculating growth metrics for ${timeRange}`);
        
        const growthMetrics = await AnalyticsService.calculateGrowthMetrics(timeRange, comparisonPeriod);
        
        return { success: true, growthMetrics, message: 'Growth metrics calculated' };
    } catch (error) {
        logger.error('Failed to calculate growth metrics:', error);
        throw error;
    }
});

// Job scheduling helper functions
export const analyticsJobs = {
    // Schedule user activity tracking
    async scheduleUserActivityTracking(userId, activity, metadata = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : { priority: 8 }; // Lower priority for tracking
        return await analyticsQueue.add('track-user-activity', { userId, activity, metadata }, jobOptions);
    },

    // Schedule analytics report generation
    async scheduleAnalyticsReport(reportType, timeRange, filters = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await analyticsQueue.add('generate-analytics-report', { reportType, timeRange, filters }, jobOptions);
    },

    // Schedule engagement metrics calculation
    async scheduleEngagementMetrics(eventId, timeRange = '24h', delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await analyticsQueue.add('calculate-engagement-metrics', { eventId, timeRange }, jobOptions);
    },

    // Schedule dashboard metrics update
    async scheduleDashboardUpdate(dashboardId, metrics, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : { priority: 5 }; // Medium priority
        return await analyticsQueue.add('update-dashboard-metrics', { dashboardId, metrics }, jobOptions);
    },

    // Schedule event analytics processing
    async scheduleEventAnalytics(eventId, analyticsData, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await analyticsQueue.add('process-event-analytics', { eventId, analyticsData }, jobOptions);
    },

    // Schedule periodic analytics cleanup
    async scheduleAnalyticsCleanup(retentionDays = 90, cron = '0 2 * * 0') { // Weekly at 2 AM Sunday
        return await analyticsQueue.add('cleanup-old-analytics', { retentionDays }, {
            repeat: { cron },
            removeOnComplete: 5,
            removeOnFail: 3,
        });
    },

    // Schedule growth metrics calculation
    async scheduleGrowthMetrics(timeRange, comparisonPeriod, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await analyticsQueue.add('calculate-growth-metrics', { timeRange, comparisonPeriod }, jobOptions);
    },

    // Schedule daily analytics reports
    async scheduleDailyReports(reportTypes = ['engagement', 'growth', 'activity'], cron = '0 8 * * *') { // Daily at 8 AM
        const jobs = [];
        for (const reportType of reportTypes) {
            jobs.push(
                await analyticsQueue.add('generate-analytics-report', {
                    reportType,
                    timeRange: '24h',
                    filters: {}
                }, {
                    repeat: { cron },
                    removeOnComplete: 10,
                    removeOnFail: 5,
                })
            );
        }
        return jobs;
    },

    // Schedule real-time dashboard updates
    async scheduleRealtimeDashboardUpdates(dashboardId, interval = '*/2 * * * *') { // Every 2 minutes
        return await analyticsQueue.add('update-dashboard-metrics', { dashboardId }, {
            repeat: { cron: interval },
            removeOnComplete: 10,
            removeOnFail: 3,
        });
    },
};

export default analyticsJobs;
