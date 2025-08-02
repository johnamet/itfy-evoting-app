#!/usr/bin/env node
/**
 * The main entry point for the application.
 * This file initializes the application and starts the server.
 * It requires the necessary modules and sets up the environment.
 */

import express from 'express';
import cors from 'cors';
import Config from './config/config.js';
import dbConnection from './utils/engine/db.js';
import dbInitializer from './utils/engine/dbInitializer.js';
import { cacheStatsMiddleware, cacheManagementMiddleware, cacheMiddleware } from './utils/engine/cacheMiddleware.js';
import apiRoutes from './routes/index.js';

const app = express()

const PORT = Config.serverConfig.port

// Configure CORS
const corsOptions = {
    origin: [
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://192.168.197.195:3001'
        // Add production frontend URL when available
        // 'https://your-frontend-domain.com'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json())

// Add cache middleware for API responses
app.use('/api', cacheMiddleware({
    ttl: 1800000, // 30 minutes
    condition: (req) => req.method === 'GET'
}))

// Mount API routes
app.use('/api/v1', apiRoutes)

// Cache statistics endpoint
app.get('/cache/stats', cacheStatsMiddleware())

// Cache management endpoint (for development/admin use)
app.post('/cache/manage', cacheManagementMiddleware())

app.get("/", (req, res) => {
    return res.send({
        success: true,
        message: "Welcome to ITFY Backend Server",
        version: Config.serverConfig.apiVersion,
        environment: Config.serverConfig.environment,
        database: dbConnection.getConnectionStats()
    })
})

// Health check endpoint
app.get("/health", async (req, res) => {
    try {
        const dbHealth = await dbInitializer.checkHealth();
        return res.send({
            success: true,
            timestamp: new Date().toISOString(),
            server: {
                status: 'running',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: Config.serverConfig.apiVersion,
                environment: Config.serverConfig.environment
            },
            database: dbHealth
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: 'Health check failed',
            error: error.message
        });
    }
})

// Example API endpoint that demonstrates caching
app.get("/api/time", (req, res) => {
    return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: "This response will be cached for 30 minutes",
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage()
        }
    });
})

// Example API endpoint for testing cache invalidation
app.post("/api/invalidate-test", (req, res) => {
    return res.json({
        success: true,
        message: "This POST request will invalidate related cache entries",
        timestamp: new Date().toISOString()
    });
})

// Initialize database connection and start server
async function startServer() {
    try {
        // Connect to database
        await dbConnection.connect();
        
        // Initialize database (create indexes, collections, etc.)
        if (Config.serverConfig.environment === 'development') {
            await dbInitializer.initialize();
        }
        
        // Start the server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
            console.log(`API URL: http://localhost:${PORT}`)
            console.log(`Environment: ${Config.serverConfig.environment}`)
            console.log(`Health Check: http://localhost:${PORT}/health`)
        })
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

// Start the application
startServer();