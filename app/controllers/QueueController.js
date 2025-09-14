import queueManager from '../services/QueueManager.js';
import logger from '../utils/logger.js';

class QueueController {
    // Get queue dashboard statistics
    async getDashboard(req, res) {
        try {
            const stats = await queueManager.getQueueStatistics();
            const health = await queueManager.healthCheck();
            
            res.json({
                success: true,
                data: {
                    statistics: stats,
                    health: health,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            logger.error('Failed to get queue dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve queue dashboard',
                error: error.message,
            });
        }
    }

    // Get failed jobs
    async getFailedJobs(req, res) {
        try {
            const { limit = 50, queue } = req.query;
            const failedJobs = await queueManager.getFailedJobs(parseInt(limit));
            
            const result = queue && failedJobs[queue] 
                ? { [queue]: failedJobs[queue] }
                : failedJobs;

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('Failed to get failed jobs:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve failed jobs',
                error: error.message,
            });
        }
    }

    // Retry failed jobs
    async retryFailedJobs(req, res) {
        try {
            const { queue, jobId } = req.body;
            
            await queueManager.retryFailedJobs(queue, jobId);
            
            res.json({
                success: true,
                message: jobId 
                    ? `Retried job ${jobId} in queue ${queue}`
                    : queue 
                        ? `Retried all failed jobs in queue ${queue}`
                        : 'Retried all failed jobs in all queues',
            });
        } catch (error) {
            logger.error('Failed to retry jobs:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retry jobs',
                error: error.message,
            });
        }
    }

    // Pause queue
    async pauseQueue(req, res) {
        try {
            const { queue } = req.params;
            
            if (queue === 'all') {
                await queueManager.pauseAllQueues();
                res.json({
                    success: true,
                    message: 'All queues paused successfully',
                });
            } else if (queueManager.queues[queue]) {
                await queueManager.queues[queue].pause();
                res.json({
                    success: true,
                    message: `Queue ${queue} paused successfully`,
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: `Queue ${queue} not found`,
                });
            }
        } catch (error) {
            logger.error('Failed to pause queue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to pause queue',
                error: error.message,
            });
        }
    }

    // Resume queue
    async resumeQueue(req, res) {
        try {
            const { queue } = req.params;
            
            if (queue === 'all') {
                await queueManager.resumeAllQueues();
                res.json({
                    success: true,
                    message: 'All queues resumed successfully',
                });
            } else if (queueManager.queues[queue]) {
                await queueManager.queues[queue].resume();
                res.json({
                    success: true,
                    message: `Queue ${queue} resumed successfully`,
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: `Queue ${queue} not found`,
                });
            }
        } catch (error) {
            logger.error('Failed to resume queue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to resume queue',
                error: error.message,
            });
        }
    }

    // Clean queue
    async cleanQueue(req, res) {
        try {
            const { queue } = req.params;
            const { grace = 3600000 } = req.query; // Default 1 hour
            
            if (queueManager.queues[queue]) {
                await queueManager.queueUtils.cleanQueue(queueManager.queues[queue], parseInt(grace));
                res.json({
                    success: true,
                    message: `Queue ${queue} cleaned successfully`,
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: `Queue ${queue} not found`,
                });
            }
        } catch (error) {
            logger.error('Failed to clean queue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to clean queue',
                error: error.message,
            });
        }
    }

    // Emergency drain queue
    async drainQueue(req, res) {
        try {
            const { queue } = req.params;
            
            await queueManager.emergencyDrain(queue === 'all' ? null : queue);
            
            res.json({
                success: true,
                message: queue === 'all' 
                    ? 'All queues drained successfully'
                    : `Queue ${queue} drained successfully`,
            });
        } catch (error) {
            logger.error('Failed to drain queue:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to drain queue',
                error: error.message,
            });
        }
    }

    // Schedule job manually
    async scheduleJob(req, res) {
        try {
            const { queue, jobType, data, options = {} } = req.body;
            
            if (!queueManager.queues[queue]) {
                return res.status(404).json({
                    success: false,
                    message: `Queue ${queue} not found`,
                });
            }

            const job = await queueManager.queues[queue].add(jobType, data, options);
            
            res.json({
                success: true,
                message: 'Job scheduled successfully',
                data: {
                    jobId: job.id,
                    queue,
                    jobType,
                },
            });
        } catch (error) {
            logger.error('Failed to schedule job:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to schedule job',
                error: error.message,
            });
        }
    }

    // Get job details
    async getJobDetails(req, res) {
        try {
            const { queue, jobId } = req.params;
            
            if (!queueManager.queues[queue]) {
                return res.status(404).json({
                    success: false,
                    message: `Queue ${queue} not found`,
                });
            }

            const job = await queueManager.queues[queue].getJob(jobId);
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: `Job ${jobId} not found in queue ${queue}`,
                });
            }

            res.json({
                success: true,
                data: {
                    id: job.id,
                    name: job.name,
                    data: job.data,
                    opts: job.opts,
                    progress: job.progress(),
                    processedOn: job.processedOn,
                    finishedOn: job.finishedOn,
                    failedReason: job.failedReason,
                    returnvalue: job.returnvalue,
                    attemptsMade: job.attemptsMade,
                },
            });
        } catch (error) {
            logger.error('Failed to get job details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get job details',
                error: error.message,
            });
        }
    }

    // Health check endpoint
    async healthCheck(req, res) {
        try {
            const health = await queueManager.healthCheck();
            
            const statusCode = health.status === 'healthy' ? 200 : 
                             health.status === 'degraded' ? 206 : 503;
            
            res.status(statusCode).json({
                success: health.status !== 'unhealthy',
                data: health,
            });
        } catch (error) {
            logger.error('Queue health check failed:', error);
            res.status(503).json({
                success: false,
                message: 'Queue health check failed',
                error: error.message,
            });
        }
    }

    // Get queue jobs by status
    async getJobsByStatus(req, res) {
        try {
            const { queue, status } = req.params;
            const { start = 0, end = -1 } = req.query;
            
            if (!queueManager.queues[queue]) {
                return res.status(404).json({
                    success: false,
                    message: `Queue ${queue} not found`,
                });
            }

            let jobs;
            switch (status) {
                case 'waiting':
                    jobs = await queueManager.queues[queue].getWaiting(start, end);
                    break;
                case 'active':
                    jobs = await queueManager.queues[queue].getActive(start, end);
                    break;
                case 'completed':
                    jobs = await queueManager.queues[queue].getCompleted(start, end);
                    break;
                case 'failed':
                    jobs = await queueManager.queues[queue].getFailed(start, end);
                    break;
                case 'delayed':
                    jobs = await queueManager.queues[queue].getDelayed(start, end);
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid status. Use: waiting, active, completed, failed, or delayed',
                    });
            }

            const jobData = jobs.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress ? job.progress() : 0,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                failedReason: job.failedReason,
            }));

            res.json({
                success: true,
                data: jobData,
            });
        } catch (error) {
            logger.error('Failed to get jobs by status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get jobs by status',
                error: error.message,
            });
        }
    }
}

export default new QueueController();
