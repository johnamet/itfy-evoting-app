/**
 * AnalyticsController
 * 
 * Handles analytics and reporting operations:
 * - Platform-wide analytics
 * - Event analytics
 * - User analytics
 * - Revenue analytics
 * - Export functionality (JSON/CSV/PDF)
 * 
 * @module controllers/AnalyticsController
 */

import BaseController from './BaseController.js';
import { analyticsService } from '../services/index.js';

class AnalyticsController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get platform overview analytics
     * GET /api/v1/analytics/overview
     * Access: Admin only
     */
    getPlatformOverview = this.asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.getRequestQuery(req);

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        try {
            const overview = await analyticsService.getPlatformOverview({
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined
            });

            return this.sendSuccess(res, overview, 'Platform overview retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get event analytics
     * GET /api/v1/analytics/events/:eventId
     * Access: Event owner or Admin
     */
    getEventAnalytics = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const analytics = await analyticsService.getEventAnalytics(eventId);

            // Check authorization (would need to fetch event first)
            // For now, assume service handles authorization

            return this.sendSuccess(res, analytics, 'Event analytics retrieved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('Unauthorized')) {
                return this.sendForbidden(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get user analytics
     * GET /api/v1/analytics/users/:userId
     * Access: User (own analytics) or Admin
     */
    getUserAnalytics = this.asyncHandler(async (req, res) => {
        const { userId } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(userId)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        // Check authorization
        if (!this.canModifyResource(req, userId)) {
            return this.sendForbidden(res, 'You can only view your own analytics');
        }

        try {
            const analytics = await analyticsService.getUserAnalytics(userId);
            return this.sendSuccess(res, analytics, 'User analytics retrieved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get voting trends
     * GET /api/v1/analytics/voting-trends
     * Access: Admin only
     */
    getVotingTrends = this.asyncHandler(async (req, res) => {
        const { startDate, endDate, interval } = this.getRequestQuery(req);

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        // Validate interval
        if (interval && !this.isValidEnum(interval, ['hour', 'day', 'week', 'month'])) {
            return this.sendBadRequest(res, 'Invalid interval. Must be: hour, day, week, or month');
        }

        try {
            const trends = await analyticsService.getVotingTrends({
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                interval: interval || 'day'
            });

            return this.sendSuccess(res, trends, 'Voting trends retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get revenue analytics
     * GET /api/v1/analytics/revenue
     * Access: Admin only
     */
    getRevenueAnalytics = this.asyncHandler(async (req, res) => {
        const { startDate, endDate, groupBy } = this.getRequestQuery(req);

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        // Validate groupBy
        if (groupBy && !this.isValidEnum(groupBy, ['day', 'week', 'month', 'event'])) {
            return this.sendBadRequest(res, 'Invalid groupBy. Must be: day, week, month, or event');
        }

        try {
            const revenue = await analyticsService.getRevenueAnalytics({
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                groupBy: groupBy || 'month'
            });

            return this.sendSuccess(res, revenue, 'Revenue analytics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get user engagement metrics
     * GET /api/v1/analytics/engagement
     * Access: Admin only
     */
    getUserEngagement = this.asyncHandler(async (req, res) => {
        const { startDate, endDate } = this.getRequestQuery(req);

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        try {
            const engagement = await analyticsService.getUserEngagement({
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined
            });

            return this.sendSuccess(res, engagement, 'User engagement metrics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get top events
     * GET /api/v1/analytics/top-events
     * Access: Admin only
     */
    getTopEvents = this.asyncHandler(async (req, res) => {
        const { limit = 10, sortBy = 'votes' } = this.getRequestQuery(req);

        // Validate sortBy
        if (!this.isValidEnum(sortBy, ['votes', 'revenue', 'participants', 'candidates'])) {
            return this.sendBadRequest(res, 'Invalid sortBy. Must be: votes, revenue, participants, or candidates');
        }

        try {
            const topEvents = await analyticsService.getTopEvents({
                limit: parseInt(limit),
                sortBy
            });

            return this.sendSuccess(res, topEvents, 'Top events retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get top candidates (across all events)
     * GET /api/v1/analytics/top-candidates
     * Access: Admin only
     */
    getTopCandidates = this.asyncHandler(async (req, res) => {
        const { limit = 10, eventId } = this.getRequestQuery(req);

        // Validate eventId if provided
        if (eventId && !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const topCandidates = await analyticsService.getTopCandidates({
                limit: parseInt(limit),
                eventId
            });

            return this.sendSuccess(res, topCandidates, 'Top candidates retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Export analytics report
     * POST /api/v1/analytics/export
     * Access: Admin only
     */
    exportReport = this.asyncHandler(async (req, res) => {
        const { reportType, format, startDate, endDate, eventId } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { reportType, format },
            ['reportType', 'format']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate report type
        if (!this.isValidEnum(reportType, ['platform', 'event', 'revenue', 'engagement'])) {
            return this.sendBadRequest(res, 'Invalid report type');
        }

        // Validate format
        if (!this.isValidEnum(format, ['json', 'csv', 'pdf'])) {
            return this.sendBadRequest(res, 'Invalid format. Must be: json, csv, or pdf');
        }

        // Validate date range if provided
        if (startDate && endDate && !this.validateDateRange(startDate, endDate)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        // Validate eventId if provided
        if (eventId && !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const report = await analyticsService.exportReport({
                reportType,
                format,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                eventId
            });

            // Set appropriate content type
            const contentTypes = {
                json: 'application/json',
                csv: 'text/csv',
                pdf: 'application/pdf'
            };

            res.setHeader('Content-Type', contentTypes[format]);
            res.setHeader('Content-Disposition', `attachment; filename="analytics-${reportType}-${Date.now()}.${format}"`);

            return res.send(report);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get candidate performance comparison
     * GET /api/v1/analytics/candidate-comparison
     * Access: Event owner or Admin
     */
    getCandidateComparison = this.asyncHandler(async (req, res) => {
        const { eventId, candidateIds } = this.getRequestQuery(req);

        // Validate eventId
        if (!eventId || !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Valid event ID is required');
        }

        // Validate candidateIds
        if (!candidateIds) {
            return this.sendBadRequest(res, 'Candidate IDs are required');
        }

        const ids = candidateIds.split(',');
        for (const id of ids) {
            if (!this.validateMongoId(id.trim())) {
                return this.sendBadRequest(res, `Invalid candidate ID format: ${id}`);
            }
        }

        try {
            const comparison = await analyticsService.getCandidateComparison(eventId, ids);
            return this.sendSuccess(res, comparison, 'Candidate comparison retrieved successfully');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            if (error.message.includes('Unauthorized')) {
                return this.sendForbidden(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Get real-time voting activity
     * GET /api/v1/analytics/real-time-activity
     * Access: Admin only
     */
    getRealTimeActivity = this.asyncHandler(async (req, res) => {
        const { eventId, minutes = 30 } = this.getRequestQuery(req);

        // Validate eventId if provided
        if (eventId && !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const activity = await analyticsService.getRealTimeActivity({
                eventId,
                minutes: parseInt(minutes)
            });

            return this.sendSuccess(res, activity, 'Real-time activity retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default AnalyticsController;
