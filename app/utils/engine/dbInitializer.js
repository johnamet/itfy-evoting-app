#!/usr/bin/env node
/**
 * Database initialization utility
 * This module handles database initialization tasks like creating indexes,
 * setting up collections, and running database migrations
 */

import dbConnection from './db.js';

class DatabaseInitializer {
    constructor() {
        this.connection = null;
    }

    /**
     * Initialize the database
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.log('Initializing database...');
            
            // Ensure database connection
            this.connection = await dbConnection.connect();
            
            // Run initialization tasks
            await this.createIndexes();
            await this.setupCollections();
            
            console.log('Database initialization completed successfully');
            
        } catch (error) {
            console.error('Database initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Create database indexes for better performance
     * @returns {Promise<void>}
     */
    async createIndexes() {
        try {
            const db = this.connection.db;
            
            // User collection indexes
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            await db.collection('users').createIndex({ username: 1 }, { unique: true });
            await db.collection('users').createIndex({ 'profile.phone': 1 });
            await db.collection('users').createIndex({ role: 1 });
            await db.collection('users').createIndex({ isActive: 1 });
            
            // Event collection indexes
            await db.collection('events').createIndex({ name: 1 });
            await db.collection('events').createIndex({ startDate: 1, endDate: 1 });
            await db.collection('events').createIndex({ status: 1 });
            await db.collection('events').createIndex({ createdBy: 1 });
            
            // Vote collection indexes
            await db.collection('votes').createIndex({ eventId: 1, voterId: 1 }, { unique: true });
            await db.collection('votes').createIndex({ eventId: 1 });
            await db.collection('votes').createIndex({ candidateId: 1 });
            await db.collection('votes').createIndex({ voterId: 1 });
            await db.collection('votes').createIndex({ createdAt: 1 });
            
            // Candidate collection indexes
            await db.collection('candidates').createIndex({ eventId: 1 });
            await db.collection('candidates').createIndex({ userId: 1 });
            await db.collection('candidates').createIndex({ categoryId: 1 });
            
            // Category collection indexes
            await db.collection('categories').createIndex({ name: 1, eventId: 1 }, { unique: true });
            await db.collection('categories').createIndex({ eventId: 1 });
            
            // VoteBundle collection indexes
            await db.collection('votebundles').createIndex({ eventId: 1 });
            await db.collection('votebundles').createIndex({ voterId: 1 });
            await db.collection('votebundles').createIndex({ createdAt: 1 });
            
            // Activity collection indexes
            await db.collection('activities').createIndex({ userId: 1 });
            await db.collection('activities').createIndex({ type: 1 });
            await db.collection('activities').createIndex({ createdAt: 1 });
            
            // Coupon collection indexes
            await db.collection('coupons').createIndex({ code: 1 }, { unique: true });
            await db.collection('coupons').createIndex({ eventId: 1 });
            await db.collection('coupons').createIndex({ isActive: 1 });
            await db.collection('coupons').createIndex({ expiresAt: 1 });
            
            // CouponUsage collection indexes
            await db.collection('couponusages').createIndex({ couponId: 1, userId: 1 }, { unique: true });
            await db.collection('couponusages').createIndex({ couponId: 1 });
            await db.collection('couponusages').createIndex({ userId: 1 });
            
            console.log('Database indexes created successfully');
            
        } catch (error) {
            console.error('Error creating database indexes:', error.message);
            // Don't throw error for index creation failures as they might already exist
        }
    }

    /**
     * Set up database collections with validation rules
     * @returns {Promise<void>}
     */
    async setupCollections() {
        try {
            const db = this.connection.db;
            const collections = await db.listCollections().toArray();
            const collectionNames = collections.map(col => col.name);
            
            // Define collections that should exist
            const requiredCollections = [
                'users', 'events', 'votes', 'candidates', 'categories',
                'votebundles', 'activities', 'coupons', 'couponusages',
                'roles', 'slides', 'forms'
            ];
            
            // Create collections if they don't exist
            for (const collectionName of requiredCollections) {
                if (!collectionNames.includes(collectionName)) {
                    await db.createCollection(collectionName);
                    console.log(`Created collection: ${collectionName}`);
                }
            }
            
            console.log('Database collections setup completed');
            
        } catch (error) {
            console.error('Error setting up database collections:', error.message);
            throw error;
        }
    }

    /**
     * Drop all collections (use with caution!)
     * @returns {Promise<void>}
     */
    async dropAllCollections() {
        try {
            const db = this.connection.db;
            const collections = await db.listCollections().toArray();
            
            for (const collection of collections) {
                await db.collection(collection.name).drop();
                console.log(`Dropped collection: ${collection.name}`);
            }
            
            console.log('All collections dropped successfully');
            
        } catch (error) {
            console.error('Error dropping collections:', error.message);
            throw error;
        }
    }

    /**
     * Check database health
     * @returns {Promise<Object>} Database health status
     */
    async checkHealth() {
        try {
            const db = this.connection.db;
            const admin = db.admin();
            
            // Ping the database
            await admin.ping();
            
            // Get database stats
            const stats = await db.stats();
            
            // Get collection count
            const collections = await db.listCollections().toArray();
            
            return {
                status: 'healthy',
                connected: dbConnection.isConnectionAlive(),
                database: db.databaseName,
                collections: collections.length,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexSize: stats.indexSize,
                objects: stats.objects
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                connected: false
            };
        }
    }

    /**
     * Alias for initialize method
     * @returns {Promise<void>}
     */
    async init() {
        return await this.initialize();
    }
}

// Create a singleton instance
const dbInitializer = new DatabaseInitializer();

export default dbInitializer;
export { DatabaseInitializer };
