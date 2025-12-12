import { paymentQueue } from '../config/queue.js';
import PaymentService from '../services/PaymentService.js';
import logger from '../utils/Logger.js';

// Payment job processor
paymentQueue.process('process-payment', async (job) => {
    const { paymentData, userId, eventId } = job.data;
    
    try {
        logger.info(`Processing payment for user ${userId} in event ${eventId}`);
        
        const result = await PaymentService.processPayment(paymentData, userId, eventId);
        
        return { success: true, paymentId: result.id, transactionId: result.transactionId, message: 'Payment processed successfully' };
    } catch (error) {
        logger.error('Failed to process payment:', error);
        throw error;
    }
});

paymentQueue.process('verify-payment', async (job) => {
    const { paymentId, transactionId } = job.data;
    
    try {
        logger.info(`Verifying payment ${paymentId} with transaction ${transactionId}`);
        
        const verification = await PaymentService.verifyPayment(paymentId, transactionId);
        
        return { success: true, verification, message: 'Payment verification completed' };
    } catch (error) {
        logger.error('Failed to verify payment:', error);
        throw error;
    }
});

paymentQueue.process('process-refund', async (job) => {
    const { paymentId, refundAmount, reason } = job.data;
    
    try {
        logger.info(`Processing refund for payment ${paymentId}, amount: ${refundAmount}`);
        
        const refund = await PaymentService.processRefund(paymentId, refundAmount, reason);
        
        return { success: true, refund, message: 'Refund processed successfully' };
    } catch (error) {
        logger.error('Failed to process refund:', error);
        throw error;
    }
});

paymentQueue.process('update-payment-status', async (job) => {
    const { paymentId, status, metadata } = job.data;
    
    try {
        logger.info(`Updating payment ${paymentId} status to ${status}`);
        
        await PaymentService.updatePaymentStatus(paymentId, status, metadata);
        
        return { success: true, message: 'Payment status updated' };
    } catch (error) {
        logger.error('Failed to update payment status:', error);
        throw error;
    }
});

paymentQueue.process('generate-payment-report', async (job) => {
    const { reportType, timeRange, filters } = job.data;
    
    try {
        logger.info(`Generating ${reportType} payment report for ${timeRange}`);
        
        const report = await PaymentService.generatePaymentReport(reportType, timeRange, filters);
        
        return { success: true, report, message: 'Payment report generated' };
    } catch (error) {
        logger.error('Failed to generate payment report:', error);
        throw error;
    }
});

paymentQueue.process('reconcile-payments', async (job) => {
    const { startDate, endDate, gatewayProvider } = job.data;
    
    try {
        logger.info(`Reconciling payments from ${startDate} to ${endDate} for ${gatewayProvider}`);
        
        const reconciliation = await PaymentService.reconcilePayments(startDate, endDate, gatewayProvider);
        
        return { success: true, reconciliation, message: 'Payment reconciliation completed' };
    } catch (error) {
        logger.error('Failed to reconcile payments:', error);
        throw error;
    }
});

paymentQueue.process('handle-webhook', async (job) => {
    const { webhookData, provider } = job.data;
    
    try {
        logger.info(`Handling webhook from ${provider}`);
        
        const result = await PaymentService.handleWebhook(webhookData, provider);
        
        return { success: true, result, message: 'Webhook processed successfully' };
    } catch (error) {
        logger.error('Failed to handle webhook:', error);
        throw error;
    }
});

paymentQueue.process('cleanup-expired-payments', async (job) => {
    const { expirationHours = 24 } = job.data;
    
    try {
        logger.info(`Cleaning up payments expired for more than ${expirationHours} hours`);
        
        const cleaned = await PaymentService.cleanupExpiredPayments(expirationHours);
        
        return { success: true, cleaned, message: `Cleaned ${cleaned} expired payments` };
    } catch (error) {
        logger.error('Failed to cleanup expired payments:', error);
        throw error;
    }
});

// Job scheduling helper functions
export const paymentJobs = {
    // Schedule payment processing
    async schedulePaymentProcessing(paymentData, userId, eventId, priority = 'high') {
        const jobOptions = {
            priority: priority === 'high' ? 1 : priority === 'low' ? 10 : 5,
        };
        return await paymentQueue.add('process-payment', { paymentData, userId, eventId }, jobOptions);
    },

    // Schedule payment verification
    async schedulePaymentVerification(paymentId, transactionId, delay = 5000) { // 5 second delay
        return await paymentQueue.add('verify-payment', { paymentId, transactionId }, { delay });
    },

    // Schedule refund processing
    async scheduleRefundProcessing(paymentId, refundAmount, reason, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : { priority: 2 }; // High priority for refunds
        return await paymentQueue.add('process-refund', { paymentId, refundAmount, reason }, jobOptions);
    },

    // Schedule payment status update
    async schedulePaymentStatusUpdate(paymentId, status, metadata = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await paymentQueue.add('update-payment-status', { paymentId, status, metadata }, jobOptions);
    },

    // Schedule payment report generation
    async schedulePaymentReport(reportType, timeRange, filters = {}, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await paymentQueue.add('generate-payment-report', { reportType, timeRange, filters }, jobOptions);
    },

    // Schedule payment reconciliation
    async schedulePaymentReconciliation(startDate, endDate, gatewayProvider, delay = 0) {
        const jobOptions = delay > 0 ? { delay } : {};
        return await paymentQueue.add('reconcile-payments', { startDate, endDate, gatewayProvider }, jobOptions);
    },

    // Schedule webhook handling
    async scheduleWebhookHandling(webhookData, provider, priority = 'high') {
        const jobOptions = {
            priority: priority === 'high' ? 1 : 5,
        };
        return await paymentQueue.add('handle-webhook', { webhookData, provider }, jobOptions);
    },

    // Schedule expired payments cleanup
    async scheduleExpiredPaymentsCleanup(expirationHours = 24, cron = '0 */6 * * *') { // Every 6 hours
        return await paymentQueue.add('cleanup-expired-payments', { expirationHours }, {
            repeat: { cron },
            removeOnComplete: 5,
            removeOnFail: 3,
        });
    },

    // Schedule daily payment reconciliation
    async scheduleDailyReconciliation(gatewayProvider, cron = '0 1 * * *') { // Daily at 1 AM
        return await paymentQueue.add('reconcile-payments', {
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
            endDate: new Date(),
            gatewayProvider
        }, {
            repeat: { cron },
            removeOnComplete: 10,
            removeOnFail: 5,
        });
    },

    // Schedule payment verification with retry
    async schedulePaymentVerificationWithRetry(paymentId, transactionId, maxRetries = 3) {
        return await paymentQueue.add('verify-payment', { paymentId, transactionId }, {
            attempts: maxRetries,
            backoff: {
                type: 'exponential',
                delay: 10000, // Start with 10 seconds
            },
        });
    },

    // Schedule delayed payment status update
    async scheduleDelayedStatusUpdate(paymentId, status, delayMinutes = 5) {
        const delay = delayMinutes * 60 * 1000; // Convert to milliseconds
        return await paymentQueue.add('update-payment-status', { paymentId, status }, { delay });
    },
};

export default paymentJobs;
