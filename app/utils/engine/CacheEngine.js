import { createClient } from 'redis';

/**
 * Class for performing operations with Redis service
 */
class CacheEngine {
    constructor() {
        const REDIS_HOST = process.env.REDIS_HOST || "localhost";
        const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379;

        this.client = createClient({
            socket: {
                host: REDIS_HOST,
                port: REDIS_PORT,
            },
        });

        // Connect to Redis
        this.client.connect()
            .then(() => {
                console.log('Redis client connected to the server');
            })
            .catch(error => {
                console.error(`Redis client error: ${error.message}`);
            });
    }

    /**
     * Checks if connection to Redis is alive
     * @return {boolean} true if connection is alive, false otherwise
     */
    isConnected() {
        return this.client.isOpen;
    }

    /**
     * Gets the value corresponding to the key in Redis
     * @param {string} key - The key to search for in Redis
     * @return {Promise<string>} Value of the key
     */
    async get(key) {
        try {
            return await this.client.get(key);
        } catch (error) {
            console.error(`Error getting key "${key}":`, error);
            throw error;
        }
    }

    /**
     * Creates a new key in Redis with a specific TTL
     * @param {string} key - The key to be saved in Redis
     * @param {string} value - The value to be assigned to the key
     * @param {number} ttl - TTL of the key in seconds
     * @return {Promise<void>} No return
     */
    async set(key, value, ttl = 60 * 24 * 60 * 60) {
        try {
            await this.client.setEx(key, ttl, value);
        } catch (error) {
            console.error(`Error setting key "${key}" with TTL:`, error);
            throw error;
        }
    }

    /**
     * Deletes a key in Redis
     * @param {string} key - The key to be deleted
     * @return {Promise<void>} No return
     */
    async del(key) {
        try {
            await this.client.del(key);
        } catch (error) {
            console.error(`Error deleting key "${key}":`, error);
            throw error;
        }
    }

    /**
     * Increases a key's value in Redis
     * @param {string} key - The key to increment
     * @return {Promise<number>} Updated value of the key
     */
    async incr(key) {
        try {
            return await this.client.incr(key);
        } catch (error) {
            console.error(`Error incrementing key "${key}":`, error);
            throw error;
        }
    }

    /**
     * Make a key expire in Redis
     * @param {string} key - The key to be expired
     * @param {number} ttl - The time window to expire in seconds
     * @return {Promise<void>} No return
     */
    async expire(key, ttl) {
        try {
            await this.client.expire(key, ttl);
        } catch (error) {
            console.error(`Error setting expiration for key "${key}":`, error);
            throw error;
        }
    }

    /**
     * Measures the latency to the Redis server.
     * @returns {Promise<number>} - The latency in milliseconds.
     */
    async getLatency() {
        try {
            const start = Date.now();
            await this.client.ping();
            return Date.now() - start;
        } catch (error) {
            console.error("Failed to measure latency:", error);
            throw error;
        }
    }

    /**
     * Saves an object to Redis
     * @param {string} key - The key to be saved in Redis
     * @param {Object} value - The object to be assigned to the key
     * @param {number} ttl - TTL of the key in seconds
     * @return {Promise<void>} No return
     */
    async setObject(key, value, ttl = 60 * 24 * 60 * 60) {
        try {
            const stringValue = JSON.stringify(value);
            await this.client.setEx(key, ttl, stringValue);
        } catch (error) {
            console.error(`Error setting object for key "${key}" with TTL:`, error);
            throw error;
        }
    }

    /**
     * Gets an object from Redis
     * @param {string} key - The key to search for in Redis
     * @return {Promise<Object>} The object corresponding to the key
     */
    async getObject(key) {
        try {
            const value = await this.client.get(key);
            return JSON.parse(value);
        } catch (error) {
            console.error(`Error getting object for key "${key}":`, error);
            throw error;
        }
    }
}

const cacheEngine = new CacheEngine();

export {cacheEngine};
export default CacheEngine;
