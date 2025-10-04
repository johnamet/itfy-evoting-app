/**
 * Analytics Controller
 * Handles HTTP requests for analytics with enhanced endpoints.
 */

import BaseController from './BaseController.js';
import AnalyticsService from '../services/AnalyticsService.js';

class AnalyticsController extends BaseController {
    constructor() {
        super();
        this.analyticsService = new AnalyticsService();
    }

    async getDashboardOverview(req, res) {
        const { period } = req.query
        try {
            const result = await this.analyticsService.getDashboardOverview({ period });
            if (!result.success) return this.handleError(res, new Error(result.error), 500);
            return this.sendSuccess(res, { ...result.data, cached: result.cached }, 'Dashboard overview retrieved successfully');
        } catch (error) {
            console.error('Error in getDashboardOverview:', error);
            return this.handleError(res, new Error('Failed to retrieve dashboard overview'), 500);
        }
    }

    async getVotingAnalytics(req, res) {
        try {
            const { period, eventId, startDate, endDate, forceRefresh } = req.query;
            const result = await this.analyticsService.getVotingAnalytics({ period, eventId, startDate, endDate, forceRefresh });
            if (!result.success) return this.handleError(res, result.error, 500);
            return this.sendSuccess(res, result.data, 'Voting analytics retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getVotingAnalytics:', error);
            return this.handleError(res, new Error('Failed to retrieve voting analytics'), 500);
        }
    }

    async getPaymentAnalytics(req, res) {
        try {
            const { period, startDate, endDate, forceRefresh } = req.query;
            const result = await this.analyticsService.getPaymentAnalytics({ period, startDate, endDate, forceRefresh });
            if (!result.success) return this.handleError(res, result.error, 500);
            return this.sendSuccess(res, result.data, 'Payment analytics retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getPaymentAnalytics:', error);
            return this.handleError(res, new Error('Failed to retrieve payment analytics'), 500);
        }
    }

    async getAnomalyAnalytics(req, res) {
        try {
            const { period, startDate, endDate } = req.query;
            const result = await this.analyticsService.getAnomalyAnalytics({ period, startDate, endDate });
            if (!result.success) return this.handleError(res, result.error, 500);
            return this.sendSuccess(res, result.data, 'Anomaly analytics retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getAnomalyAnalytics:', error);
            return this.handleError(res, new Error('Failed to retrieve anomaly analytics'), 500);
        }
    }

    async getForecasts(req, res) {
        try {
            const { period, startDate, endDate } = req.query;
            const result = await this.analyticsService.getForecasts({ period, startDate, endDate });
            if (!result.success) return this.handleError(res, result.error, 500);
            return this.sendSuccess(res, result.data, 'Forecasts retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getForecasts:', error);
            return this.handleError(res, new Error('Failed to retrieve forecasts'), 500);
        }
    }
}

export default AnalyticsController;
