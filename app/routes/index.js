#!/usr/bin/env node
/**
 * Routes Index
 * 
 * Centralized route management for the application.
 */

import express from 'express';
import activityRoutes from './activityRoutes.js';
import authRoutes from './authRoutes.js';
import cacheRoutes from './cacheRoutes.js';
import candidateRoutes from './candidateRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import couponRoutes from './couponRoutes.js';
import eventRoutes from './eventRoutes.js';
import fileRoutes from './fileRoutes.js';
import formRoutes from './formRoutes.js';
import slideRoutes from './slideRoutes.js';
import userRoutes from './userRoutes.js';
import votingRoutes from './votingRoutes.js';
import paymentRoutes from './paymentRoutes.js';

const router = express.Router();

// Mount routes
router.use('/activities', activityRoutes);
router.use('/auth', authRoutes);
router.use('/cache', cacheRoutes);
router.use('/candidates', candidateRoutes);
router.use('/categories', categoryRoutes);
router.use('/coupons', couponRoutes);
router.use('/events', eventRoutes);
router.use('/files', fileRoutes);
router.use('/forms', formRoutes);
router.use('/slides', slideRoutes);
router.use('/users', userRoutes);
router.use('/voting', votingRoutes);
router.use('/payments', paymentRoutes);

// Health check for API routes
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API routes are healthy',
        timestamp: new Date().toISOString(),
        availableRoutes: [
            'GET /api/health',
            // Auth routes
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/logout',
            'GET /api/auth/profile',
            'PUT /api/auth/profile',
            'POST /api/auth/change-password',
            'POST /api/auth/forgot-password',
            'POST /api/auth/reset-password',
            'POST /api/auth/refresh-token',
            // Event routes
            'POST /api/events',
            'GET /api/events',
            'GET /api/events/upcoming',
            'GET /api/events/past',
            'GET /api/events/:id',
            'PUT /api/events/:id',
            'DELETE /api/events/:id',
            'GET /api/events/:id/stats',
            'GET /api/events/:id/participants',
            'POST /api/events/:id/register',
            'DELETE /api/events/:id/register',
            'PATCH /api/events/:id/status',
            // Candidate routes
            'POST /api/candidates',
            'GET /api/candidates',
            'GET /api/candidates/:id',
            'PUT /api/candidates/:id',
            'DELETE /api/candidates/:id',
            'GET /api/candidates/event/:eventId',
            'GET /api/candidates/category/:categoryId',
            'GET /api/candidates/:id/votes',
            'GET /api/candidates/:id/stats',
            'POST /api/candidates/:id/image',
            'PATCH /api/candidates/:id/status',
            // Category routes
            'POST /api/categories',
            'GET /api/categories',
            'GET /api/categories/:id',
            'PUT /api/categories/:id',
            'DELETE /api/categories/:id',
            'GET /api/categories/event/:eventId',
            'GET /api/categories/:id/stats',
            'PATCH /api/categories/:id/status',
            'POST /api/categories/reorder',
            // Voting routes
            'POST /api/voting/vote',
            'GET /api/voting/history',
            'GET /api/voting/results/event/:eventId',
            'GET /api/voting/results/category/:categoryId',
            'GET /api/voting/eligibility/:eventId',
            'GET /api/voting/verify/:voteId',
            'POST /api/voting/bundles',
            'GET /api/voting/bundles/:bundleId',
            'GET /api/voting/stats/:eventId',
            'GET /api/voting/updates/:eventId',
            'GET /api/voting/export/:eventId',
            'GET /api/voting/audit/:eventId',
            // User routes
            'GET /api/users',
            'GET /api/users/search',
            'GET /api/users/role/:role',
            'GET /api/users/:id',
            'PUT /api/users/:id',
            'DELETE /api/users/:id',
            'GET /api/users/:id/activity',
            'GET /api/users/:id/stats',
            'POST /api/users/:id/avatar',
            'PATCH /api/users/:id/role',
            'PATCH /api/users/:id/status',
            'PATCH /api/users/bulk-update',
            // Role management routes
            'GET /api/users/roles',
            'POST /api/users/roles',
            'GET /api/users/roles/:roleId',
            'PUT /api/users/roles/:roleId',
            'DELETE /api/users/roles/:roleId',
            'GET /api/users/roles/:roleId/permissions',
            'PUT /api/users/roles/:roleId/permissions',
            'POST /api/users/:userId/roles/:roleId',
            'DELETE /api/users/:userId/roles/:roleId',
            'GET /api/users/:id/roles',
            // File routes
            'POST /api/files/upload',
            'POST /api/files/upload/multiple',
            'POST /api/files/validate',
            'GET /api/files',
            'GET /api/files/:id',
            'GET /api/files/:id/download',
            'GET /api/files/:id/thumbnail',
            'PUT /api/files/:id',
            'DELETE /api/files/:id',
            'GET /api/files/entity/:entityType/:entityId',
            'POST /api/files/:id/download-link',
            'GET /api/files/admin/stats',
            'DELETE /api/files/admin/cleanup-temp',
            // Activity routes
            'GET /api/activities',
            'GET /api/activities/recent',
            'GET /api/activities/stats',
            'GET /api/activities/types',
            'GET /api/activities/:id',
            'GET /api/activities/user/:userId',
            'GET /api/activities/entity/:entityType/:entityId',
            'POST /api/activities',
            'GET /api/activities/export/log',
            'DELETE /api/activities/cleanup/old',
            // Form routes
            'POST /api/forms',
            'GET /api/forms',
            'GET /api/forms/:id',
            'PUT /api/forms/:id',
            'DELETE /api/forms/:id',
            'POST /api/forms/:id/submit',
            'GET /api/forms/:id/submissions',
            'GET /api/forms/:id/export',
            'POST /api/forms/:id/duplicate',
            'PATCH /api/forms/:id/status',
            'GET /api/forms/:id/analytics',
            'GET /api/forms/model/:model',
            'GET /api/forms/model/:model/:modelId',
            'POST /api/forms/model/:model/:modelId',
            // Slide routes
            'POST /api/slides',
            'GET /api/slides',
            'GET /api/slides/:id',
            'PUT /api/slides/:id',
            'DELETE /api/slides/:id',
            'GET /api/slides/event/:eventId',
            'POST /api/slides/reorder',
            'POST /api/slides/:id/duplicate',
            'GET /api/slides/:id/preview',
            'POST /api/slides/:id/media',
            'PATCH /api/slides/:id/status',
            // Coupon routes
            'POST /api/coupons',
            'GET /api/coupons',
            'GET /api/coupons/:id',
            'GET /api/coupons/code/:code',
            'PUT /api/coupons/:id',
            'DELETE /api/coupons/:id',
            'POST /api/coupons/validate/:code',
            'POST /api/coupons/use/:code',
            'GET /api/coupons/:id/stats',
            'GET /api/coupons/:id/usage-history',
            'POST /api/coupons/generate-bulk',
            'PATCH /api/coupons/:id/status',
            'GET /api/coupons/export/data',
            // Cache routes
            'GET /api/cache/stats',
            'GET /api/cache/health',
            'GET /api/cache/config',
            'GET /api/cache/keys',
            'GET /api/cache/value/:key',
            'DELETE /api/cache/clear/all',
            'DELETE /api/cache/clear/type/:type',
            'DELETE /api/cache/clear/pattern',
            'DELETE /api/cache/key/:key',
            'DELETE /api/cache/user/:userId',
            'DELETE /api/cache/event/:eventId',
            'PUT /api/cache/config',
            'POST /api/cache/warm-up'
        ]
    });
});

export default router;
