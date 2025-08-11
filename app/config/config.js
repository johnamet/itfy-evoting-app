#!/usr/bin/env node
/**
 * The configuration file for the application.
 * This file exports the configuration settings used throughout the application.
 * It includes settings for the server, database, and other environment variables.
 */ 

import dotenv from 'dotenv';
dotenv.config();

class Config {
    
    static serverConfig = {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        apiVersion: process.env.API_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    }

    static databaseConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 27017,
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'password',
        name: process.env.DB_NAME || 'database'
    }

    static jwtConfig = {
        secret: process.env.JWT_SECRET || 'your_jwt_secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    }

    static socketConfig = {
        // Socket.IO configuration options
        pingTimeout: process.env.SOCKET_PING_TIMEOUT || 60000,
        pingInterval: process.env.SOCKET_PING_INTERVAL || 25000,
        maxConnections: process.env.SOCKET_MAX_CONNECTIONS || 1000,
        // Enable/disable specific transports
        enableWebSocket: process.env.SOCKET_ENABLE_WEBSOCKET !== 'false',
        enablePolling: process.env.SOCKET_ENABLE_POLLING !== 'false',
        // Room configuration
        maxRoomSize: process.env.SOCKET_MAX_ROOM_SIZE || 100,
        // Authentication
        requireAuth: process.env.SOCKET_REQUIRE_AUTH === 'true'
    }
}

export default Config;