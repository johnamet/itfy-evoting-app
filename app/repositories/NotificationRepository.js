#!/usr/bin/env node

/**
 * Notification Repository
 * 
 * Data access layer for Notification operations
 */

import BaseRepository from './BaseRepository.js';
import Notification from '../models/Notification.js';

class NotificationRepository extends BaseRepository {
    constructor() {
        super(Notification);
    }

    /**
     * Find unread notifications for a specific user
     */
    async findUnreadForUser(userId, role = null) {
        try {
            const query = {
                $or: [
                    { recipientUser: userId },
                    { isGlobalNotification: true }
                ],
                isRead: false,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            };

            // Add admin notifications if user has appropriate role
            if (role && role.level >= 3) {
                query.$or.push({ isAdminNotification: true });
            }

            // Add role-based notifications
            if (role) {
                query.$or.push({ recipientRole: role._id });
            }

            return await this.model.find(query)
                .populate('createdBy', 'name email')
                .populate('recipientUser', 'name email')
                .populate('recipientRole', 'name level')
                .sort({ priority: -1, createdAt: -1 });
        } catch (error) {
            throw new Error(`Error finding unread notifications: ${error.message}`);
        }
    }

    /**
     * Find notifications by entity reference
     */
    async findByEntityReference(entityType, entityId) {
        try {
            return await this.model.find({
                'relatedEntity.entityType': entityType,
                'relatedEntity.entityId': entityId
            })
            .populate('createdBy', 'name email')
            .populate('recipientUser', 'name email')
            .sort({ createdAt: -1 });
        } catch (error) {
            throw new Error(`Error finding notifications by entity: ${error.message}`);
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            return await this.model.findByIdAndUpdate(
                notificationId,
                {
                    isRead: true,
                    readAt: new Date(),
                    readBy: userId
                },
                { new: true }
            ).populate('createdBy', 'name email');
        } catch (error) {
            throw new Error(`Error marking notification as read: ${error.message}`);
        }
    }

    /**
     * Mark multiple notifications as read
     */
    async markMultipleAsRead(notificationIds, userId) {
        try {
            return await this.model.updateMany(
                { _id: { $in: notificationIds } },
                {
                    isRead: true,
                    readAt: new Date(),
                    readBy: userId
                }
            );
        } catch (error) {
            throw new Error(`Error marking multiple notifications as read: ${error.message}`);
        }
    }

    /**
     * Get notifications by category and type
     */
    async findByCategoryAndType(category, type = null, limit = 50) {
        try {
            const query = { category };
            if (type) query.type = type;

            return await this.model.find(query)
                .populate('createdBy', 'name email')
                .populate('recipientUser', 'name email')
                .sort({ createdAt: -1 })
                .limit(limit);
        } catch (error) {
            throw new Error(`Error finding notifications by category: ${error.message}`);
        }
    }

    /**
     * Get notifications by priority
     */
    async findByPriority(priority, isRead = null) {
        try {
            const query = { priority };
            if (isRead !== null) query.isRead = isRead;

            return await this.model.find(query)
                .populate('createdBy', 'name email')
                .populate('recipientUser', 'name email')
                .sort({ createdAt: -1 });
        } catch (error) {
            throw new Error(`Error finding notifications by priority: ${error.message}`);
        }
    }

    /**
     * Get scheduled notifications that need to be sent
     */
    async findScheduledToSend() {
        try {
            return await this.model.find({
                scheduledFor: { $lte: new Date() },
                isSent: false
            })
            .populate('createdBy', 'name email')
            .populate('recipientUser', 'name email')
            .sort({ scheduledFor: 1 });
        } catch (error) {
            throw new Error(`Error finding scheduled notifications: ${error.message}`);
        }
    }

    /**
     * Delete expired notifications
     */
    async deleteExpired() {
        try {
            const result = await this.model.deleteMany({
                expiresAt: { $lt: new Date() }
            });
            return result.deletedCount;
        } catch (error) {
            throw new Error(`Error deleting expired notifications: ${error.message}`);
        }
    }

    /**
     * Auto-delete old notifications based on settings
     */
    async autoDeleteOld() {
        try {
            const notifications = await this.model.find({
                'settings.autoDelete': true,
                isRead: true
            });

            let deletedCount = 0;
            for (const notification of notifications) {
                const daysSinceRead = Math.floor((new Date() - notification.readAt) / (1000 * 60 * 60 * 24));
                const autoDeleteAfterDays = notification.settings.autoDeleteAfterDays || 30;
                
                if (daysSinceRead >= autoDeleteAfterDays) {
                    await this.model.findByIdAndDelete(notification._id);
                    deletedCount++;
                }
            }

            return deletedCount;
        } catch (error) {
            throw new Error(`Error auto-deleting old notifications: ${error.message}`);
        }
    }

    /**
     * Get notification statistics
     */
    async getStats(userId = null, dateRange = null) {
        try {
            const matchStage = {};
            
            if (userId) {
                matchStage.$or = [
                    { recipientUser: userId },
                    { isGlobalNotification: true },
                    { isAdminNotification: true }
                ];
            }

            if (dateRange) {
                matchStage.createdAt = {
                    $gte: dateRange.start,
                    $lte: dateRange.end
                };
            }

            const stats = await this.model.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
                        read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } },
                        urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
                        high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
                        normal: { $sum: { $cond: [{ $eq: ['$priority', 'normal'] }, 1, 0] } },
                        low: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } }
                    }
                }
            ]);

            return stats[0] || {
                total: 0,
                unread: 0,
                read: 0,
                urgent: 0,
                high: 0,
                normal: 0,
                low: 0
            };
        } catch (error) {
            throw new Error(`Error getting notification stats: ${error.message}`);
        }
    }

    /**
     * Search notifications
     */
    async search(searchTerm, filters = {}) {
        try {
            const query = {
                $text: { $search: searchTerm }
            };

            // Apply filters
            if (filters.type) query.type = filters.type;
            if (filters.category) query.category = filters.category;
            if (filters.priority) query.priority = filters.priority;
            if (filters.isRead !== undefined) query.isRead = filters.isRead;
            if (filters.recipientUser) query.recipientUser = filters.recipientUser;

            return await this.model.find(query, { score: { $meta: 'textScore' } })
                .populate('createdBy', 'name email')
                .populate('recipientUser', 'name email')
                .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
                .limit(filters.limit || 50);
        } catch (error) {
            throw new Error(`Error searching notifications: ${error.message}`);
        }
    }

    /**
     * Create bulk notifications
     */
    async createBulk(notifications) {
        try {
            return await this.model.insertMany(notifications);
        } catch (error) {
            throw new Error(`Error creating bulk notifications: ${error.message}`);
        }
    }
}

export default NotificationRepository;
