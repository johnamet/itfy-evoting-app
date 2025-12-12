#!/usr/bin/env node
/**
 * Main Router
 * 
 * Aggregates all API version routers
 * 
 * @module routes
 * @version 1.0.0
 */

import express from 'express';
import v1Routes from './v1/index.js';

const router = express.Router();

/**
 * Mount API version routers
 */
router.use('/v1', v1Routes);

/**
 * Default route - redirect to latest API version
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'ITFY E-Voting API',
        version: '1.0.0',
        documentation: '/api-docs',
        availableVersions: {
            v1: '/api/v1'
        }
    });
});

export default router;
