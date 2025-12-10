/**
 * NotificationService
 * 
 * Handles notification creation, delivery, read status management,
 * and delivery tracking across the platform.
 * 
 * @extends BaseService
 * @module services/NotificationService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class NotificationService extends BaseService {
    constructor(repositories) {
        super(repositories, {
            serviceName: 'NotificationService',
            primaryRepository: 'notification',
        });

        this.validTypes = [
            'system',
            'event',
            'vote',
            'payment',
            'candidate',
            'message',
        ];

        this.validPriorities = ['low', 'normal', 'high', 'urgent'];
    }

    /**
     * Create a notification
     */
    async createNotification(notificationData, creatorId = null) {
        return this.runInContext('createNotification', async () => {
            // Validate required fields
            this.validateRequiredFields(notificationData, [
                'userId', 'type', 'title', 'message'
            ]);

            // Validate type
            if (!this.validTypes.includes(notificationData.type)) {
                throw new Error(`Invalid notification type. Must be one of: ${this.validTypes.join(', ')}`);
            }

            // Validate priority if provided
            if (notificationData.priority && !this.validPriorities.includes(notificationData.priority)) {
                throw new Error(`Invalid priority. Must be one of: ${this.validPriorities.join(', ')}`);
            }

            // Create notification
            const notification = await this.repo('notification').create({
                ...notificationData,
                priority: notificationData.priority || 'normal',
                read: false,
                delivered: false,
                createdBy: creatorId,
            });

            // Emit real-time notification if Socket.IO is available
            try {
                const io = global.io;
                if (io) {
                    io.to(`user-${notificationData.userId}`)
                        .emit('notification', {
                            id: notification._id,
                            type: notification.type,
                            title: notification.title,
                            message: notification.message,
                            priority: notification.priority,
                            createdAt: notification.createdAt,
                        });
                }
            } catch (error) {
                this.log('warn', 'Failed to emit real-time notification', { error: error.message });
            }

            return this.handleSuccess(
                { notification },
                'Notification created successfully'
            );
        });
    }

    /**
     * Create bulk notifications
     */
    async createBulkNotifications(userIds, notificationData, creatorId = null) {
        return this.runInContext('createBulkNotifications', async () => {
            // Validate required fields
            this.validateRequiredFields(notificationData, [
                'type', 'title', 'message'
            ]);

            const results = await this.processBatch(
                userIds,
                async (userId) => {
                    try {
                        await this.createNotification({
                            ...notificationData,
                            userId,
                        }, creatorId);
                        return { userId, success: true };
                    } catch (error) {
                        return { userId, success: false, error: error.message };
                    }
                },
                20
            );

            const successCount = results.filter(r => r.success).length;

            return this.handleSuccess({
                total: userIds.length,
                successful: successCount,
                failed: userIds.length - successCount,
                results,
            }, `Bulk notifications sent: ${successCount}/${userIds.length} successful`);
        });
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        return this.runInContext('markAsRead', async () => {
            const notification = await this.repo('notification').findById(notificationId);

            if (!notification) {
                throw new Error('Notification not found');
            }

            // Verify ownership
            if (notification.userId.toString() !== userId.toString()) {
                throw new Error('Unauthorized to access this notification');
            }

            const updatedNotification = await this.repo('notification').update(notificationId, {
                read: true,
                readAt: new Date(),
            });

            return this.handleSuccess(
                { notification: updatedNotification },
                'Notification marked as read'
            );
        });
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        return this.runInContext('markAllAsRead', async () => {
            const result = await this.repo('notification').updateMany(
                { userId, read: false },
                { read: true, readAt: new Date() }
            );

            return this.handleSuccess({
                modifiedCount: result.modifiedCount,
            }, `${result.modifiedCount} notifications marked as read`);
        });
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, filters = {}, pagination = {}) {
        return this.runInContext('getUserNotifications', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = { userId };

            // Filter by type
            if (filters.type) {
                query.type = filters.type;
            }

            // Filter by read status
            if (filters.read !== undefined) {
                query.read = filters.read === 'true';
            }

            // Filter by priority
            if (filters.priority) {
                query.priority = filters.priority;
            }

            // Filter by date range
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            const notifications = await this.repo('notification').findWithPagination(query, {
                page,
                limit,
                sort: { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(notifications.docs, notifications.total, page, limit),
                'Notifications retrieved successfully'
            );
        });
    }

    /**
     * Get unread count for user
     */
    async getUnreadCount(userId) {
        return this.runInContext('getUnreadCount', async () => {
            const count = await this.repo('notification').count({
                userId,
                read: false,
            });

            return this.handleSuccess({ count }, 'Unread count retrieved');
        });
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        return this.runInContext('deleteNotification', async () => {
            const notification = await this.repo('notification').findById(notificationId);

            if (!notification) {
                throw new Error('Notification not found');
            }

            // Verify ownership
            if (notification.userId.toString() !== userId.toString()) {
                throw new Error('Unauthorized to delete this notification');
            }

            await this.repo('notification').delete(notificationId);

            return this.handleSuccess(null, 'Notification deleted successfully');
        });
    }

    /**
     * Delete all read notifications for user
     */
    async deleteAllRead(userId) {
        return this.runInContext('deleteAllRead', async () => {
            const result = await this.repo('notification').deleteMany({
                userId,
                read: true,
            });

            return this.handleSuccess({
                deletedCount: result.deletedCount,
            }, `${result.deletedCount} notifications deleted`);
        });
    }

    /**
     * Send event notification to all participants
     */
    async sendEventNotification(eventId, notificationData, creatorId) {
        return this.runInContext('sendEventNotification', async () => {
            const event = await this.repo('event').findById(eventId);

            if (!event) {
                throw new Error('Event not found');
            }

            // Get all users who voted in this event
            const votes = await this.repo('vote').distinct('voterId', { eventId });

            // Get event organizer
            const organizerId = event.createdBy;

            // Combine unique user IDs
            const userIds = [...new Set([...votes, organizerId])];

            return this.createBulkNotifications(
                userIds,
                {
                    ...notificationData,
                    type: 'event',
                    data: { eventId, eventName: event.name },
                },
                creatorId
            );
        });
    }

    /**
     * Send vote confirmation notification
     */
    async sendVoteConfirmation(voteId) {
        return this.runInContext('sendVoteConfirmation', async () => {
            const vote = await this.repo('vote').findById(voteId);

            if (!vote) {
                throw new Error('Vote not found');
            }

            const event = await this.repo('event').findById(vote.eventId);
            const candidate = await this.repo('candidate').findById(vote.candidateId);

            return this.createNotification({
                userId: vote.voterId,
                type: 'vote',
                title: 'Vote Confirmed',
                message: `Your vote for ${candidate?.name || 'candidate'} in ${event?.name || 'event'} has been recorded.`,
                priority: 'normal',
                data: {
                    voteId: vote._id,
                    eventId: vote.eventId,
                    candidateId: vote.candidateId,
                },
            });
        });
    }

    /**
     * Send payment confirmation notification
     */
    async sendPaymentConfirmation(paymentId) {
        return this.runInContext('sendPaymentConfirmation', async () => {
            const payment = await this.repo('payment').findById(paymentId);

            if (!payment) {
                throw new Error('Payment not found');
            }

            const event = await this.repo('event').findById(payment.eventId);

            return this.createNotification({
                userId: payment.userId,
                type: 'payment',
                title: 'Payment Successful',
                message: `Your payment of ₦${payment.amount} for ${event?.name || 'event'} was successful.`,
                priority: 'high',
                data: {
                    paymentId: payment._id,
                    eventId: payment.eventId,
                    reference: payment.reference,
                },
            });
        });
    }

    /**
     * Get notification statistics
     */
    async getNotificationStatistics(filters = {}) {
        return this.runInContext('getNotificationStatistics', async () => {
            const query = {};

            // Apply filters
            if (filters.userId) {
                query.userId = filters.userId;
            }

            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            // Total counts
            const totalNotifications = await this.repo('notification').count(query);
            const readNotifications = await this.repo('notification').count({ ...query, read: true });
            const unreadNotifications = await this.repo('notification').count({ ...query, read: false });

            // By type
            const byType = await this.repo('notification').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
            ]);

            // By priority
            const byPriority = await this.repo('notification').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 },
                    },
                },
            ]);

            // Over time
            const overTime = await this.repo('notification').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            return this.handleSuccess({
                statistics: {
                    total: totalNotifications,
                    read: readNotifications,
                    unread: unreadNotifications,
                    byType,
                    byPriority,
                    overTime,
                },
            }, 'Statistics retrieved successfully');
        });
    }
}
