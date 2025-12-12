#!/usr/bin/env node
/**
 * Analytics Routes
 * 
 * @module routes/v1/analytics
 */

import express from 'express';
import AnalyticsController from '../../controllers/AnalyticsController.js';
import { requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const analyticsController = new AnalyticsController();

/**
 * @route GET /api/v1/analytics/dashboard
 * @desc Get dashboard analytics
 * @access Private (Admin - Level 3+)
 */
router.get('/dashboard', requireLevel(3), (req, res) => analyticsController.getDashboardAnalytics(req, res));

/**
 * @route GET /api/v1/analytics/event/:eventId
 * @desc Get event analytics
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId', requireLevel(3), (req, res) => analyticsController.getEventAnalytics(req, res));

/**
 * @route GET /api/v1/analytics/event/:eventId/votes
 * @desc Get voting analytics for event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId/votes', requireLevel(3), (req, res) => analyticsController.getVotingAnalytics(req, res));

/**
 * @route GET /api/v1/analytics/event/:eventId/revenue
 * @desc Get revenue analytics for event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId/revenue', requireLevel(3), (req, res) => analyticsController.getRevenueAnalytics(req, res));

/**
 * @route GET /api/v1/analytics/event/:eventId/real-time
 * @desc Get real-time analytics for event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId/real-time', requireLevel(3), (req, res) => analyticsController.getRealTimeAnalytics(req, res));

/**
 * @route GET /api/v1/analytics/candidate/:candidateId
 * @desc Get candidate analytics
 * @access Private (Event Manager - Level 3+)
 */
router.get('/candidate/:candidateId', requireLevel(3), (req, res) => analyticsController.getCandidateAnalytics(req, res));

/**
 * @route GET /api/v1/analytics/category/:categoryId
 * @desc Get category analytics
 * @access Private (Event Manager - Level 3+)
 */
router.get('/category/:categoryId', requireLevel(3), (req, res) => analyticsController.getCategoryAnalytics(req, res));

/**
 * @route POST /api/v1/analytics/track
 * @desc Track custom analytics event
 * @access Public
 */
router.post('/track', (req, res) => analyticsController.trackEvent(req, res));

export default router;
