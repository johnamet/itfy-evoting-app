#!/usr/bin/env node
/**
 * Notification Routes
 * 
 * @module routes/v1/notifications
 */

import express from 'express';
import NotificationController from '../../controllers/NotificationController.js';
import { authenticate, requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const notificationController = new NotificationController();

// ===== User Routes =====

/**
 * @route GET /api/v1/notifications
 * @desc Get user notifications
 * @access Private (Authenticated)
 */
router.get('/', authenticate, (req, res) => notificationController.getUserNotifications(req, res));

/**
 * @route GET /api/v1/notifications/unread
 * @desc Get unread notifications
 * @access Private (Authenticated)
 */
router.get('/unread', authenticate, (req, res) => notificationController.getUnreadNotifications(req, res));

/**
 * @route PUT /api/v1/notifications/:id/read
 * @desc Mark notification as read
 * @access Private (Authenticated)
 */
router.put('/:id/read', authenticate, (req, res) => notificationController.markAsRead(req, res));

/**
 * @route PUT /api/v1/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private (Authenticated)
 */
router.put('/read-all', authenticate, (req, res) => notificationController.markAllAsRead(req, res));

/**
 * @route DELETE /api/v1/notifications/:id
 * @desc Delete notification
 * @access Private (Authenticated)
 */
router.delete('/:id', authenticate, (req, res) => notificationController.deleteNotification(req, res));

// ===== Admin Routes =====

/**
 * @route POST /api/v1/notifications/broadcast
 * @desc Send broadcast notification to all users
 * @access Private (Super Admin - Level 4+)
 */
router.post('/broadcast', requireLevel(4), (req, res) => notificationController.sendBroadcastNotification(req, res));

/**
 * @route POST /api/v1/notifications/event/:eventId
 * @desc Send notification to event participants
 * @access Private (Event Manager - Level 3+)
 */
router.post('/event/:eventId', requireLevel(3), (req, res) => notificationController.sendEventNotification(req, res));

/**
 * @route GET /api/v1/notifications/admin/statistics
 * @desc Get notification statistics
 * @access Private (Admin - Level 3+)
 */
router.get('/admin/statistics', requireLevel(3), (req, res) => notificationController.getNotificationStatistics(req, res));

export default router;
