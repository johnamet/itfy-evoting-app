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
router.get('/', (req, res) => activityController.getActivities(req, res));
router.get('/recent', (req, res) => activityController.getRecentActivities(req, res));
router.get('/stats', (req, res) => activityController.getActivityStats(req, res));
router.get('/types', (req, res) => activityController.getActivityTypes(req, res));
router.get('/:id', (req, res) => activityController.getActivityById(req, res));

// Activity by entity
router.get('/user/:userId', (req, res) => activityController.getActivitiesByUser(req, res));
router.get('/entity/:entityType/:entityId', (req, res) => activityController.getActivitiesByEntity(req, res));

// Activity management
router.post('/', requireCreate, (req, res) => activityController.logActivity(req, res));

// Admin operations (require high-level access)
router.get('/export/log', requireLevel(3), (req, res) => activityController.exportActivityLog(req, res));
router.delete('/cleanup/old', requireLevel(4), (req, res) => activityController.cleanupOldActivities(req, res));

export default router;
