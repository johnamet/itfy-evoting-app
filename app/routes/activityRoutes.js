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
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const activityController = new ActivityController();

// Activity operations
router.get('/', requireRead, (req, res) => activityController.getActivities(req, res));
router.get('/recent', requireRead, (req, res) => activityController.getRecentActivities(req, res));
router.get('/stats', requireRead, (req, res) => activityController.getActivityStats(req, res));
router.get('/types', requireRead, (req, res) => activityController.getActivityTypes(req, res));
router.get('/:id', requireRead, (req, res) => activityController.getActivityById(req, res));

// Activity by entity
router.get('/user/:userId', requireRead, (req, res) => activityController.getActivitiesByUser(req, res));
router.get('/entity/:entityType/:entityId', requireRead, (req, res) => activityController.getActivitiesByEntity(req, res));

// Activity management
router.post('/', requireCreate, (req, res) => activityController.logActivity(req, res));

// Admin operations (require high-level access)
router.get('/export/log', requireLevel(3), (req, res) => activityController.exportActivityLog(req, res));
router.delete('/cleanup/old', requireLevel(4), (req, res) => activityController.cleanupOldActivities(req, res));

export default router;
