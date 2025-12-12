import { notificationQueue } from '../config/queue.js';
import NotificationService from '../services/NotificationService.js';
import logger from '../utils/Logger.js';

// Notification job processor
notificationQueue.process('send-push-notification', async (job) => {
    const { userId, title, message, data } = job.data;
    
    try {
        logger.info(`Sending push notification to user ${userId}: ${title}`);
        
        const result = await NotificationService.sendPushNotification(userId, title, message, data);
        
        return { success: true, result, message: 'Push notification sent successfully' };
    } catch (error) {
        logger.error('Failed to send push notification:', error);
        throw error;
    }
});

notificationQueue.process('send-sms-notification', async (job) => {
    const { phoneNumber, message, userId } = job.data;
    
    try {
        logger.info(`Sending SMS notification to ${phoneNumber}`);
        
        const result = await NotificationService.sendSMSNotification(phoneNumber, message, userId);
        
        return { success: true, result, message: 'SMS notification sent successfully' };
    } catch (error) {
        logger.error('Failed to send SMS notification:', error);
        throw error;
    }
});

notificationQueue.process('send-in-app-notification', async (job) => {
    const { userId, title, message, type, data } = job.data;
    
    try {
        logger.info(`Sending in-app notification to user ${userId}: ${title}`);
        
        const notification = await NotificationService.createInAppNotification(userId, title, message, type, data);
        
        return { success: true, notification, message: 'In-app notification created successfully' };
    } catch (error) {
        logger.error('Failed to create in-app notification:', error);
        throw error;
    }
});

notificationQueue.process('send-bulk-notification', 5, async (job) => { // Process 5 concurrent bulk notifications
    const { userIds, title, message, type, data } = job.data;
    
    try {
        logger.info(`Sending bulk notification to ${userIds.length} users: ${title}`);
        
        const results = await NotificationService.sendBulkNotification(userIds, title, message, type, data);
        
        return { success: true, results, message: 'Bulk notification sent successfully' };
    } catch (error) {
        logger.error('Failed to send bulk notification:', error);
        throw error;
    }
});

notificationQueue.process('process-notification-preferences', async (job) => {
    const { userId, preferences } = job.data;
    
    try {
        logger.info(`Processing notification preferences for user ${userId}`);
        
        await NotificationService.updateNotificationPreferences(userId, preferences);
        
        return { success: true, message: 'Notification preferences updated' };
    } catch (error) {
        logger.error('Failed to process notification preferences:', error);
        throw error;
    }
});

notificationQueue.process('cleanup-old-notifications', async (job) => {
    const { retentionDays = 30 } = job.data;
    
    try {
        logger.info(`Cleaning up notifications older than ${retentionDays} days`);
        
        const cleaned = await NotificationService.cleanupOldNotifications(retentionDays);
        
        return { success: true, cleaned, message: `Cleaned ${cleaned} old notifications` };
    } catch (error) {
        logger.error('Failed to cleanup old notifications:', error);
        throw error;
    }
});

notificationQueue.process('send-scheduled-notification', async (job) => {
    const { userId, title, message, type, data, scheduledFor } = job.data;
    
    try {
        logger.info(`Sending scheduled notification to user ${userId}: ${title}`);
        
        // Check if it's time to send
        if (new Date() < new Date(scheduledFor)) {
            throw new Error('Notification not yet scheduled to send');
        }
        
        const result = await NotificationService.sendNotification(userId, title, message, type, data);
        
        return { success: true, result, message: 'Scheduled notification sent successfully' };
    } catch (error) {
        logger.error('Failed to send scheduled notification:', error);
        throw error;
    }
});

notificationQueue.process('send-reminder-notification', async (job) => {
    const { userId, eventId, reminderType, customMessage } = job.data;
    
    try {
        logger.info(`Sending ${reminderType} reminder to user ${userId} for event ${eventId}`);
        
        const result = await NotificationService.sendReminderNotification(userId, eventId, reminderType, customMessage);
        
        return { success: true, result, message: 'Reminder notification sent successfully' };
    } catch (error) {
        logger.error('Failed to send reminder notification:', error);
        throw error;
    }
});

// Job scheduling helper functions
export const notificationJobs = {
    // Schedule push notification
    async schedulePushNotification(userId, title, message, data = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await notificationQueue.add('send-push-notification', { userId, title, message, data }, jobOptions);
    },

    // Schedule SMS notification
    async scheduleSMSNotification(phoneNumber, message, userId, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await notificationQueue.add('send-sms-notification', { phoneNumber, message, userId }, jobOptions);
    },

    // Schedule in-app notification
    async scheduleInAppNotification(userId, title, message, type = 'info', data = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await notificationQueue.add('send-in-app-notification', { userId, title, message, type, data }, jobOptions);
    },

    // Schedule bulk notification
    async scheduleBulkNotification(userIds, title, message, type = 'info', data = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await notificationQueue.add('send-bulk-notification', { userIds, title, message, type, data }, jobOptions);
    },

    // Schedule notification preferences update
    async scheduleNotificationPreferencesUpdate(userId, preferences, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await notificationQueue.add('process-notification-preferences', { userId, preferences }, jobOptions);
    },

    // Schedule notification cleanup
    async scheduleNotificationCleanup(retentionDays = 30, cron = '0 3 * * *') { // Daily at 3 AM
        return await notificationQueue.add('cleanup-old-notifications', { retentionDays }, {
            repeat: { cron },
            removeOnComplete: 5,
            removeOnFail: 3,
        });
    },

    // Schedule notification for specific time
    async scheduleNotificationForTime(userId, title, message, scheduledFor, type = 'info', data = {}) {
        const delay = new Date(scheduledFor).getTime() - Date.now();
        return await notificationQueue.add('send-scheduled-notification', {
            userId, title, message, type, data, scheduledFor
        }, {
            delay: Math.max(0, delay),
        });
    },

    // Schedule reminder notification
    async scheduleReminderNotification(userId, eventId, reminderType, customMessage = null, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await notificationQueue.add('send-reminder-notification', {
            userId, eventId, reminderType, customMessage
        }, jobOptions);
    },

    // Schedule event reminders
    async scheduleEventReminders(eventId, reminderTimes = ['1h', '30m', '5m']) {
        const jobs = [];
        for (const reminderTime of reminderTimes) {
            const delay = this.parseReminderTime(reminderTime);
            jobs.push(
                await notificationQueue.add('send-reminder-notification', {
                    eventId,
                    reminderType: `${reminderTime}_before`,
                }, { delay })
            );
        }
        return jobs;
    },

    // Schedule recurring notifications
    async scheduleRecurringNotification(userId, title, message, type = 'info', data = {}, cron = '0 9 * * *') {
        return await notificationQueue.add('send-in-app-notification', {
            userId, title, message, type, data
        }, {
            repeat: { cron },
            removeOnComplete: 10,
            removeOnFail: 5,
        });
    },

    // Helper function to parse reminder time
    parseReminderTime(timeString) {
        const unit = timeString.slice(-1);
        const value = parseInt(timeString.slice(0, -1));
        
        switch (unit) {
            case 'h':
                return value * 60 * 60 * 1000; // hours to milliseconds
            case 'm':
                return value * 60 * 1000; // minutes to milliseconds
            case 's':
                return value * 1000; // seconds to milliseconds
            default:
                return 0;
        }
    },
};

export default notificationJobs;
