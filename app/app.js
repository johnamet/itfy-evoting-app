#!/usr/bin/env node
/**
 * The main entry point for the application.
 * This file initializes the application and starts the server.
 * It requires the necessary modules and sets up the environment.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './config/swagger.js';
import Config from './config/config.js';
import dbConnection from './utils/engine/db.js';
import dbInitializer from './utils/engine/dbInitializer.js';
import { cacheStatsMiddleware, cacheManagementMiddleware, cacheMiddleware } from './utils/engine/cacheMiddleware.js';
import apiRoutes from './routes/index.js';
import geoip from 'geoip-lite';


const app = express();
const server = createServer(app);

const PORT = Config.serverConfig.port;

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

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
    cors: {
        origin: corsOptions.origin,
        methods: ["GET", "POST"],
        credentials: true
    },
    // Optional: Configure additional Socket.IO options
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

app.use(cors(corsOptions));


// Trust proxy so real IP is captured if behind load balancer / reverse proxy
app.set("trust proxy", true);

// Middleware to attach geo info
app.use((req, res, next) => {
    try {
        // Get client IP
        const ip = req.headers['x-forwarded-for']?.split(",")[0] || req.socket.remoteAddress;

        // Lookup geo info
        const geo = geoip.lookup(ip);

        console.log(geo)

        // Attach to request object
        req.clientIp = ip;
        req.geo = geo;

        // Continue
        next();
    } catch (err) {
        console.error("Geo middleware error:", err);
        next(); // don't block request
    }
});


// Middleware to capture raw body for webhook endpoints
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Middleware to parse JSON for other endpoints
app.use((req, res, next) => {
    if (req.path === '/api/v1/payments/webhook') {
        // For webhook, keep the raw body and parse JSON manually
        req.rawBody = req.body;
        try {
            req.body = JSON.parse(req.body.toString('utf8'));
        } catch (e) {
            console.error('Error parsing webhook JSON:', e);
            req.body = {};
        }
    }
    next();
});

app.use(express.json());

// Make io available throughout the app
app.set('io', io);

// Add cache middleware for API responses
app.use('/api', cacheMiddleware({
    ttl: 1800000, // 30 minutes
    condition: (req) => req.method === 'GET'
}));

// Mount API routes
app.use('/api/v1', apiRoutes);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "ITFY E-Voting API Documentation"
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
});

// Cache statistics endpoint
app.get('/cache/stats', cacheStatsMiddleware());

// Cache management endpoint (for development/admin use)
app.post('/cache/manage', cacheManagementMiddleware());

app.get("/", (req, res) => {
    return res.send({
        success: true,
        message: "Welcome to ITFY Backend Server",
        version: Config.serverConfig.apiVersion,
        environment: Config.serverConfig.environment,
        database: dbConnection.getConnectionStats(),
        websocket: {
            enabled: true,
            connectedClients: io.engine.clientsCount || 0
        }
    });
});

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
            database: dbHealth,
            websocket: {
                enabled: true,
                connectedClients: io.engine.clientsCount || 0,
                status: 'active'
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: 'Health check failed',
            error: error.message
        });
    }
});

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
});

// Example API endpoint for testing cache invalidation
app.post("/api/invalidate-test", (req, res) => {
    
    return res.json({
        success: true,
        message: "This POST request will invalidate related cache entries",
        timestamp: new Date().toISOString()
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Send welcome message
    socket.emit('welcome', {
        message: 'Connected to ITFY WebSocket server',
        clientId: socket.id,
        timestamp: new Date().toISOString()
    });
    
    // Handle authentication if needed
    socket.on('authenticate', (data) => {
        // Implement JWT token verification here if needed
        console.log('Client authentication attempt:', data);
        // socket.user = verifiedUser; // Store user info after verification
    });
    
    // Handle joining rooms (useful for voting sessions, notifications, etc.)
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socket.emit('room-joined', { room: roomId });
        socket.to(roomId).emit('user-joined-room', { 
            userId: socket.id, 
            room: roomId 
        });
        console.log(`Client ${socket.id} joined room: ${roomId}`);
    });
    
    // Handle leaving rooms
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        socket.emit('room-left', { room: roomId });
        socket.to(roomId).emit('user-left-room', { 
            userId: socket.id, 
            room: roomId 
        });
        console.log(`Client ${socket.id} left room: ${roomId}`);
    });
    
    // Handle real-time voting updates
    socket.on('vote-cast', (data) => {
        console.log('Vote cast:', data);
        // Broadcast to specific voting session room
        if (data.sessionId) {
            socket.to(`voting-${data.sessionId}`).emit('vote-update', {
                type: 'vote-cast',
                timestamp: new Date().toISOString(),
                data: data
            });
        }
    });
    
    // Handle real-time notifications
    socket.on('send-notification', (data) => {
        // Broadcast notification to specific users or rooms
        if (data.targetRoom) {
            io.to(data.targetRoom).emit('notification', {
                ...data,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    // Handle general messages
    socket.on('message', (data) => {
        console.log('Message received:', data);
        // Echo back or broadcast as needed
        socket.emit('message-received', {
            original: data,
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
    
    // Handle connection errors
    socket.on('error', (error) => {
        console.error(`Socket error for client ${socket.id}:`, error);
    });
});

// Middleware to broadcast system-wide notifications
export const broadcastSystemNotification = (message, data = {}) => {
    io.emit('system-notification', {
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

// Middleware to send notifications to specific rooms
export const broadcastToRoom = (room, event, data) => {
    io.to(room).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
    });
};

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
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`API URL: http://localhost:${PORT}`);
            console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
            console.log(`WebSocket URL: ws://localhost:${PORT}`);
            console.log(`Environment: ${Config.serverConfig.environment}`);
            console.log(`Health Check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

// Start the application
startServer();