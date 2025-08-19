#!/usr/bin/env node

/**
 * Notification Controller
 * 
 * Handles HTTP requests for Notification operations
 */

import BaseController from './BaseController.js';
import NotificationService from '../services/NotificationService.js';

class NotificationController extends BaseController {
    constructor() {
        super();
        this.notificationService = new NotificationService();
    }

    /**
     * Get all notifications
     * GET /api/v1/notifications
     */
    async getAllNotifications(req, res) {
        try {
            const { page = 1, limit = 50, category, type, priority, isRead } = req.query;
            const filters = {};

            if (category) filters.category = category;
            if (type) filters.type = type;
            if (priority) filters.priority = priority;
            if (isRead !== undefined) filters.isRead = isRead === 'true';

            const notifications = await this.notificationService.findAll(filters, {
                page: parseInt(page),
                limit: parseInt(limit),
                sort: { createdAt: -1 },
                populate: [
                    { path: 'recipientUser', select: 'name email' },
                    { path: 'createdBy', select: 'name email' }
                ]
            });

            this.sendResponse(res, 200, notifications, 'Notifications retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get user notifications
     * GET /api/v1/notifications/user/:userId
     */
    async getUserNotifications(req, res) {
        try {
            const { userId } = req.params;
            const { unreadOnly = false } = req.query;

            let notifications;
            if (unreadOnly === 'true') {
                notifications = await this.notificationService.getUnreadForUser(userId, req.user?.role);
            } else {
                const filters = {
                    $or: [
                        { recipientUser: userId },
                        { isGlobalNotification: true }
                    ]
                };
                notifications = await this.notificationService.findAll(filters, {
                    sort: { createdAt: -1 },
                    limit: 100
                });
            }

            this.sendResponse(res, 200, notifications, 'User notifications retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get notifications by category
     * GET /api/v1/notifications/category/:category
     */
    async getNotificationsByCategory(req, res) {
        try {
            const { category } = req.params;
            const { limit = 50, offset = 0 } = req.query;

            const notifications = await this.notificationService.getByCategory(
                category, 
                parseInt(limit), 
                parseInt(offset)
            );

            this.sendResponse(res, 200, notifications, `${category} notifications retrieved successfully`);
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Create notification
     * POST /api/v1/notifications
     */
    async createNotification(req, res) {
        try {
            const notificationData = req.body;
            const createdBy = req.user?._id;

            const notification = await this.notificationService.createNotification(notificationData, createdBy);

            this.sendResponse(res, 201, notification, 'Notification created successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Update notification
     * PUT /api/v1/notifications/:id
     */
    async updateNotification(req, res) {
        try {
            const { id } = req.params;
            const updateData = {
                ...req.body,
                updatedAt: new Date(),
                lastChangedBy: req.user?._id
            };

            const notification = await this.notificationService.update(id, updateData);

            if (!notification) {
                return this.sendError(res, 404, 'Notification not found');
            }

            this.sendResponse(res, 200, notification, 'Notification updated successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Delete notification
     * DELETE /api/v1/notifications/:id
     */
    async deleteNotification(req, res) {
        try {
            const { id } = req.params;

            const deleted = await this.notificationService.delete(id);

            if (!deleted) {
                return this.sendError(res, 404, 'Notification not found');
            }

            this.sendResponse(res, 200, null, 'Notification deleted successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Mark notification as read
     * PATCH /api/v1/notifications/:id/read
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?._id;

            const notification = await this.notificationService.markAsRead(id, userId);

            if (!notification) {
                return this.sendError(res, 404, 'Notification not found');
            }

            this.sendResponse(res, 200, notification, 'Notification marked as read');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Mark all notifications as read for user
     * PATCH /api/v1/notifications/mark-all-read
     */
    async markAllAsRead(req, res) {
        try {
            const userId = req.user?._id;

            const result = await this.notificationService.markAllAsRead(userId);

            this.sendResponse(res, 200, result, 'All notifications marked as read');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get notification statistics
     * GET /api/v1/notifications/statistics
     */
    async getStatistics(req, res) {
        try {
            const stats = await this.notificationService.getStatistics();

            this.sendResponse(res, 200, stats, 'Notification statistics retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Send system notification
     * POST /api/v1/notifications/system
     */
    async sendSystemNotification(req, res) {
        try {
            const { title, message, type = 'info', category = 'system', priority = 'normal' } = req.body;

            const notification = await this.notificationService.createSystemNotification(
                title, 
                message, 
                type, 
                category, 
                priority
            );

            this.sendResponse(res, 201, notification, 'System notification sent successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Clean up old notifications
     * DELETE /api/v1/notifications/cleanup
     */
    async cleanupOldNotifications(req, res) {
        try {
            const { daysOld = 30 } = req.query;

            const result = await this.notificationService.deleteOldNotifications(parseInt(daysOld));

            this.sendResponse(res, 200, result, `Old notifications cleaned up successfully`);
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Test notification (for development)
     * POST /api/v1/notifications/test
     */
    async testNotification(req, res) {
        try {
            const { userId, type = 'info' } = req.body;

            const notification = await this.notificationService.createNotification({
                title: 'Test Notification',
                message: 'This is a test notification from the system.',
                type,
                category: 'system',
                priority: 'normal',
                recipientUser: userId,
                sendEmail: false
            }, req.user?._id);

            this.sendResponse(res, 201, notification, 'Test notification created successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }
}

export default NotificationController;
