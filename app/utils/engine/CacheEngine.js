import redis from "redis";

class CacheEngine {
    /**
     * Initializes the CacheEngine with Redis client and configuration.
     */
    constructor() {
        const REDIS_HOST = process.env.REDIS_HOST || "localhost";
        const REDIS_PORT = parseInt(process.env.REDIS_PORT) || 6379;

        this.client = redis.createClient({
            host: REDIS_HOST,
            port: REDIS_PORT,
        });

        this.client.on("connect", () => {
            console.log(`Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
        });

        this.client.on("error", (error) => {
            console.error("Redis connection error:", error);
        });
    }

    /**
     * Connects to the Redis server.
     * 
     * @returns {Promise<void>} Resolves when connected.
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.client.connect();
            this.client.on("ready", resolve);
            this.client.on("error", reject);
        });
    }

    /**
     * Disconnects from the Redis server.
     * 
     * @returns {Promise<void>} Resolves when disconnected.
     */
    async disconnect() {
        return new Promise((resolve, reject) => {
            this.client.quit((err) => {
                if (err) {
                    console.error("Error disconnecting from Redis:", err);
                    return reject(err);
                }
                console.log("Disconnected from Redis");
                resolve();
            });
        });
    }

    /**
     * Sets a key-value pair in Redis with an optional expiration time.
     * 
     * @param {string} key - The key to set.
     * @param {string} value - The value to associate with the key.
     * @param {number} [ttl] - Time-to-live in seconds (optional).
     * @returns {Promise<void>} Resolves when the key is set.
     */
    async set(key, value, ttl) {
        return new Promise((resolve, reject) => {
            if (ttl) {
                this.client.set(key, value, "EX", ttl, (err) => {
                    if (err) {
                        console.error("Error setting key in Redis:", err);
                        return reject(err);
                    }
                    resolve();
                });
            } else {
                this.client.set(key, value, (err) => {
                    if (err) {
                        console.error("Error setting key in Redis:", err);
                        return reject(err);
                    }
                    resolve();
                });
            }
        });
    }

    /**
     * Retrieves a value by its key from Redis.
     * 
     * @param {string} key - The key to retrieve.
     * @returns {Promise<string|null>} Resolves with the value or null if not found.
     */
    async get(key) {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, result) => {
                if (err) {
                    console.error("Error getting key from Redis:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    /**
     * Deletes a key from Redis.
     * 
     * @param {string} key - The key to delete.
     * @returns {Promise<number>} Resolves with the number of keys deleted.
     */
    async delete(key) {
        return new Promise((resolve, reject) => {
            this.client.del(key, (err, result) => {
                if (err) {
                    console.error("Error deleting key from Redis:", err);
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    /**
     * Checks if a key exists in Redis.
     * 
     * @param {string} key - The key to check.
     * @returns {Promise<boolean>} Resolves with true if the key exists, false otherwise.
     */
    async exists(key) {
        return new Promise((resolve, reject) => {
            this.client.exists(key, (err, result) => {
                if (err) {
                    console.error("Error checking key existence in Redis:", err);
                    return reject(err);
                }
                resolve(result === 1);
            });
        });
    }

    /**
     * Sets multiple key-value pairs in Redis.
     * 
     * @param {Object} keyValues - An object containing key-value pairs to set.
     * @returns {Promise<void>} Resolves when all keys are set.
     */
    async setMultiple(keyValues) {
        return new Promise((resolve, reject) => {
            this.client.mset(keyValues, (err) => {
                if (err) {
                    console.error("Error setting multiple keys in Redis:", err);
                    return reject(err);
                }
                resolve();
            });
        });
    }

    /**
     * Retrieves multiple values by their keys from Redis.
     * 
     * @param {Array<string>} keys - The keys to retrieve.
     * @returns {Promise<Array<string|null>>} Resolves with an array of values or nulls for missing keys.
     */
    async getMultiple(keys) {
        return new Promise((resolve, reject) => {
            this.client.mget(keys, (err, results) => {
                if (err) {
                    console.error("Error getting multiple keys from Redis:", err);
                    return reject(err);
                }
                resolve(results);
            });
        });
    }

     /**
     * Checks if the client is connected to the Redis server.
     *
     * @returns {boolean} - True if the client is connected, false otherwise.
     */
    isConnected() {
        return this.client.isOpen;
    }

    /**
     * Measures the latency to the Redis server.
     *
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
}

const cacheEngine = new CacheEngine()
await cacheEngine.connect();
export default cacheEngine;
