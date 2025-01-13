/**
 * StorageEngine
 * 
 * A class to handle database connections and operations using MongoDB.
 */

import pkg, { ObjectId } from 'mongodb'
import pushNotification from '../notificationUtil.js';

const { MongoClient } = pkg;

// Constants for database configuration
const DB_NAME = process.env["DB_NAME"] || "evoting_db";
const DB_HOST = process.env["DB_HOST"] || "localhost";
const DB_PORT = parseInt(process.env["DB_PORT"]) || 27017;
const DB_USER = process.env["DB_USER"] || "itfy-user";
const DB_PASS = process.env["DB_PASSWORD"] || "itfy-password";

class StorageEngine {
    /**
     * Initializes the StorageEngine with a MongoDB client and database instance.
     */
    constructor() {
        this._url = `mongodb://${DB_HOST}:${DB_PORT}`; // MongoDB connection URL
        this.client = new MongoClient(this._url); // Create a new MongoDB client
        this.db = null; // Placeholder for the database instance
    }

    /**
     * Connects to the MongoDB database.
     *
     * @returns {Promise<void>} - Resolves when the connection is established.
     */
    async connect() {
        try {
            await this.client.connect(); // Establish the connection
            this.db = this.client.db(DB_NAME); // Get the database instance
            console.log(`Connected to MongoDB database: ${DB_NAME}`);
        } catch (error) {
            console.error("Failed to connect to MongoDB:", error);
            throw error;
        }
    }

    /**
     * Disconnects from the MongoDB database.
     *
     * @returns {Promise<void>} - Resolves when the connection is closed.
     */
    async disconnect() {
        try {
            await this.client.close(); // Close the connection
            console.log("Disconnected from MongoDB");
        } catch (error) {
            console.error("Failed to disconnect from MongoDB:", error);
            throw error;
        }
    }

    /**
     * Retrieves a collection from the database.
     *
     * @param {string} collectionName - The name of the collection to retrieve.
     * @returns {Collection} - The MongoDB collection instance.
     */
    getCollection(collectionName) {
        if (!this.db) {
            throw new Error("Database is not connected. Call connect() first.");
        }
        return this.db.collection(collectionName); // Return the collection instance
    }

    /**
     * Executes a database operation with centralized error handling.
     *
     * @param {Function} operation - The operation to execute.
     * @returns {Promise<any>} - The result of the operation.
     */
    async execute(operation) {
        try {
            return await operation();
        } catch (error) {
            console.error("Database operation failed:", error);
            throw error;
        }
    }

    /**
     * Inserts a new document into a collection.
     *
     * @param {string} collectionName - The collection to insert into.
     * @param {object} data - The document to insert.
     * @returns {Promise<any>} - The result of the insert operation.
     */
    async insert(collectionName, data) {
        return this.execute(() =>
            this.getCollection(collectionName).insertOne(data)
        );
    }

    /**
     * Inserts multiple documents into a collection.
     *
     * @param {string} collectionName - The collection to insert into.
     * @param {Array<object>} data - The array of documents to insert.
     * @returns {Promise<any>} - The result of the insert operation.
     */
    async insertMany(collectionName, data) {
        return this.execute(() =>
            this.getCollection(collectionName).insertMany(data)
        );
    }

    /**
     * Updates a document in a collection.
     *
     * @param {string} collectionName - The collection to update in.
     * @param {object} query - The query to find the document.
     * @param {object} update - The update operations.
     * @returns {Promise<any>} - The result of the update operation.
     */
    async update(collectionName, query, update) {
        // Ensure the update uses atomic operators
        const atomicUpdate = { $set: update };

        return this.execute(() =>
            this.getCollection(collectionName).updateOne(query, atomicUpdate)
        );
    }


    /**
     * Deletes a document from a collection.
     *
     * @param {string} collectionName - The collection to delete from.
     * @param {object} query - The query to find the document.
     * @returns {Promise<any>} - The result of the delete operation.
     */
    async delete(collectionName, query) {
        return this.execute(() =>
            this.getCollection(collectionName).deleteOne(query)
        );
    }

    /**
     * Deletes multiple documents from a collection.
     *
     * @param {string} collectionName - The collection to delete from.
     * @param {object} query - The query to find the documents.
     * @returns {Promise<any>} - The result of the delete operation.
     */
    async deleteMany(collectionName, query) {
        return this.execute(() =>
            this.getCollection(collectionName).deleteMany(query)
        );
    }

     /**
     * Fetches all documents from a collection.
     *
     * @param {string} collectionName - The collection to fetch from.
     * @returns {Promise<Array<object>>} - Array of all documents.
     */
    async all(collectionName, options={skip:0, limit:0}) {
        return this.execute(() => 
            this.getCollection(collectionName).find({}).skip(options.skip).limit(options.limit).toArray()
        );
    }

    /**
     * Fetches documents matching a specific query from a collection.
     *
     * @param {string} collectionName - The collection to query.
     * @param {object} query - The query object.
     * @returns {Promise<Array<object>>} - Array of matching documents.
     */
    async query(collectionName, query, options={skip:0, limit:0}) {
        return this.execute(() => this.getCollection(collectionName).find(query)
        .toArray());
    }

    /**
     * Fetches a single document matching a specific query from a collection.
     *
     * @param {string} collectionName - The collection to query.
     * @param {object} query - The query object.
     * @returns {Promise<object|null>} - The matching document or null if not found.
     */
    async findOne(collectionName, query) {
       Object.keys(query).forEach(key => {
            if(key === "id"){
                query['id'] = new Object(query['id']);
            }
        });
        return this.execute(() => this.getCollection(collectionName).findOne(query));
    }

    /**
     * Fetches documents matching a specific query with additional options.
     *
     * @param {string} collectionName - The collection to query.
     * @param {object} query - The query object.
     * @param {object} options - Additional options for the query (e.g., sort, limit).
     * @returns {Promise<Array<object>>} - Array of matching documents.
     */
    async queryWithOptions(collectionName, query, options) {
        return this.execute(() =>
            this.getCollection(collectionName).find(query, options).toArray()
        );
    }

    /**
     * Counts the number of documents in a collection matching a query.
     *
     * @param {string} collectionName - The collection to count documents in.
     * @param {object} query - The query to filter documents (default is {}).
     * @returns {Promise<number>} - The count of matching documents.
     */
    async count(collectionName, query = {}) {
        return this.execute(() =>
            this.getCollection(collectionName).countDocuments(query)
        );
    }

      /**
     * Checks if the database connection is active.
     *
     * @returns {Promise<boolean>} - True if the connection is active, false otherwise.
     */
    async isConnected() {
        try {
            await this.client.db(DB_NAME).command({ ping: 1 });
            return true;
        } catch (error) {
            console.error("Database connection check failed:", error);
            return false;
        }
    }

    /**
     * Measures the latency of the database connection.
     *
     * @returns {Promise<number>} - Latency in milliseconds.
     */
    async getLatency() {
        const start = Date.now();
        try {
            await this.client.db(DB_NAME).command({ ping: 1 });
            const latency = Date.now() - start;
            return latency;
        } catch (error) {
            console.error("Failed to measure database latency:", error);
            throw error;
        }
    }

    async watcher(collection, operationType,){

        const collectionStream = this.getCollection(collection).watch();

        collectionStream.on("change", (change) => {
            if(change.operationType === operationType){

                return operationType === "update" ? change.UpdateDescription.updatedFields : change.fullDocument;

            }
        })
    }

    /**
     * Performs an aggregation on a collection.
     *
     * @param {string} collectionName - The collection to aggregate.
     * @param {Array<object>} pipeline - The aggregation pipeline.
     * @returns {Promise<Array<object>>} - The result of the aggregation.
     */
    async aggregate(collectionName, pipeline) {
        return this.execute(() =>
            this.getCollection(collectionName).aggregate(pipeline).toArray()
        );
    }
/**
 * Watches a collection for a specific operation type and sends a push notification on change.
 *
 * @param {string} collection - The collection to watch.
 * @param {string} operationType - The operation type to look out for (e.g., "insert", "update", "delete").
 * @param {Function} sendNotification - The function to send a push notification.
 */
async watcher(collection, operationType = null, sendNotification) {
    const collectionStream = this.getCollection(collection).watch();

    collectionStream.on("change", (change) => {
        let notificationData = null;
        if (operationType && change.operationType === operationType) {
            notificationData = {
                operation: change.operationType,
                id: change.documentKey._id,
                data: operationType === "update" ? change.updateDescription.updatedFields : change.fullDocument
            };

        }else{
            notificationData = {
                operation: change.operationType,
                id: change.documentKey._id,
                data: change.fullDocument
            };
        }

        sendNotification("databaseStream",notificationData);
    });
}

/**
 * Watches all collections for a specific operation type and sends a push notification on change.
 *
 * @param {string} collection - The collection to watch.
 * @param {string} operationType - The operation type to look out for (e.g., "insert", "update", "delete").
 * @param {Function} sendNotification - The function to send a push notification.
 */

async watchAllCollections(sendNotification) {
    const collections = await this.db.listCollections().toArray();

    collections.forEach((collection) => {
        this.watcher(collection=collection.name, sendNotification=sendNotification);
    });
}
}


const storage = new StorageEngine();
await storage.connect();



// await storage.watchAllCollections(pushNotification);

export {StorageEngine};

export default storage;
