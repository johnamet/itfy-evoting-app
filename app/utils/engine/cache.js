#!/usr/bin/env node
/**
 * Redis-based Cache utility module
 * This module provides a Redis-backed caching system with TTL support
 * It includes features like expiration, statistics, and distributed caching
 */

import Redis from 'ioredis';
import Config from '../../config/config.js';

class RedisCache {
    constructor(options = {}) {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        // Configuration
        this.config = {
            host: options.host || process.env.REDIS_HOST || 'localhost',
            port: options.port || process.env.REDIS_PORT || 6379,
            password: options.password || process.env.REDIS_PASSWORD || null,
            db: options.db || process.env.REDIS_DB || 0,
            keyPrefix: options.keyPrefix || 'itfy:cache:',
            defaultTTL: options.defaultTTL || 3600, // Default TTL in seconds (1 hour)
            enableStats: options.enableStats !== false,
            retryDelayOnFailover: options.retryDelayOnFailover || 100,
            maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
            lazyConnect: options.lazyConnect !== false,
            onError: options.onError || null,
            onConnect: options.onConnect || null,
            onReady: options.onReady || null
        };
        
        // Initialize Redis connection
        this.redis = new Redis({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            keyPrefix: this.config.keyPrefix,
            retryDelayOnFailover: this.config.retryDelayOnFailover,
            maxRetriesPerRequest: this.config.maxRetriesPerRequest,
            lazyConnect: this.config.lazyConnect,
            enableReadyCheck: true,
            reconnectOnError: (err) => {
                console.error('Redis reconnection error:', err.message);
                return err.message.includes('READONLY');
            }
        });
        
        this.setupEventHandlers();
        
        console.log(`Redis Cache initialized - Host: ${this.config.host}:${this.config.port}, DB: ${this.config.db}`);
    }

    /**
     * Setup Redis event handlers
     */
    setupEventHandlers() {
        this.redis.on('connect', () => {
            console.log('✅ Redis connected');
            if (this.config.onConnect) {
                this.config.onConnect();
            }
        });

        this.redis.on('ready', () => {
            console.log('✅ Redis ready');
            if (this.config.onReady) {
                this.config.onReady();
            }
        });

        this.redis.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            if (this.config.onError) {
                this.config.onError(err);
            }
        });

        this.redis.on('close', () => {
            console.log('⚠️  Redis connection closed');
        });

        this.redis.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });
    }

    /**
     * Set a value in the cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in seconds (optional)
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value, ttl = this.config.defaultTTL) {
        try {
            const serializedValue = JSON.stringify({
                value,
                createdAt: Date.now(),
                expiresAt: Date.now() + (ttl * 1000)
            });

            let result;
            if (ttl > 0) {
                result = await this.redis.setex(key, ttl, serializedValue);
            } else {
                result = await this.redis.set(key, serializedValue);
            }

            if (this.config.enableStats) {
                this.stats.sets++;
            }

            return result === 'OK';
        } catch (error) {
            console.error('Redis set error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Get a value from the cache
     * @param {string} key - Cache key
     * @returns {Promise<any>} Cached value or null if not found/expired
     */
    async get(key) {
        try {
            const serializedValue = await this.redis.get(key);

            if (!serializedValue) {
                if (this.config.enableStats) {
                    this.stats.misses++;
                }
                return null;
            }

            const entry = JSON.parse(serializedValue);

            if (this.config.enableStats) {
                this.stats.hits++;
            }

            return entry.value;
        } catch (error) {
            console.error('Redis get error:', error.message);
            if (this.config.enableStats) {
                this.stats.misses++;
                this.stats.errors++;
            }
            return null;
        }
    }

    /**
     * Check if a key exists in the cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} True if key exists
     */
    async has(key) {
        try {
            const exists = await this.redis.exists(key);
            return exists === 1;
        } catch (error) {
            console.error('Redis has error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Delete a key from the cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} True if key was deleted
     */
    async delete(key) {
        try {
            const deleted = await this.redis.del(key);
            
            if (deleted > 0 && this.config.enableStats) {
                this.stats.deletes++;
            }

            return deleted > 0;
        } catch (error) {
            console.error('Redis delete error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Clear all entries from the cache (with prefix)
     * @returns {Promise<boolean>} Success status
     */
    async clear() {
        try {
            const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
            
            if (keys.length > 0) {
                // Remove prefix from keys for deletion
                const keysWithoutPrefix = keys.map(key => key.replace(this.config.keyPrefix, ''));
                await this.redis.del(...keysWithoutPrefix);
                console.log(`Cache cleared - ${keys.length} keys deleted`);
            } else {
                console.log('Cache clear - no keys found');
            }
            
            return true;
        } catch (error) {
            console.error('Redis clear error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>} Cache statistics
     */
    async getStats() {
        try {
            const uptime = Date.now() - this.stats.startTime;
            const hitRate = this.stats.hits + this.stats.misses > 0 
                ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
                : 0;

            const redisInfo = await this.redis.info('memory');
            const redisStats = await this.redis.info('stats');
            
            // Parse Redis info
            const memoryUsed = this.parseRedisInfo(redisInfo, 'used_memory_human');
            const totalConnections = this.parseRedisInfo(redisStats, 'total_connections_received');
            
            return {
                ...this.stats,
                uptime,
                hitRate: `${hitRate}%`,
                redis: {
                    memoryUsed,
                    totalConnections,
                    status: 'connected'
                },
                connection: {
                    host: this.config.host,
                    port: this.config.port,
                    db: this.config.db
                }
            };
        } catch (error) {
            console.error('Redis getStats error:', error.message);
            return {
                ...this.stats,
                error: 'Unable to fetch Redis stats',
                redis: {
                    status: 'error'
                }
            };
        }
    }

    /**
     * Parse Redis INFO command output
     * @param {string} info - Redis INFO output
     * @param {string} key - Key to extract
     * @returns {string} Extracted value
     */
    parseRedisInfo(info, key) {
        const lines = info.split('\r\n');
        for (const line of lines) {
            if (line.startsWith(`${key}:`)) {
                return line.split(':')[1];
            }
        }
        return 'unknown';
    }

    /**
     * Get all cache keys (without prefix)
     * @returns {Promise<Array>} Array of cache keys
     */
    async keys() {
        try {
            const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
            // Remove prefix from keys
            return keys.map(key => key.replace(this.config.keyPrefix, ''));
        } catch (error) {
            console.error('Redis keys error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return [];
        }
    }

    /**
     * Get cache size (number of keys)
     * @returns {Promise<number>} Number of entries in cache
     */
    async size() {
        try {
            const keys = await this.keys();
            return keys.length;
        } catch (error) {
            console.error('Redis size error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return 0;
        }
    }

    /**
     * Set expiration time for a key
     * @param {string} key - Cache key
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<boolean>} Success status
     */
    async expire(key, ttl) {
        try {
            const result = await this.redis.expire(key, ttl);
            return result === 1;
        } catch (error) {
            console.error('Redis expire error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Get time to live for a key
     * @param {string} key - Cache key
     * @returns {Promise<number>} TTL in seconds (-1 if no TTL, -2 if key doesn't exist)
     */
    async ttl(key) {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            console.error('Redis ttl error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return -2;
        }
    }

    /**
     * Increment a numeric value in the cache
     * @param {string} key - Cache key
     * @param {number} increment - Amount to increment (default: 1)
     * @param {number} ttl - TTL for new entries in seconds
     * @returns {Promise<number>} New value
     */
    async increment(key, increment = 1, ttl = this.config.defaultTTL) {
        try {
            const newValue = await this.redis.incrby(key, increment);
            
            // Set TTL if this is a new key
            if (newValue === increment && ttl > 0) {
                await this.redis.expire(key, ttl);
            }
            
            return newValue;
        } catch (error) {
            console.error('Redis increment error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return 0;
        }
    }

    /**
     * Decrement a numeric value in the cache
     * @param {string} key - Cache key
     * @param {number} decrement - Amount to decrement (default: 1)
     * @param {number} ttl - TTL for new entries in seconds
     * @returns {Promise<number>} New value
     */
    async decrement(key, decrement = 1, ttl = this.config.defaultTTL) {
        return await this.increment(key, -decrement, ttl);
    }

    /**
     * Get multiple values at once
     * @param {Array} keys - Array of cache keys
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async mget(keys) {
        try {
            const values = await this.redis.mget(...keys);
            const result = {};
            
            for (let i = 0; i < keys.length; i++) {
                try {
                    if (values[i]) {
                        const entry = JSON.parse(values[i]);
                        result[keys[i]] = entry.value;
                        if (this.config.enableStats) {
                            this.stats.hits++;
                        }
                    } else {
                        result[keys[i]] = null;
                        if (this.config.enableStats) {
                            this.stats.misses++;
                        }
                    }
                } catch (parseError) {
                    result[keys[i]] = null;
                    if (this.config.enableStats) {
                        this.stats.misses++;
                    }
                }
            }
            
            return result;
        } catch (error) {
            console.error('Redis mget error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            
            // Return null for all keys on error
            const result = {};
            for (const key of keys) {
                result[key] = null;
            }
            return result;
        }
    }

    /**
     * Set multiple values at once
     * @param {Object} entries - Object with key-value pairs
     * @param {number} ttl - TTL for all entries in seconds
     * @returns {Promise<boolean>} Success status
     */
    async mset(entries, ttl = this.config.defaultTTL) {
        try {
            const pipeline = this.redis.pipeline();
            
            for (const [key, value] of Object.entries(entries)) {
                const serializedValue = JSON.stringify({
                    value,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + (ttl * 1000)
                });
                
                if (ttl > 0) {
                    pipeline.setex(key, ttl, serializedValue);
                } else {
                    pipeline.set(key, serializedValue);
                }
            }
            
            const results = await pipeline.exec();
            const success = results.every(result => result[1] === 'OK');
            
            if (success && this.config.enableStats) {
                this.stats.sets += Object.keys(entries).length;
            }
            
            return success;
        } catch (error) {
            console.error('Redis mset error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Execute a Redis pipeline for batch operations
     * @param {Function} operations - Function that receives pipeline object
     * @returns {Promise<Array>} Pipeline execution results
     */
    async pipeline(operations) {
        try {
            const pipeline = this.redis.pipeline();
            operations(pipeline);
            return await pipeline.exec();
        } catch (error) {
            console.error('Redis pipeline error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return [];
        }
    }

    /**
     * Test Redis connection
     * @returns {Promise<boolean>} Connection status
     */
    async ping() {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            console.error('Redis ping error:', error.message);
            return false;
        }
    }

    /**
     * Close Redis connection
     * @returns {Promise<void>}
     */
    async disconnect() {
        try {
            await this.redis.quit();
            console.log('Redis connection closed gracefully');
        } catch (error) {
            console.error('Redis disconnect error:', error.message);
            this.redis.disconnect();
        }
    }

    /**
     * Get Redis connection status
     * @returns {string} Connection status
     */
    getConnectionStatus() {
        return this.redis.status;
    }
}

// Create cache instances for different purposes with different Redis databases
const mainCache = new RedisCache({
    db: 0,
    keyPrefix: 'itfy:main:',
    defaultTTL: 3600 // 1 hour
});

const sessionCache = new RedisCache({
    db: 1,
    keyPrefix: 'itfy:session:',
    defaultTTL: 1800 // 30 minutes
});

const userCache = new RedisCache({
    db: 2,
    keyPrefix: 'itfy:user:',
    defaultTTL: 7200 // 2 hours
});

const eventCache = new RedisCache({
    db: 3,
    keyPrefix: 'itfy:event:',
    defaultTTL: 1800 // 30 minutes
});

export default mainCache;
export { RedisCache, sessionCache, userCache, eventCache, mainCache };