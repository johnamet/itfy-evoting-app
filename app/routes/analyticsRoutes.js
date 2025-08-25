#!/usr/bin/env node
/**
 * Analytics Routes
 * 
 * Defines all routes for analytics and dashboard statistics endpoints.
 * Provides comprehensive analytics API for the e-voting system.
 */

import express from 'express';
import AnalyticsController from '../controllers/AnalyticsController.js';
// import auth from '../middleware/auth.js';

const router = express.Router();

const analyticsController = new AnalyticsController();


// Apply authentication middleware to all analytics routes
// router.use(auth);

/**
 * @swagger
 * components:
 *   schemas:
 *     AnalyticsOverview:
 *       type: object
 *       properties:
 *         totalUsers:
 *           type: number
 *           description: Total number of users
 *         totalEvents:
 *           type: number
 *           description: Total number of events
 *         totalVotes:
 *           type: number
 *           description: Total number of votes cast
 *         totalRevenue:
 *           type: number
 *           description: Total revenue generated
 *         activeEvents:
 *           type: number
 *           description: Number of currently active events
 *         completedEvents:
 *           type: number
 *           description: Number of completed events
 *     
 *     VotingAnalytics:
 *       type: object
 *       properties:
 *         totalVotes:
 *           type: number
 *         uniqueVoters:
 *           type: number
 *         averageVotesPerVoter:
 *           type: number
 *         votingRate:
 *           type: number
 *         peakVotingHour:
 *           type: number
 *         topCandidates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               candidate:
 *                 type: string
 *               votes:
 *                 type: number
 *               percentage:
 *                 type: number
 */

/**
 * @swagger
 * /api/analytics/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AnalyticsOverview'
 *                 message:
 *                   type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     cached:
 *                       type: boolean
 */
router.get('/dashboard/overview', (req, res) => analyticsController.getDashboardOverview(req, res));

/**
 * @swagger
 * /api/analytics/voting:
 *   get:
 *     summary: Get voting analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *         description: Time period for analytics
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by specific event ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for custom date range
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for custom date range
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached data
 *     responses:
 *       200:
 *         description: Voting analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/VotingAnalytics'
 */
router.get('/voting', (req, res) => analyticsController.getVotingAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/payments:
 *   get:
 *     summary: Get payment analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Payment analytics retrieved successfully
 */
router.get('/payments', (req, res) => analyticsController.getPaymentAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/users:
 *   get:
 *     summary: Get user analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
 */
router.get('/users', (req, res) => analyticsController.getUserAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/events:
 *   get:
 *     summary: Get event analytics for all events
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Event analytics retrieved successfully
 */
router.get('/events', (req, res) => analyticsController.getEventAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/events/{eventId}:
 *   get:
 *     summary: Get analytics for a specific event
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Event analytics retrieved successfully
 */
router.get('/events/:eventId', (req, res) => analyticsController.getEventAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/events/participation:
 *   get:
 *     summary: Get event participation analytics based on registration forms
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics (ISO 8601 format)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Response format
 *     responses:
 *       200:
 *         description: Event participation analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalParticipants:
 *                           type: number
 *                         totalEventsWithRegistration:
 *                           type: number
 *                         averageParticipantsPerEvent:
 *                           type: number
 *                     eventDetails:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                           eventTitle:
 *                             type: string
 *                           participantCount:
 *                             type: number
 *                           eventStatus:
 *                             type: string
 *                     topEvents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           eventId:
 *                             type: string
 *                           eventTitle:
 *                             type: string
 *                           participantCount:
 *                             type: number
 *                 message:
 *                   type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     cached:
 *                       type: boolean
 */
router.get('/events/participation', (req, res) => analyticsController.getEventParticipationAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/comprehensive:
 *   get:
 *     summary: Get comprehensive analytics (all types)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by specific event ID
 *       - in: query
 *         name: includeVoting
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includePayments
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeUsers
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeEvents
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Comprehensive analytics retrieved successfully
 */
router.get('/comprehensive', (req, res) => analyticsController.getComprehensiveAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     summary: Get real-time statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time statistics retrieved successfully
 */
router.get('/realtime', (req, res) => analyticsController.getRealTimeStats(req, res));

/**
 * @swagger
 * /api/analytics/trends:
 *   get:
 *     summary: Get analytics trends
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [voting, payments, users]
 *           default: voting
 *         description: Type of trend analytics
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly]
 *           default: daily
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 30
 *         description: Number of days to include in trend
 *     responses:
 *       200:
 *         description: Analytics trends retrieved successfully
 */
router.get('/trends', (req, res) => analyticsController.getTrends(req, res));

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     summary: Export analytics data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [comprehensive, voting, payments, users]
 *           default: comprehensive
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *           default: daily
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export', (req, res) => analyticsController.exportAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/summary:
 *   post:
 *     summary: Get analytics summary for custom date range
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Start date for summary
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 description: End date for summary
 *               types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [voting, payments, users]
 *                 default: [voting, payments, users]
 *                 description: Types of analytics to include
 *               eventId:
 *                 type: string
 *                 description: Filter by specific event ID
 *     responses:
 *       200:
 *         description: Analytics summary retrieved successfully
 *       400:
 *         description: Invalid date range or parameters
 */
router.post('/summary', (req, res) => analyticsController.getAnalyticsSummary(req, res));

/**
 * @swagger
 * /api/analytics/schedule:
 *   post:
 *     summary: Schedule analytics computation
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - period
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [overview, voting, payments, users, events]
 *                 description: Type of analytics to compute
 *               period:
 *                 type: string
 *                 enum: [hourly, daily, weekly, monthly, yearly, all-time]
 *                 description: Time period for computation
 *               eventId:
 *                 type: string
 *                 description: Optional event ID filter
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high]
 *                 default: normal
 *                 description: Computation priority
 *     responses:
 *       200:
 *         description: Analytics computation scheduled successfully
 *       400:
 *         description: Invalid parameters
 */
router.post('/schedule', (req, res) => analyticsController.scheduleComputation(req, res));

/**
 * @swagger
 * /api/analytics/health:
 *   get:
 *     summary: Get analytics system health status
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy, error]
 *                     totalRecords:
 *                       type: number
 *                     completedRecords:
 *                       type: number
 *                     failedRecords:
 *                       type: number
 *                     successRate:
 *                       type: number
 */
router.get('/health', (req, res) => analyticsController.getHealthStatus(req, res));

/**
 * @swagger
 * /api/analytics/cache:
 *   delete:
 *     summary: Clear all analytics cache
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics cache cleared successfully
 */
router.delete('/cache', (req, res) => analyticsController.clearCache(req, res));

/**
 * @swagger
 * /api/analytics/cache/{type}:
 *   delete:
 *     summary: Clear analytics cache for specific type
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [voting, payments, users, events, dashboard, realtime]
 *         description: Type of analytics cache to clear
 *     responses:
 *       200:
 *         description: Analytics cache cleared successfully
 */
router.delete('/cache/:type', (req, res) => analyticsController.clearCache(req, res));

/**
 * @swagger
 * /api/analytics/cleanup:
 *   delete:
 *     summary: Clean up expired analytics records
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired analytics cleaned up successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: number
 *                 message:
 *                   type: string
 */
router.delete('/cleanup', (req, res) => analyticsController.cleanupExpired(req, res));

// New Enhanced Analytics Routes

/**
 * @swagger
 * /api/analytics/collections:
 *   get:
 *     summary: Get comprehensive collection statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached data
 *     responses:
 *       200:
 *         description: Collection statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                     events:
 *                       type: object
 *                     votes:
 *                       type: object
 *                     candidates:
 *                       type: object
 *                     categories:
 *                       type: object
 *                     payments:
 *                       type: object
 *                     activities:
 *                       type: object
 *                     summary:
 *                       type: object
 */
router.get('/collections', (req, res) => analyticsController.getCollectionStatistics(req, res));

/**
 * @swagger
 * /api/analytics/trends/analysis:
 *   get:
 *     summary: Get comprehensive trend analysis
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for trend analysis
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for trend analysis
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *           default: daily
 *         description: Time granularity for trend analysis
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached data
 *     responses:
 *       200:
 *         description: Trend analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     voting:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: array
 *                         growthRate:
 *                           type: number
 *                         trend:
 *                           type: string
 *                         volatility:
 *                           type: number
 *                     revenue:
 *                       type: object
 *                     users:
 *                       type: object
 *                     events:
 *                       type: object
 */
router.get('/trends/analysis', (req, res) => analyticsController.getTrendAnalysis(req, res));

/**
 * @swagger
 * /api/analytics/descriptive/{collection}:
 *   get:
 *     summary: Get descriptive statistics for a specific collection
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collection
 *         required: true
 *         schema:
 *           type: string
 *           enum: [users, events, votes, payments, candidates, categories]
 *         description: Collection name for descriptive statistics
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached data
 *     responses:
 *       200:
 *         description: Descriptive statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     newInPeriod:
 *                       type: number
 *                     growthRate:
 *                       type: number
 *                     distribution:
 *                       type: array
 *       400:
 *         description: Invalid collection name
 */
router.get('/descriptive/:collection', (req, res) => analyticsController.getDescriptiveStatistics(req, res));

/**
 * @swagger
 * /api/analytics/summary/comprehensive:
 *   get:
 *     summary: Get comprehensive analytics summary with KPIs
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *           default: weekly
 *         description: Time period for summary
 *       - in: query
 *         name: includeComparisons
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include historical comparisons
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached data
 *     responses:
 *       200:
 *         description: Comprehensive analytics summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     dateRange:
 *                       type: object
 *                     kpis:
 *                       type: object
 *                       properties:
 *                         userGrowthRate:
 *                           type: number
 *                         revenueGrowthRate:
 *                           type: number
 *                         votingGrowthRate:
 *                           type: number
 *                         votingParticipationRate:
 *                           type: number
 *                         paymentSuccessRate:
 *                           type: number
 *                         systemHealthScore:
 *                           type: number
 *                     overview:
 *                       type: object
 *                     trends:
 *                       type: object
 *                     insights:
 *                       type: array
 */
router.get('/summary/comprehensive', (req, res) => analyticsController.getComprehensiveAnalyticsSummary(req, res));

/**
 * @swagger
 * /api/analytics/dashboard/metrics:
 *   get:
 *     summary: Get enhanced dashboard metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInsights
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include insights and recommendations
 *       - in: query
 *         name: includeTrends
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include trend data
 *       - in: query
 *         name: forceRefresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh of cached data
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                     totalEvents:
 *                       type: number
 *                     totalVotes:
 *                       type: number
 *                     totalRevenue:
 *                       type: number
 *                     growthRates:
 *                       type: object
 *                     trends:
 *                       type: object
 *                     insights:
 *                       type: array
 *                     recentActivity:
 *                       type: array
 */
router.get('/dashboard/metrics', (req, res) => analyticsController.getDashboardMetrics(req, res));

/**
 * @swagger
 * /api/analytics/performance:
 *   get:
 *     summary: Get analytics performance report with recommendations
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, quarterly, yearly]
 *           default: monthly
 *         description: Time period for performance report
 *       - in: query
 *         name: includeComparisons
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include historical comparisons
 *     responses:
 *       200:
 *         description: Performance report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     summary:
 *                       type: object
 *                     collections:
 *                       type: object
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           priority:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           metrics:
 *                             type: object
 */
router.get('/performance', (req, res) => analyticsController.getPerformanceReport(req, res));

export default router;
