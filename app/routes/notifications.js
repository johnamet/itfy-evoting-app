#!/usr/bin/env node

/**
 * Notification Routes
 * 
 * Defines all HTTP routes for Notification operations
 */

import express from 'express';
import NotificationController from '../controllers/NotificationController.js';

const router = express.Router();
const notificationController = new NotificationController();


/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get all notifications
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by type
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/',  notificationController.getAllNotifications.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/user/{userId}:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User notifications retrieved successfully
 */
router.get('/user/:userId', notificationController.getUserNotifications.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/category/{category}:
 *   get:
 *     summary: Get notifications by category
 *     tags: [Notifications]
 */
router.get('/category/:category', notificationController.getNotificationsByCategory.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/statistics:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Notifications]
 */
router.get('/statistics', notificationController.getStatistics.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications:
 *   post:
 *     summary: Create notification
 *     tags: [Notifications]
 */
router.post('/', notificationController.createNotification.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/system:
 *   post:
 *     summary: Send system notification
 *     tags: [Notifications]
 */
router.post('/system', notificationController.sendSystemNotification.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/test:
 *   post:
 *     summary: Test notification (development)
 *     tags: [Notifications]
 */
router.post('/test', notificationController.testNotification.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   put:
 *     summary: Update notification
 *     tags: [Notifications]
 */
router.put('/:id', notificationController.updateNotification.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 */
router.patch('/:id/read', notificationController.markAsRead.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/mark-all-read:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 */
router.patch('/mark-all-read', notificationController.markAllAsRead.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 */
router.delete('/:id', notificationController.deleteNotification.bind(notificationController));

/**
 * @swagger
 * /api/v1/notifications/cleanup:
 *   delete:
 *     summary: Clean up old notifications
 *     tags: [Notifications]
 */
router.delete('/cleanup', notificationController.cleanupOldNotifications.bind(notificationController));

export default router;
