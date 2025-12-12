/**
 * Analytics Routes
 * Defines endpoints for analytics with Swagger documentation.
 */

import express from 'express';
import AnalyticsController from '../controllers/AnalyticsController.js';

const router = express.Router();
const analyticsController = new AnalyticsController();

/**
 * @swagger
 * /api/analytics/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview statistics
 *     tags: [Analytics]
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
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                     totalEvents:
 *                       type: number
 */
router.get('/dashboard/overview', (req, res) => analyticsController.getDashboardOverview(req, res));

/**
 * @swagger
 * /api/analytics/voting:
 *   get:
 *     summary: Get voting analytics
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time, custom]
 *         description: Time period for analytics
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by event ID
 *     responses:
 *       200:
 *         description: Voting analytics retrieved successfully
 */
router.get('/voting', (req, res) => analyticsController.getVotingAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/payments:
 *   get:
 *     summary: Get payment analytics
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time, custom]
 *     responses:
 *       200:
 *         description: Payment analytics retrieved successfully
 */
router.get('/payments', (req, res) => analyticsController.getPaymentAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/anomalies:
 *   get:
 *     summary: Get anomaly analytics
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time, custom]
 *     responses:
 *       200:
 *         description: Anomaly analytics retrieved successfully
 */
router.get('/anomalies', (req, res) => analyticsController.getAnomalyAnalytics(req, res));

/**
 * @swagger
 * /api/analytics/forecasts:
 *   get:
 *     summary: Get forecast analytics
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly, yearly, all-time, custom]
 *     responses:
 *       200:
 *         description: Forecasts retrieved successfully
 */
router.get('/forecasts', (req, res) => analyticsController.getForecasts(req, res));

export default router;
