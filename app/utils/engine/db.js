#!/usr/bin/env node
/**
 * Database connection            const options = {
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                bufferMaxEntries: 0, // Disable mongoose buffering
                bufferCommands: false, // Disable mongoose buffering
            };module
 * This module handles MongoDB connection using Mongoose
 * It uses configuration from the config.js file
 */

import mongoose from 'mongoose';
import Config from '../../config/config.js';

class DatabaseConnection {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    /**
     * Build MongoDB connection URI from config
     * @returns {string} MongoDB connection URI
     */
    buildConnectionURI() {
        const { host, port, user, password, name } = Config.databaseConfig;
        
        // If user and password are provided, include them in the URI
        if (user && password && user !== 'user' && password !== 'password') {
            return `mongodb://${user}:${password}@${host}:${port}/${name}`;
        }
        
        // For development without authentication
        return `mongodb://${host}:${port}/${name}`;
    }

    /**
     * Connect to MongoDB database
     * @returns {Promise<mongoose.Connection>} Database connection
     */
    async connect() {
        try {
            if (this.isConnected) {
                console.log('Database is already connected');
                return this.connection;
            }

            const uri = this.buildConnectionURI();
            console.log(`Connecting to database: ${Config.databaseConfig.name}`);

            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                // bufferMaxEntries: 0, // Disable mongoose buffering
                bufferCommands: false, // Disable mongoose buffering
            };

            await mongoose.connect(uri, options);
            
            this.connection = mongoose.connection;
            this.isConnected = true;

            console.log('Successfully connected to MongoDB');
            
            // Set up connection event listeners
            this.setupEventListeners();
            
            return this.connection;
            
        } catch (error) {
            console.error('Database connection error:', error.message);
            throw new Error(`Failed to connect to database: ${error.message}`);
        }
    }

    /**
     * Set up database connection event listeners
     */
    setupEventListeners() {
        this.connection.on('error', (error) => {
            console.error('Database connection error:', error);
            this.isConnected = false;
        });

        this.connection.on('disconnected', () => {
            console.log('Database disconnected');
            this.isConnected = false;
        });

        this.connection.on('reconnected', () => {
            console.log('Database reconnected');
            this.isConnected = true;
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            await this.disconnect();
            process.exit(0);
        });
    }

    /**
     * Disconnect from MongoDB database
     * @returns {Promise<void>}
     */
    async disconnect() {
        try {
            if (this.isConnected) {
                await mongoose.connection.close();
                this.isConnected = false;
                console.log('Database connection closed');
            }
        } catch (error) {
            console.error('Error closing database connection:', error.message);
            throw error;
        }
    }

    /**
     * Check if database is connected
     * @returns {boolean} Connection status
     */
    isConnectionAlive() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }

    /**
     * Get current database connection
     * @returns {mongoose.Connection|null} Current connection
     */
    getConnection() {
        return this.connection;
    }

    /**
     * Get database connection statistics
     * @returns {Object} Connection statistics
     */
    getConnectionStats() {
        if (!this.connection) {
            return { connected: false, readyState: 'disconnected' };
        }

        const readyStates = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            connected: this.isConnected,
            readyState: readyStates[mongoose.connection.readyState],
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }
}

// Create a singleton instance
const dbConnection = new DatabaseConnection();

export default dbConnection;
export { DatabaseConnection };