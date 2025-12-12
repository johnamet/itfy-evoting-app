import express from 'express';
import QueueController from '../controllers/QueueController.js';
import { authenticate, requireLevel } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     QueueStats:
 *       type: object
 *       properties:
 *         waiting:
 *           type: integer
 *         active:
 *           type: integer
 *         completed:
 *           type: integer
 *         failed:
 *           type: integer
 *         delayed:
 *           type: integer
 *         paused:
 *           type: boolean
 *     QueueHealth:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *         queues:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/queue/dashboard:
 *   get:
 *     summary: Get queue dashboard statistics
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                     health:
 *                       $ref: '#/components/schemas/QueueHealth'
 */
router.get('/dashboard', requireLevel(1), QueueController.getDashboard);

/**
 * @swagger
 * /api/queue/health:
 *   get:
 *     summary: Get queue health status
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue system is healthy
 *       206:
 *         description: Queue system is degraded
 *       503:
 *         description: Queue system is unhealthy
 */
router.get('/health', requireLevel(1), QueueController.healthCheck);

/**
 * @swagger
 * /api/queue/failed:
 *   get:
 *     summary: Get failed jobs from all queues
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of failed jobs to return
 *       - in: query
 *         name: queue
 *         schema:
 *           type: string
 *         description: Specific queue name to filter by
 *     responses:
 *       200:
 *         description: Failed jobs retrieved successfully
 */
router.get('/failed', requireLevel(1), QueueController.getFailedJobs);

/**
 * @swagger
 * /api/queue/retry:
 *   post:
 *     summary: Retry failed jobs
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               queue:
 *                 type: string
 *                 description: Specific queue name (optional)
 *               jobId:
 *                 type: string
 *                 description: Specific job ID (optional)
 *     responses:
 *       200:
 *         description: Jobs retried successfully
 */
router.post('/retry', requireLevel(1), QueueController.retryFailedJobs);

/**
 * @swagger
 * /api/queue/{queue}/pause:
 *   post:
 *     summary: Pause a specific queue or all queues
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queue
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name or 'all' for all queues
 *     responses:
 *       200:
 *         description: Queue(s) paused successfully
 *       404:
 *         description: Queue not found
 */
router.post('/:queue/pause', requireLevel(1), QueueController.pauseQueue);

/**
 * @swagger
 * /api/queue/{queue}/resume:
 *   post:
 *     summary: Resume a specific queue or all queues
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queue
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name or 'all' for all queues
 *     responses:
 *       200:
 *         description: Queue(s) resumed successfully
 *       404:
 *         description: Queue not found
 */
router.post('/:queue/resume', requireLevel(1), QueueController.resumeQueue);

/**
 * @swagger
 * /api/queue/{queue}/clean:
 *   post:
 *     summary: Clean old completed and failed jobs from a queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queue
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name
 *       - in: query
 *         name: grace
 *         schema:
 *           type: integer
 *           default: 3600000
 *         description: Grace period in milliseconds
 *     responses:
 *       200:
 *         description: Queue cleaned successfully
 *       404:
 *         description: Queue not found
 */
router.post('/:queue/clean', requireLevel(3), QueueController.cleanQueue);

/**
 * @swagger
 * /api/queue/{queue}/drain:
 *   post:
 *     summary: Emergency drain a queue (remove all jobs)
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queue
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name or 'all' for all queues
 *     responses:
 *       200:
 *         description: Queue(s) drained successfully
 */
router.post('/:queue/drain', requireLevel(3), QueueController.drainQueue);

/**
 * @swagger
 * /api/queue/schedule:
 *   post:
 *     summary: Manually schedule a job
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queue
 *               - jobType
 *               - data
 *             properties:
 *               queue:
 *                 type: string
 *                 description: Queue name
 *               jobType:
 *                 type: string
 *                 description: Job type/name
 *               data:
 *                 type: object
 *                 description: Job data
 *               options:
 *                 type: object
 *                 description: Job options (delay, priority, etc.)
 *     responses:
 *       200:
 *         description: Job scheduled successfully
 *       404:
 *         description: Queue not found
 */
router.post('/schedule', requireLevel(3), QueueController.scheduleJob);

/**
 * @swagger
 * /api/queue/{queue}/job/{jobId}:
 *   get:
 *     summary: Get detailed information about a specific job
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queue
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details retrieved successfully
 *       404:
 *         description: Queue or job not found
 */
router.get('/:queue/job/:jobId', requireLevel(1), QueueController.getJobDetails);

/**
 * @swagger
 * /api/queue/{queue}/jobs/{status}:
 *   get:
 *     summary: Get jobs by status from a specific queue
 *     tags: [Queue Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queue
 *         required: true
 *         schema:
 *           type: string
 *         description: Queue name
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [waiting, active, completed, failed, delayed]
 *         description: Job status
 *       - in: query
 *         name: start
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Start index
 *       - in: query
 *         name: end
 *         schema:
 *           type: integer
 *           default: -1
 *         description: End index (-1 for all)
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 *       404:
 *         description: Queue not found
 *       400:
 *         description: Invalid status
 */
router.get('/:queue/jobs/:status', requireLevel(1), QueueController.getJobsByStatus);

export default router;
