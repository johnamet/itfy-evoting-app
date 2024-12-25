/**
 * StorageEngine
 * 
 * A class to handle database connections and operations using MongoDB.
 */

import pkg from 'mongodb'

const { MongoClient } = pkg;

// Constants for database configuration
const DB_NAME = process.env["DB_NAME"] || "evoting_db";
const DB_HOST = process.env["DB_HOST"] || "localhost";
const DB_PORT = parseInt(process.env["DB_PORT"]) || 27017;

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
        return this.execute(() =>
            this.getCollection(collectionName).updateOne(query, update)
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
    async all(collectionName) {
        return this.execute(() => this.getCollection(collectionName).find({}).toArray());
    }

    /**
     * Fetches documents matching a specific query from a collection.
     *
     * @param {string} collectionName - The collection to query.
     * @param {object} query - The query object.
     * @returns {Promise<Array<object>>} - Array of matching documents.
     */
    async query(collectionName, query) {
        return this.execute(() => this.getCollection(collectionName).find(query).toArray());
    }

    /**
     * Fetches a single document matching a specific query from a collection.
     *
     * @param {string} collectionName - The collection to query.
     * @param {object} query - The query object.
     * @returns {Promise<object|null>} - The matching document or null if not found.
     */
    async findOne(collectionName, query) {
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
            this.getCollection('base').countDocuments(query)
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
}

const storage = new StorageEngine();
await storage.connect();

export default storage;
