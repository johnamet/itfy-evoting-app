#!/usr/bin/env node
/**
 * API v1 Router
 * 
 * Main router for API version 1
 * Aggregates all domain-specific route modules
 * 
 * @module routes/v1
 * @version 1.0.0
 */

import express from 'express';

// Import route modules
import authRoutes from './auth.routes.js';
import userRoutes from './users.routes.js';
import eventRoutes from './events.routes.js';
import candidateRoutes from './candidates.routes.js';
import nominationRoutes from './nominations.routes.js';
import votingRoutes from './voting.routes.js';
import paymentRoutes from './payments.routes.js';
import analyticsRoutes from './analytics.routes.js';
import slideRoutes from './slides.routes.js';
import couponRoutes from './coupons.routes.js';
import settingsRoutes from './settings.routes.js';
import notificationRoutes from './notifications.routes.js';

const router = express.Router();

/**
 * Health check endpoint
 * @route GET /api/v1/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API v1 is healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * Mount domain routes
 */
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/candidates', candidateRoutes);
router.use('/nominations', nominationRoutes);
router.use('/voting', votingRoutes);
router.use('/payments', paymentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/slides', slideRoutes);
router.use('/coupons', couponRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationRoutes);

/**
 * 404 handler for undefined API routes
 */
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            events: '/api/v1/events',
            candidates: '/api/v1/candidates',
            nominations: '/api/v1/nominations',
            voting: '/api/v1/voting',
            payments: '/api/v1/payments',
            analytics: '/api/v1/analytics',
            slides: '/api/v1/slides',
            coupons: '/api/v1/coupons',
            settings: '/api/v1/settings',
            notifications: '/api/v1/notifications'
        }
    });
});

export default router;
