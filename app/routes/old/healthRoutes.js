/**
 * Health Check Routes
 * 
 * Provides health monitoring endpoints
 */

import express from 'express';
import HealthCheckService from '../services/HealthCheckService.js';
import config from '../config/ConfigManager.js';

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Quick health check
 *     description: Returns basic health status of the application
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, warning, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 message:
 *                   type: string
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req, res) => {
    try {
        const health = await HealthCheckService.getQuickStatus();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns comprehensive health status including all subsystems
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, warning, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 version:
 *                   type: string
 *                 environment:
 *                   type: string
 *                 checks:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 */
router.get('/detailed', async (req, res) => {
    try {
        const health = await HealthCheckService.runAllChecks();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'warning' ? 200 : 503;
        
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @swagger
 * /health/system:
 *   get:
 *     summary: System information
 *     description: Returns system and runtime information
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/system', (req, res) => {
    try {
        const systemInfo = HealthCheckService.getSystemInfo();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            system: systemInfo
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Kubernetes-style readiness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
    try {
        const health = await HealthCheckService.getQuickStatus();
        
        if (health.status === 'healthy') {
            res.status(200).send('OK');
        } else {
            res.status(503).send('Not Ready');
        }
    } catch (error) {
        res.status(503).send('Not Ready');
    }
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Kubernetes-style liveness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req, res) => {
    res.status(200).send('OK');
});

export default router;
