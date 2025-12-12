import { emailQueue } from '../config/queue.js';
import EmailService from '../services/EmailService.js';
import logger from '../utils/Logger.js';

// Email job processor
emailQueue.process('send-welcome-email', async (job) => {
    const { to, name, eventName } = job.data;
    
    try {
        logger.info(`Processing welcome email for ${to}`);
        await EmailService.sendWelcomeEmail(to, name, eventName);
        return { success: true, message: `Welcome email sent to ${to}` };
    } catch (error) {
        logger.error('Failed to send welcome email:', error);
        throw error;
    }
});

emailQueue.process('send-confirmation-email', async (job) => {
    const { to, name, eventName, confirmationDetails } = job.data;
    
    try {
        logger.info(`Processing confirmation email for ${to}`);
        await EmailService.sendConfirmationEmail(to, name, eventName, confirmationDetails);
        return { success: true, message: `Confirmation email sent to ${to}` };
    } catch (error) {
        logger.error('Failed to send confirmation email:', error);
        throw error;
    }
});

emailQueue.process('send-notification-email', async (job) => {
    const { to, subject, content, templateData } = job.data;
    
    try {
        logger.info(`Processing notification email for ${to}`);
        await EmailService.sendNotificationEmail(to, subject, content, templateData);
        return { success: true, message: `Notification email sent to ${to}` };
    } catch (error) {
        logger.error('Failed to send notification email:', error);
        throw error;
    }
});

emailQueue.process('send-bulk-email', 5, async (job) => { // Process 5 concurrent bulk email jobs
    const { recipients, subject, content, templateData } = job.data;
    
    try {
        logger.info(`Processing bulk email for ${recipients.length} recipients`);
        const results = await EmailService.sendBulkEmail(recipients, subject, content, templateData);
        return { success: true, message: `Bulk email processed`, results };
    } catch (error) {
        logger.error('Failed to send bulk email:', error);
        throw error;
    }
});

emailQueue.process('send-password-reset', async (job) => {
    const { to, resetToken, userName } = job.data;
    
    try {
        logger.info(`Processing password reset email for ${to}`);
        await EmailService.sendPasswordResetEmail(to, resetToken, userName);
        return { success: true, message: `Password reset email sent to ${to}` };
    } catch (error) {
        logger.error('Failed to send password reset email:', error);
        throw error;
    }
});

// Job scheduling helper functions
export const emailJobs = {
    // Schedule welcome email
    async scheduleWelcomeEmail(to, name, eventName, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await emailQueue.add('send-welcome-email', { to, name, eventName }, jobOptions);
    },

    // Schedule confirmation email
    async scheduleConfirmationEmail(to, name, eventName, confirmationDetails, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await emailQueue.add('send-confirmation-email', { to, name, eventName, confirmationDetails }, jobOptions);
    },

    // Schedule notification email
    async scheduleNotificationEmail(to, subject, content, templateData = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await emailQueue.add('send-notification-email', { to, subject, content, templateData }, jobOptions);
    },

    // Schedule bulk email
    async scheduleBulkEmail(recipients, subject, content, templateData = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await emailQueue.add('send-bulk-email', { recipients, subject, content, templateData }, jobOptions);
    },

    // Schedule password reset email
    async schedulePasswordResetEmail(to, resetToken, userName, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await emailQueue.add('send-password-reset', { to, resetToken, userName }, jobOptions);
    },

    // Schedule recurring email (e.g., daily digest)
    async scheduleRecurringEmail(to, subject, content, templateData = {}, cron = '0 9 * * *') {
        return await emailQueue.add('send-notification-email', { to, subject, content, templateData }, {
            repeat: { cron },
            removeOnComplete: 10,
            removeOnFail: 5,
        });
    },
};

export default emailJobs;
