import { 
    emailQueue, 
    voteProcessingQueue, 
    analyticsQueue, 
    paymentQueue, 
    notificationQueue,
    queueUtils 
} from '../config/queue.js';
import { emailJobs } from '../processors/emailProcessor.js';
import { voteJobs } from '../processors/voteProcessor.js';
import { analyticsJobs } from '../processors/analyticsProcessor.js';
import { paymentJobs } from '../processors/paymentProcessor.js';
import { notificationJobs } from '../processors/notificationProcessor.js';
import logger from '../utils/Logger.js';

class QueueManager {
    constructor() {
        this.queues = {
            email: emailQueue,
            voteProcessing: voteProcessingQueue,
            analytics: analyticsQueue,
            payment: paymentQueue,
            notification: notificationQueue,
        };

        this.jobSchedulers = {
            email: emailJobs,
            vote: voteJobs,
            analytics: analyticsJobs,
            payment: paymentJobs,
            notification: notificationJobs,
        };

        this.isInitialized = false;
    }

    // Initialize all processors
    async initialize() {
        try {
            logger.info('Initializing Queue Manager...');

            // Import all processors to register their handlers
            await Promise.all([
                import('../processors/emailProcessor.js'),
                import('../processors/voteProcessor.js'),
                import('../processors/analyticsProcessor.js'),
                import('../processors/paymentProcessor.js'),
                import('../processors/notificationProcessor.js'),
            ]);

            // Setup periodic cleanup jobs
            await this.setupPeriodicJobs();

            this.isInitialized = true;
            logger.info('Queue Manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Queue Manager:', error);
            throw error;
        }
    }

    // Setup periodic maintenance jobs
    async setupPeriodicJobs() {
        try {
            // Schedule periodic queue cleanup
            await this.scheduleQueueCleanup();
            
            // Schedule analytics cleanup
            await analyticsJobs.scheduleAnalyticsCleanup();
            
            // Schedule notification cleanup
            await notificationJobs.scheduleNotificationCleanup();
            
            // Schedule expired payments cleanup
            await paymentJobs.scheduleExpiredPaymentsCleanup();

            logger.info('Periodic jobs scheduled successfully');
        } catch (error) {
            logger.error('Failed to setup periodic jobs:', error);
        }
    }

    // Schedule queue cleanup
    async scheduleQueueCleanup() {
        // Clean completed jobs every hour
        setInterval(async () => {
            try {
                for (const [name, queue] of Object.entries(this.queues)) {
                    await queueUtils.cleanQueue(queue, 60 * 60 * 1000); // 1 hour
                }
                logger.info('Queue cleanup completed');
            } catch (error) {
                logger.error('Queue cleanup failed:', error);
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    // Get comprehensive queue statistics
    async getQueueStatistics() {
        try {
            const stats = await queueUtils.getAllQueueStats();
            const totalStats = {
                totalWaiting: 0,
                totalActive: 0,
                totalCompleted: 0,
                totalFailed: 0,
                totalDelayed: 0,
                queues: stats,
            };

            // Calculate totals
            for (const queueStats of Object.values(stats)) {
                totalStats.totalWaiting += queueStats.waiting;
                totalStats.totalActive += queueStats.active;
                totalStats.totalCompleted += queueStats.completed;
                totalStats.totalFailed += queueStats.failed;
                totalStats.totalDelayed += queueStats.delayed;
            }

            return totalStats;
        } catch (error) {
            logger.error('Failed to get queue statistics:', error);
            throw error;
        }
    }

    // Pause all queues
    async pauseAllQueues() {
        try {
            await queueUtils.pauseAllQueues();
            logger.info('All queues paused by Queue Manager');
        } catch (error) {
            logger.error('Failed to pause all queues:', error);
            throw error;
        }
    }

    // Resume all queues
    async resumeAllQueues() {
        try {
            await queueUtils.resumeAllQueues();
            logger.info('All queues resumed by Queue Manager');
        } catch (error) {
            logger.error('Failed to resume all queues:', error);
            throw error;
        }
    }

    // Health check for all queues
    async healthCheck() {
        const health = {
            status: 'healthy',
            queues: {},
            timestamp: new Date().toISOString(),
        };

        try {
            for (const [name, queue] of Object.entries(this.queues)) {
                const stats = await queueUtils.getQueueStats(queue);
                health.queues[name] = {
                    status: stats.paused ? 'paused' : 'active',
                    waiting: stats.waiting,
                    active: stats.active,
                    failed: stats.failed,
                    isHealthy: stats.failed < 10, // Consider unhealthy if >10 failed jobs
                };

                if (!health.queues[name].isHealthy) {
                    health.status = 'degraded';
                }
            }
        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
            logger.error('Queue health check failed:', error);
        }

        return health;
    }

    // Emergency queue drain
    async emergencyDrain(queueName = null) {
        try {
            if (queueName && this.queues[queueName]) {
                await this.queues[queueName].drain();
                logger.info(`Emergency drain completed for queue: ${queueName}`);
            } else {
                // Drain all queues
                await Promise.all(
                    Object.entries(this.queues).map(async ([name, queue]) => {
                        await queue.drain();
                        logger.info(`Emergency drain completed for queue: ${name}`);
                    })
                );
            }
        } catch (error) {
            logger.error('Emergency drain failed:', error);
            throw error;
        }
    }

    // Get failed jobs from all queues
    async getFailedJobs(limit = 50) {
        const failedJobs = {};
        
        try {
            for (const [name, queue] of Object.entries(this.queues)) {
                const failed = await queue.getFailed(0, limit);
                failedJobs[name] = failed.map(job => ({
                    id: job.id,
                    data: job.data,
                    failedReason: job.failedReason,
                    processedOn: job.processedOn,
                    finishedOn: job.finishedOn,
                    attemptsMade: job.attemptsMade,
                }));
            }
        } catch (error) {
            logger.error('Failed to get failed jobs:', error);
            throw error;
        }

        return failedJobs;
    }

    // Retry failed jobs
    async retryFailedJobs(queueName = null, jobId = null) {
        try {
            if (queueName && jobId && this.queues[queueName]) {
                // Retry specific job
                const job = await this.queues[queueName].getJob(jobId);
                if (job) {
                    await job.retry();
                    logger.info(`Retried job ${jobId} in queue ${queueName}`);
                }
            } else if (queueName && this.queues[queueName]) {
                // Retry all failed jobs in specific queue
                const failed = await this.queues[queueName].getFailed();
                await Promise.all(failed.map(job => job.retry()));
                logger.info(`Retried ${failed.length} failed jobs in queue ${queueName}`);
            } else {
                // Retry all failed jobs in all queues
                for (const [name, queue] of Object.entries(this.queues)) {
                    const failed = await queue.getFailed();
                    await Promise.all(failed.map(job => job.retry()));
                    logger.info(`Retried ${failed.length} failed jobs in queue ${name}`);
                }
            }
        } catch (error) {
            logger.error('Failed to retry jobs:', error);
            throw error;
        }
    }

    // Get job schedulers
    getJobSchedulers() {
        return this.jobSchedulers;
    }

    // Quick job scheduling methods
    async scheduleEmail(type, data, delay = 0) {
        return await this.jobSchedulers.email[`schedule${type.charAt(0).toUpperCase() + type.slice(1)}Email`](...Object.values(data), delay);
    }

    async scheduleNotification(type, data, delay = 0) {
        const methodName = `schedule${type.charAt(0).toUpperCase() + type.slice(1)}Notification`;
        return await this.jobSchedulers.notification[methodName](...Object.values(data), delay);
    }

    async scheduleVoteProcessing(data, priority = 'normal') {
        return await this.jobSchedulers.vote.scheduleVoteProcessing(data.voteData, data.userId, data.eventId, priority);
    }

    async schedulePaymentProcessing(data, priority = 'high') {
        return await this.jobSchedulers.payment.schedulePaymentProcessing(data.paymentData, data.userId, data.eventId, priority);
    }

    // Graceful shutdown
    async shutdown() {
        try {
            logger.info('Shutting down Queue Manager...');
            
            // Pause all queues first
            await this.pauseAllQueues();
            
            // Wait for active jobs to complete (with timeout)
            const timeout = 30000; // 30 seconds
            const startTime = Date.now();
            
            while (Date.now() - startTime < timeout) {
                const stats = await this.getQueueStatistics();
                if (stats.totalActive === 0) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Close all queues
            await Promise.all(
                Object.values(this.queues).map(queue => queue.close())
            );
            
            logger.info('Queue Manager shutdown completed');
        } catch (error) {
            logger.error('Queue Manager shutdown failed:', error);
            throw error;
        }
    }
}

// Create singleton instance
const queueManager = new QueueManager();

export default queueManager;
export { QueueManager };
