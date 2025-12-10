/**
 * NotificationController
 * 
 * Handles notification operations:
 * - List user notifications
 * - Mark as read/unread
 * - Delete notifications
 * - Send notifications (admin)
 * - Broadcast notifications
 * - Real-time push via WebSockets
 * 
 * @module controllers/NotificationController
 */

import BaseController from './BaseController.js';
import { notificationService } from '../services/index.js';

class NotificationController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get user's notifications
     * GET /api/v1/notifications
     * Access: Authenticated users (own notifications)
     */
    getNotifications = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);
        const pagination = this.getPagination(req);
        const { unread, priority } = this.getRequestQuery(req);

        const filters = {};
        if (unread === 'true') filters.unread = true;
        if (priority) filters.priority = priority;

        try {
            const result = await notificationService.getUserNotifications({
                userId,
                ...filters,
                ...pagination
            });

            return this.sendPaginatedResponse(
                res,
                result.notifications,
                { total: result.total, ...pagination },
                'Notifications retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get notification by ID
     * GET /api/v1/notifications/:id
     * Access: Notification owner
     */
    getNotificationById = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const userId = this.getUserId(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid notification ID format');
        }

        try {
            const notification = await notificationService.getNotificationById(id);
            
            if (!notification) {
                return this.sendNotFound(res, 'Notification not found');
            }

            // Check authorization
            if (notification.userId.toString() !== userId.toString()) {
                return this.sendForbidden(res, 'You can only view your own notifications');
            }

            return this.sendSuccess(res, notification, 'Notification retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Mark notification as read
     * PUT /api/v1/notifications/:id/read
     * Access: Notification owner
     */
    markAsRead = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const userId = this.getUserId(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid notification ID format');
        }

        try {
            const notification = await notificationService.getNotificationById(id);
            
            if (!notification) {
                return this.sendNotFound(res, 'Notification not found');
            }

            // Check authorization
            if (notification.userId.toString() !== userId.toString()) {
                return this.sendForbidden(res, 'You can only update your own notifications');
            }

            const updated = await notificationService.markAsRead(id);
            return this.sendSuccess(res, updated, 'Notification marked as read');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Mark all notifications as read
     * PUT /api/v1/notifications/read-all
     * Access: Authenticated users
     */
    markAllAsRead = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);

        try {
            const result = await notificationService.markAllAsRead(userId);
            return this.sendSuccess(res, result, 'All notifications marked as read');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Delete notification
     * DELETE /api/v1/notifications/:id
     * Access: Notification owner
     */
    deleteNotification = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const userId = this.getUserId(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid notification ID format');
        }

        try {
            const notification = await notificationService.getNotificationById(id);
            
            if (!notification) {
                return this.sendNotFound(res, 'Notification not found');
            }

            // Check authorization
            if (notification.userId.toString() !== userId.toString()) {
                return this.sendForbidden(res, 'You can only delete your own notifications');
            }

            await notificationService.deleteNotification(id);
            return this.sendNoContent(res);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Delete all notifications for user
     * DELETE /api/v1/notifications
     * Access: Authenticated users
     */
    deleteAllNotifications = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);

        try {
            const result = await notificationService.deleteAllUserNotifications(userId);
            return this.sendSuccess(res, result, 'All notifications deleted');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Send notification to specific user (admin)
     * POST /api/v1/notifications/send
     * Access: Admin only
     */
    sendNotification = this.asyncHandler(async (req, res) => {
        const { userId, title, message, type, priority, link } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { userId, title, message },
            ['userId', 'title', 'message']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate MongoDB ID
        if (!this.validateMongoId(userId)) {
            return this.sendBadRequest(res, 'Invalid user ID format');
        }

        try {
            const notification = await notificationService.sendNotification({
                userId,
                title,
                message,
                type: type || 'info',
                priority: priority || 'medium',
                link
            });

            // Emit real-time notification via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to(`user-${userId}`).emit('notification', notification);
            }

            return this.sendCreated(res, notification, 'Notification sent successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Broadcast notification to all users (admin)
     * POST /api/v1/notifications/broadcast
     * Access: Admin only
     */
    broadcastNotification = this.asyncHandler(async (req, res) => {
        const { title, message, type, priority, link } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { title, message },
            ['title', 'message']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        try {
            const result = await notificationService.broadcastNotification({
                title,
                message,
                type: type || 'info',
                priority: priority || 'medium',
                link
            });

            // Emit real-time notification via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.emit('broadcast-notification', { title, message, type, priority, link });
            }

            return this.sendSuccess(res, result, `Notification broadcast to ${result.count} users`);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get unread notification count
     * GET /api/v1/notifications/unread-count
     * Access: Authenticated users
     */
    getUnreadCount = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);

        try {
            const count = await notificationService.getUnreadCount(userId);
            return this.sendSuccess(res, { count }, 'Unread count retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get notification preferences
     * GET /api/v1/notifications/preferences
     * Access: Authenticated users
     */
    getPreferences = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);

        try {
            const preferences = await notificationService.getNotificationPreferences(userId);
            return this.sendSuccess(res, preferences, 'Notification preferences retrieved');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update notification preferences
     * PUT /api/v1/notifications/preferences
     * Access: Authenticated users
     */
    updatePreferences = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);
        const preferences = this.getRequestBody(req);

        try {
            const updated = await notificationService.updateNotificationPreferences(
                userId,
                preferences
            );
            return this.sendSuccess(res, updated, 'Notification preferences updated');
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default NotificationController;
