#!/usr/bin/env node
/**
 * Database utilities module
 * This module provides common database operations and utilities
 */

import mongoose from 'mongoose';
import dbConnection from './db.js';

class DatabaseUtils {
    
    /**
     * Check if a document exists
     * @param {string} model - Model name
     * @param {Object} query - Query object
     * @returns {Promise<boolean>} True if document exists
     */
    static async exists(model, query) {
        try {
            const Model = mongoose.model(model);
            const doc = await Model.findOne(query).lean();
            return !!doc;
        } catch (error) {
            console.error(`Error checking if document exists in ${model}:`, error.message);
            return false;
        }
    }

    /**
     * Count documents in a collection
     * @param {string} model - Model name
     * @param {Object} query - Query object
     * @returns {Promise<number>} Document count
     */
    static async count(model, query = {}) {
        try {
            const Model = mongoose.model(model);
            return await Model.countDocuments(query);
        } catch (error) {
            console.error(`Error counting documents in ${model}:`, error.message);
            return 0;
        }
    }

    /**
     * Perform aggregation query
     * @param {string} model - Model name
     * @param {Array} pipeline - Aggregation pipeline
     * @returns {Promise<Array>} Aggregation results
     */
    static async aggregate(model, pipeline) {
        try {
            const Model = mongoose.model(model);
            return await Model.aggregate(pipeline);
        } catch (error) {
            console.error(`Error performing aggregation on ${model}:`, error.message);
            return [];
        }
    }

    /**
     * Bulk write operations
     * @param {string} model - Model name
     * @param {Array} operations - Array of bulk operations
     * @returns {Promise<Object>} Bulk write result
     */
    static async bulkWrite(model, operations) {
        try {
            const Model = mongoose.model(model);
            return await Model.bulkWrite(operations);
        } catch (error) {
            console.error(`Error performing bulk write on ${model}:`, error.message);
            throw error;
        }
    }

    /**
     * Create a database transaction
     * @param {Function} operations - Function containing operations to run in transaction
     * @returns {Promise<any>} Transaction result
     */
    static async transaction(operations) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();
            const result = await operations(session);
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            console.error('Transaction failed:', error.message);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Create a backup of a collection
     * @param {string} model - Model name
     * @param {string} backupName - Name for the backup collection
     * @returns {Promise<boolean>} Backup success status
     */
    static async backup(model, backupName) {
        try {
            const connection = dbConnection.getConnection();
            const db = connection.db;
            
            const sourceCollection = db.collection(model.toLowerCase() + 's');
            const backupCollection = db.collection(backupName);
            
            // Copy all documents
            const documents = await sourceCollection.find({}).toArray();
            if (documents.length > 0) {
                await backupCollection.insertMany(documents);
            }
            
            console.log(`Backup created: ${documents.length} documents copied from ${model} to ${backupName}`);
            return true;
            
        } catch (error) {
            console.error(`Error creating backup for ${model}:`, error.message);
            return false;
        }
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} Database statistics
     */
    static async getStats() {
        try {
            const connection = dbConnection.getConnection();
            const db = connection.db;
            
            const stats = await db.stats();
            const collections = await db.listCollections().toArray();
            
            const collectionStats = {};
            for (const collection of collections) {
                const collStats = await db.collection(collection.name).stats();
                collectionStats[collection.name] = {
                    count: collStats.count,
                    size: collStats.size,
                    avgObjSize: collStats.avgObjSize,
                    indexSizes: collStats.indexSizes
                };
            }
            
            return {
                database: {
                    name: db.databaseName,
                    collections: collections.length,
                    dataSize: stats.dataSize,
                    storageSize: stats.storageSize,
                    indexSize: stats.indexSize,
                    objects: stats.objects
                },
                collections: collectionStats
            };
            
        } catch (error) {
            console.error('Error getting database statistics:', error.message);
            return null;
        }
    }

    /**
     * Validate ObjectId
     * @param {string} id - ID to validate
     * @returns {boolean} True if valid ObjectId
     */
    static isValidObjectId(id) {
        return mongoose.Types.ObjectId.isValid(id);
    }

    /**
     * Convert string to ObjectId
     * @param {string} id - String ID
     * @returns {mongoose.Types.ObjectId} ObjectId
     */
    static toObjectId(id) {
        if (!this.isValidObjectId(id)) {
            throw new Error(`Invalid ObjectId: ${id}`);
        }
        return new mongoose.Types.ObjectId(id);
    }

    /**
     * Generate a new ObjectId
     * @returns {mongoose.Types.ObjectId} New ObjectId
     */
    static generateObjectId() {
        return new mongoose.Types.ObjectId();
    }
}

export default DatabaseUtils;
