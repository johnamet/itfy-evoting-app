#!/usr/bin/env node
/**
 * Main Routes Index
 * 
 * Entry point for all API routes
 * Supports API versioning with /api/v1, /api/v2, etc.
 * 
 * @module routes
 * @version 2.0.0
 */

import express from 'express';
import v1Routes from './v1/index.js';

const router = express.Router();

/**
 * Global health check (before versioning)
 * @route GET /api/health
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'ITFY E-Voting API is operational',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        versions: {
            v1: '/api/v1',
            current: 'v1'
        }
    });
});

/**
 * Mount API versions
 */
router.use('/v1', v1Routes);

/**
 * Default to v1 for backward compatibility
 * This allows both /api/v1/... and /api/... to work
 */
// router.use('/', v1Routes);  // Uncomment if you want default v1

/**
 * Global 404 handler
 */
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API route not found',
        path: req.originalUrl,
        hint: 'Use /api/v1/... for version 1 of the API',
        documentation: '/api-docs'
    });
});

export default router;
