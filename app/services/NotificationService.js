#!/usr/bin/env node

/**
 * Notification Service
 * 
 * Business logic for Notification operations
 */

import BaseService from './BaseService.js';
import NotificationRepository from '../repositories/NotificationRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import EmailService from './EmailService.js';

class NotificationService extends BaseService {
    constructor() {
        super();
        this.userRepository = new UserRepository();
        this.emailService = new EmailService();
        this.repository = new NotificationRepository();
    }

    /**
     * Create a new notification
     */
    async createNotification(data, createdBy) {
        try {
            const notificationData = {
                ...data,
                createdBy,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const notification = await this.repository.create(notificationData);

            // Send email if enabled
            if (data.sendEmail && notification.recipientUser) {
                await this.sendEmailNotification(notification);
            }

            // Send to all admins if it's a system notification
            if (data.isGlobalNotification && data.notifyAdmins) {
                await this.notifyAdmins(notification);
            }

            return notification;
        } catch (error) {
            throw new Error(`Error creating notification: ${error.message}`);
        }
    }

    /**
     * Get unread notifications for a user
     */
    async getUnreadForUser(userId, role = null) {
        try {
            return await this.repository.findUnreadForUser(userId, role);
        } catch (error) {
            throw new Error(`Error getting unread notifications: ${error.message}`);
        }
    }

    /**
     * Get notifications by category
     */
    async getByCategory(category, limit = 50, offset = 0) {
        try {
            return await this.repository.findByCategory(category, limit, offset);
        } catch (error) {
            throw new Error(`Error getting notifications by category: ${error.message}`);
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            return await this.repository.markAsRead(notificationId, userId);
        } catch (error) {
            throw new Error(`Error marking notification as read: ${error.message}`);
        }
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        try {
            return await this.repository.markAllAsRead(userId);
        } catch (error) {
            throw new Error(`Error marking all notifications as read: ${error.message}`);
        }
    }

    /**
     * Delete old notifications
     */
    async deleteOldNotifications(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            return await this.repository.deleteOld(cutoffDate);
        } catch (error) {
            throw new Error(`Error deleting old notifications: ${error.message}`);
        }
    }

    /**
     * Send email notification
     */
    async sendEmailNotification(notification) {
        try {
            if (!notification.recipientUser) return;

            const user = await this.userRepository.findById(notification.recipientUser);
            if (!user || !user.email) return;

            const emailData = {
                to: user.email,
                subject: notification.title,
                text: notification.message,
                html: this.generateEmailHTML(notification)
            };

            await this.emailService.sendEmail(emailData);
        } catch (error) {
            console.error('Error sending email notification:', error);
        }
    }

    /**
     * Notify all admins
     */
    async notifyAdmins(notification) {
        try {
            const admins = await this.userRepository.findAdmins();
            
            for (const admin of admins) {
                await this.createNotification({
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    category: notification.category,
                    priority: notification.priority,
                    recipientUser: admin._id,
                    relatedModel: notification.relatedModel,
                    relatedId: notification.relatedId,
                    actionUrl: notification.actionUrl,
                    sendEmail: false // Avoid infinite loop
                }, notification.createdBy);
            }
        } catch (error) {
            console.error('Error notifying admins:', error);
        }
    }

    /**
     * Generate HTML for email notifications
     */
    generateEmailHTML(notification) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #333; margin-bottom: 16px;">${notification.title}</h2>
                    <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">${notification.message}</p>
                    
                    ${notification.actionUrl ? `
                        <a href="${notification.actionUrl}" 
                           style="background-color: #007bff; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 4px; display: inline-block;">
                            View Details
                        </a>
                    ` : ''}
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            This is an automated notification from ITFY E-Voting System.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create system notification
     */
    async createSystemNotification(title, message, type = 'info', category = 'system', priority = 'normal') {
        try {
            return await this.createNotification({
                title,
                message,
                type,
                category,
                priority,
                isGlobalNotification: true,
                notifyAdmins: true,
                sendEmail: false
            }, null);
        } catch (error) {
            throw new Error(`Error creating system notification: ${error.message}`);
        }
    }

    /**
     * Create vote notification
     */
    async createVoteNotification(userId, candidateName, eventName, createdBy) {
        try {
            return await this.createNotification({
                title: 'Vote Cast Successfully',
                message: `Your vote for ${candidateName} in ${eventName} has been recorded.`,
                type: 'success',
                category: 'vote',
                priority: 'normal',
                recipientUser: userId,
                sendEmail: true
            }, createdBy);
        } catch (error) {
            throw new Error(`Error creating vote notification: ${error.message}`);
        }
    }

    /**
     * Create payment notification
     */
    async createPaymentNotification(userId, amount, status, reference, createdBy) {
        try {
            const title = status === 'success' ? 'Payment Successful' : 'Payment Failed';
            const message = status === 'success' 
                ? `Your payment of GHS ${amount} has been processed successfully. Reference: ${reference}`
                : `Your payment of GHS ${amount} could not be processed. Reference: ${reference}`;

            return await this.createNotification({
                title,
                message,
                type: status === 'success' ? 'success' : 'error',
                category: 'payment',
                priority: status === 'success' ? 'normal' : 'high',
                recipientUser: userId,
                sendEmail: true
            }, createdBy);
        } catch (error) {
            throw new Error(`Error creating payment notification: ${error.message}`);
        }
    }

    /**
     * Get notification statistics
     */
    async getStatistics() {
        try {
            return await this.repository.getStatistics();
        } catch (error) {
            throw new Error(`Error getting notification statistics: ${error.message}`);
        }
    }
}

export default NotificationService;
