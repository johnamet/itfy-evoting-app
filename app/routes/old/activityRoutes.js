#!/usr/bin/env node
/**
 * Activity Routes
 * 
 * Defines API endpoints for activity logging and audit operations.
 */

import express from 'express';
import ActivityController from '../controllers/ActivityController.js';
import { 
    requireRead, 
    requireCreate, 
    requireLevel, 
    optionalAuth,
    authenticate
} from '../middleware/auth.js';

const router = express.Router();
const activityController = new ActivityController();
// Track site visit
router.post('/visit', optionalAuth, (req, res) => activityController.trackSiteVisits(req, res))
// Activity operations
router.get('/', (req, res) => activityController.getActivities(req, res));
router.get('/recent', authenticate, requireLevel(1, 'read'), (req, res) => activityController.getRecentActivities(req, res));
router.get('/stats', (req, res) => activityController.getActivityStats(req, res));
router.get('/types', authenticate, requireLevel(1, 'read'), (req, res) => activityController.getActivityTypes(req, res));
router.get('/:id', authenticate, requireLevel(1, 'read'), (req, res) => activityController.getActivityById(req, res));

// Activity by entity
router.get('/user/:userId', authenticate, requireLevel(1, 'read'), (req, res) => activityController.getActivitiesByUser(req, res));
router.get('/entity/:entityType/:entityId', (req, res) => activityController.getActivitiesByEntity(req, res));

// Activity management
router.post('/', authenticate, requireLevel(3, 'create'), (req, res) => activityController.logActivity(req, res));

// Admin operations (require high-level access)
router.get('/export/log', authenticate, requireLevel(3, 'create'), (req, res) => activityController.exportActivityLog(req, res));
router.delete('/cleanup/old', authenticate, requireLevel(4), (req, res) => activityController.cleanupOldActivities(req, res));

export default router;
