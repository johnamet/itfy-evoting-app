import Bull from 'bull';
import { redisConfig } from './redis.js';
import logger from '../utils/logger.js';

// Queue configuration
const queueConfig = {
    redis: redisConfig,
    settings: {
        stalledInterval: 30 * 1000, // Check for stalled jobs every 30 seconds
        maxStalledCount: 1, // Max amount of times a stalled job will be re-processed
        retryProcessDelay: 5 * 1000, // Delay before retrying a failed job
    },
    defaultJobOptions: {
        removeOnComplete: 100, // Keep only last 100 completed jobs
        removeOnFail: 50, // Keep only last 50 failed jobs
        attempts: 3, // Number of attempts
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
};

// Create queues
export const emailQueue = new Bull('email processing', queueConfig);
export const voteProcessingQueue = new Bull('vote processing', queueConfig);
export const analyticsQueue = new Bull('analytics processing', queueConfig);
export const paymentQueue = new Bull('payment processing', queueConfig);
export const notificationQueue = new Bull('notification processing', queueConfig);

// Queue monitoring and events
const setupQueueEvents = (queue, queueName) => {
    queue.on('error', (error) => {
        logger.error(`Queue ${queueName} error:`, error);
    });

    queue.on('waiting', (jobId) => {
        logger.info(`Job ${jobId} is waiting in queue ${queueName}`);
    });

    queue.on('active', (job, jobPromise) => {
        logger.info(`Job ${job.id} started processing in queue ${queueName}`);
    });

    queue.on('completed', (job, result) => {
        logger.info(`Job ${job.id} completed in queue ${queueName}:`, result);
    });

    queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} failed in queue ${queueName}:`, err);
    });

    queue.on('paused', () => {
        logger.info(`Queue ${queueName} is paused`);
    });

    queue.on('resumed', () => {
        logger.info(`Queue ${queueName} is resumed`);
    });

    queue.on('cleaned', (jobs, type) => {
        logger.info(`Cleaned ${jobs.length} ${type} jobs in queue ${queueName}`);
    });
};

// Setup events for all queues
setupQueueEvents(emailQueue, 'email');
setupQueueEvents(voteProcessingQueue, 'vote processing');
setupQueueEvents(analyticsQueue, 'analytics');
setupQueueEvents(paymentQueue, 'payment');
setupQueueEvents(notificationQueue, 'notification');

// Graceful shutdown
const gracefulShutdown = async () => {
    logger.info('Shutting down queues...');
    try {
        await Promise.all([
            emailQueue.close(),
            voteProcessingQueue.close(),
            analyticsQueue.close(),
            paymentQueue.close(),
            notificationQueue.close(),
        ]);
        logger.info('All queues closed successfully');
    } catch (error) {
        logger.error('Error closing queues:', error);
    }
};

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Queue utility functions
export const queueUtils = {
    // Get queue statistics
    async getQueueStats(queue) {
        const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
            queue.isPaused(),
        ]);

        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            paused,
        };
    },

    // Clean old jobs
    async cleanQueue(queue, grace = 24 * 60 * 60 * 1000) { // 24 hours
        try {
            await queue.clean(grace, 'completed');
            await queue.clean(grace, 'failed');
            logger.info(`Cleaned old jobs from queue ${queue.name}`);
        } catch (error) {
            logger.error(`Error cleaning queue ${queue.name}:`, error);
        }
    },

    // Get all queue statistics
    async getAllQueueStats() {
        const queues = {
            email: emailQueue,
            voteProcessing: voteProcessingQueue,
            analytics: analyticsQueue,
            payment: paymentQueue,
            notification: notificationQueue,
        };

        const stats = {};
        for (const [name, queue] of Object.entries(queues)) {
            stats[name] = await this.getQueueStats(queue);
        }

        return stats;
    },

    // Pause all queues
    async pauseAllQueues() {
        await Promise.all([
            emailQueue.pause(),
            voteProcessingQueue.pause(),
            analyticsQueue.pause(),
            paymentQueue.pause(),
            notificationQueue.pause(),
        ]);
        logger.info('All queues paused');
    },

    // Resume all queues
    async resumeAllQueues() {
        await Promise.all([
            emailQueue.resume(),
            voteProcessingQueue.resume(),
            analyticsQueue.resume(),
            paymentQueue.resume(),
            notificationQueue.resume(),
        ]);
        logger.info('All queues resumed');
    },
};

export default {
    emailQueue,
    voteProcessingQueue,
    analyticsQueue,
    paymentQueue,
    notificationQueue,
    queueUtils,
};