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
            const data = await this.analyticsService.getDashboardOverview({ period });
            return this.sendSuccess(res, data, 'Dashboard overview retrieved successfully');
        } catch (error) {
            console.error('Error in getDashboardOverview:', error);
            return this.handleError(res, error, 'Failed to retrieve dashboard overview');
        }
    }

    async getVotingAnalytics(req, res) {
        try {
            const { period, eventId, startDate, endDate, forceRefresh } = req.query;
            const data = await this.analyticsService.getVotingAnalytics({ period, eventId, startDate, endDate, forceRefresh });
            return this.sendSuccess(res, data, 'Voting analytics retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getVotingAnalytics:', error);
            return this.handleError(res, error, 'Failed to retrieve voting analytics');
        }
    }

    async getPaymentAnalytics(req, res) {
        try {
            const { period, startDate, endDate, forceRefresh } = req.query;
            const data = await this.analyticsService.getPaymentAnalytics({ period, startDate, endDate, forceRefresh });
            return this.sendSuccess(res, data, 'Payment analytics retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getPaymentAnalytics:', error);
            return this.handleError(res, error, 'Failed to retrieve payment analytics');
        }
    }

    async getAnomalyAnalytics(req, res) {
        try {
            const { period, startDate, endDate } = req.query;
            const data = await this.analyticsService.getAnomalyAnalytics({ period, startDate, endDate });
            return this.sendSuccess(res, data, 'Anomaly analytics retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getAnomalyAnalytics:', error);
            return this.handleError(res, error, 'Failed to retrieve anomaly analytics');
        }
    }

    async getForecasts(req, res) {
        try {
            const { period, startDate, endDate } = req.query;
            const data = await this.analyticsService.getForecasts({ period, startDate, endDate });
            return this.sendSuccess(res, data, 'Forecasts retrieved successfully', 200);
        } catch (error) {
            console.error('Error in getForecasts:', error);
            return this.handleError(res, error, 'Failed to retrieve forecasts');
        }
    }
}

export default AnalyticsController;
