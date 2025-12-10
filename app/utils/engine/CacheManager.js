#!/usr/bin/env node
/**
 * Enhanced Cache Manager for ITFY E-Voting System
 * 
 * Provides intelligent cache management with entity-specific invalidation.
 * Automatically invalidates stale caches when entities are updated while
 * preserving fresh caches for unaffected entities.
 * 
 * @module CacheManager
 * @version 2.0.0
 */

import Redis from 'ioredis';
import Config from '../../config/config.js';

class CacheManager {
    constructor(options = {}) {
        this.config = {
            host: options.host || process.env.REDIS_HOST || 'localhost',
            port: options.port || process.env.REDIS_PORT || 6379,
            password: options.password || process.env.REDIS_PASSWORD || null,
            db: options.db || process.env.REDIS_DB || 0,
            keyPrefix: options.keyPrefix || 'itfy:cache:',
            defaultTTL: options.defaultTTL || 3600, // 1 hour default
            enableStats: options.enableStats !== false,
        };

        // Initialize Redis connection
        this.redis = new Redis({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            keyPrefix: this.config.keyPrefix,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3,
            lazyConnect: false,
            enableReadyCheck: true,
        });

        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            invalidations: 0,
            errors: 0,
            startTime: Date.now(),
        };

        this.setupEventHandlers();
        
        // Entity-specific TTLs (in seconds)
        this.entityTTLs = {
            user: 1800,          // 30 minutes
            event: 900,          // 15 minutes
            candidate: 600,      // 10 minutes
            vote: 300,           // 5 minutes
            payment: 1800,       // 30 minutes
            notification: 600,   // 10 minutes
            analytics: 3600,     // 1 hour
            settings: 7200,      // 2 hours
            coupon: 1800,        // 30 minutes
            category: 3600,      // 1 hour
            form: 1800,          // 30 minutes
            slide: 3600,         // 1 hour
            votebundle: 600,     // 10 minutes
            activity: 1800,      // 30 minutes
            default: 3600,       // 1 hour
        };
    }

    /**
     * Setup Redis event handlers
     */
    setupEventHandlers() {
        this.redis.on('connect', () => {
            console.log('✅ CacheManager: Redis connected');
        });

        this.redis.on('ready', () => {
            console.log('✅ CacheManager: Redis ready');
        });

        this.redis.on('error', (err) => {
            console.error('❌ CacheManager: Redis error:', err.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
        });
    }

    /**
     * Generate cache key for entity
     * @param {String} entityName - Name of the entity (user, event, etc.)
     * @param {String} operation - Operation type (findById, findAll, etc.)
     * @param {String|Object} identifier - Entity ID or query filter
     * @returns {String} Cache key
     */
    generateKey(entityName, operation, identifier = '') {
        const normalizedEntity = entityName.toLowerCase();
        
        if (typeof identifier === 'object') {
            // Sort object keys for consistent key generation
            const sortedKeys = Object.keys(identifier).sort();
            const queryString = sortedKeys
                .map(key => `${key}:${JSON.stringify(identifier[key])}`)
                .join('|');
            return `${normalizedEntity}:${operation}:${queryString}`;
        }
        
        return `${normalizedEntity}:${operation}:${identifier}`;
    }

    /**
     * Set cache value
     * @param {String} entityName - Name of the entity
     * @param {String} operation - Operation type
     * @param {String|Object} identifier - Entity ID or query
     * @param {any} value - Value to cache
     * @param {Number} ttl - Optional custom TTL
     * @returns {Promise<Boolean>}
     */
    async set(entityName, operation, identifier, value, ttl = null) {
        try {
            const key = this.generateKey(entityName, operation, identifier);
            const cacheTTL = ttl || this.entityTTLs[entityName.toLowerCase()] || this.entityTTLs.default;

            const cacheEntry = {
                value,
                entityName,
                operation,
                identifier,
                cachedAt: Date.now(),
                expiresAt: Date.now() + (cacheTTL * 1000),
            };

            await this.redis.setex(key, cacheTTL, JSON.stringify(cacheEntry));

            // Track entity relationships for smart invalidation
            await this._trackEntityKey(entityName, identifier, key);

            if (this.config.enableStats) {
                this.stats.sets++;
            }

            return true;
        } catch (error) {
            console.error(`CacheManager: Set error for ${entityName}:`, error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Get cache value
     * @param {String} entityName - Name of the entity
     * @param {String} operation - Operation type
     * @param {String|Object} identifier - Entity ID or query
     * @returns {Promise<any|null>}
     */
    async get(entityName, operation, identifier) {
        try {
            const key = this.generateKey(entityName, operation, identifier);
            const cached = await this.redis.get(key);

            if (!cached) {
                if (this.config.enableStats) {
                    this.stats.misses++;
                }
                return null;
            }

            const entry = JSON.parse(cached);

            // Check if expired (shouldn't happen with Redis SETEX, but double-check)
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                await this.redis.del(key);
                if (this.config.enableStats) {
                    this.stats.misses++;
                }
                return null;
            }

            if (this.config.enableStats) {
                this.stats.hits++;
            }

            return entry.value;
        } catch (error) {
            console.error(`CacheManager: Get error for ${entityName}:`, error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return null;
        }
    }

    /**
     * Delete specific cache entry
     * @param {String} entityName - Name of the entity
     * @param {String} operation - Operation type
     * @param {String|Object} identifier - Entity ID or query
     * @returns {Promise<Boolean>}
     */
    async delete(entityName, operation, identifier) {
        try {
            const key = this.generateKey(entityName, operation, identifier);
            const result = await this.redis.del(key);

            if (this.config.enableStats) {
                this.stats.deletes++;
            }

            return result > 0;
        } catch (error) {
            console.error(`CacheManager: Delete error for ${entityName}:`, error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Track entity key for smart invalidation
     * @private
     */
    async _trackEntityKey(entityName, identifier, cacheKey) {
        try {
            const normalizedEntity = entityName.toLowerCase();
            let trackingKey;

            if (typeof identifier === 'object') {
                // For query-based caches, track under entity type
                trackingKey = `_tracking:${normalizedEntity}:queries`;
            } else {
                // For ID-based caches, track under specific entity
                trackingKey = `_tracking:${normalizedEntity}:${identifier}`;
            }

            // Add to set with TTL (slightly longer than cache TTL)
            const ttl = (this.entityTTLs[normalizedEntity] || this.entityTTLs.default) + 300;
            await this.redis.sadd(trackingKey, cacheKey);
            await this.redis.expire(trackingKey, ttl);
        } catch (error) {
            // Tracking is best-effort, don't fail the cache operation
            console.error('CacheManager: Tracking error:', error.message);
        }
    }

    /**
     * Invalidate all caches for a specific entity instance
     * Called when an entity is updated or deleted
     * @param {String} entityName - Name of the entity
     * @param {String} entityId - ID of the entity that changed
     * @returns {Promise<Number>} Number of invalidated keys
     */
    async invalidateEntity(entityName, entityId) {
        try {
            const normalizedEntity = entityName.toLowerCase();
            const trackingKey = `_tracking:${normalizedEntity}:${entityId}`;
            
            // Get all cache keys for this entity
            const cacheKeys = await this.redis.smembers(trackingKey);
            
            if (cacheKeys.length === 0) {
                return 0;
            }

            // Delete all related cache entries
            const pipeline = this.redis.pipeline();
            cacheKeys.forEach(key => {
                // Remove prefix for deletion
                const unprefixedKey = key.replace(this.config.keyPrefix, '');
                pipeline.del(unprefixedKey);
            });
            pipeline.del(trackingKey.replace(this.config.keyPrefix, ''));
            
            await pipeline.exec();

            if (this.config.enableStats) {
                this.stats.invalidations += cacheKeys.length;
            }

            console.log(`CacheManager: Invalidated ${cacheKeys.length} cache entries for ${entityName}:${entityId}`);
            return cacheKeys.length;
        } catch (error) {
            console.error(`CacheManager: Invalidation error for ${entityName}:${entityId}:`, error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return 0;
        }
    }

    /**
     * Invalidate all query-based caches for an entity type
     * Called when any entity of this type is created/updated/deleted
     * @param {String} entityName - Name of the entity type
     * @returns {Promise<Number>} Number of invalidated keys
     */
    async invalidateEntityQueries(entityName) {
        try {
            const normalizedEntity = entityName.toLowerCase();
            const trackingKey = `_tracking:${normalizedEntity}:queries`;
            
            // Get all query-based cache keys for this entity type
            const cacheKeys = await this.redis.smembers(trackingKey);
            
            if (cacheKeys.length === 0) {
                return 0;
            }

            // Delete all query-based cache entries
            const pipeline = this.redis.pipeline();
            cacheKeys.forEach(key => {
                const unprefixedKey = key.replace(this.config.keyPrefix, '');
                pipeline.del(unprefixedKey);
            });
            pipeline.del(trackingKey.replace(this.config.keyPrefix, ''));
            
            await pipeline.exec();

            if (this.config.enableStats) {
                this.stats.invalidations += cacheKeys.length;
            }

            console.log(`CacheManager: Invalidated ${cacheKeys.length} query caches for ${entityName}`);
            return cacheKeys.length;
        } catch (error) {
            console.error(`CacheManager: Query invalidation error for ${entityName}:`, error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return 0;
        }
    }

    /**
     * Invalidate all caches matching a pattern
     * @param {String} pattern - Glob pattern (* and ? supported)
     * @returns {Promise<Number>} Number of invalidated keys
     */
    async invalidatePattern(pattern) {
        try {
            const keys = [];
            let cursor = '0';

            // Scan for matching keys
            do {
                const result = await this.redis.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100
                );
                cursor = result[0];
                keys.push(...result[1]);
            } while (cursor !== '0');

            if (keys.length === 0) {
                return 0;
            }

            // Delete matching keys
            const pipeline = this.redis.pipeline();
            keys.forEach(key => {
                pipeline.del(key.replace(this.config.keyPrefix, ''));
            });
            await pipeline.exec();

            if (this.config.enableStats) {
                this.stats.invalidations += keys.length;
            }

            console.log(`CacheManager: Invalidated ${keys.length} caches matching pattern: ${pattern}`);
            return keys.length;
        } catch (error) {
            console.error(`CacheManager: Pattern invalidation error for ${pattern}:`, error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return 0;
        }
    }

    /**
     * Clear all caches for an entity type
     * @param {String} entityName - Name of the entity
     * @returns {Promise<Number>} Number of cleared keys
     */
    async clearEntityCache(entityName) {
        const normalizedEntity = entityName.toLowerCase();
        const pattern = `${normalizedEntity}:*`;
        return await this.invalidatePattern(pattern);
    }

    /**
     * Clear all caches
     * @returns {Promise<Boolean>}
     */
    async clearAll() {
        try {
            await this.redis.flushdb();
            console.log('CacheManager: All caches cleared');
            return true;
        } catch (error) {
            console.error('CacheManager: Clear all error:', error.message);
            if (this.config.enableStats) {
                this.stats.errors++;
            }
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            uptime,
            hitRate: `${hitRate}%`,
            total,
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            invalidations: 0,
            errors: 0,
            startTime: Date.now(),
        };
    }

    /**
     * Close Redis connection
     */
    async close() {
        try {
            await this.redis.quit();
            console.log('CacheManager: Redis connection closed');
        } catch (error) {
            console.error('CacheManager: Close error:', error.message);
        }
    }
}

// Create singleton instances for different cache types
export const mainCacheManager = new CacheManager({
    db: 0,
    keyPrefix: 'itfy:main:',
});

export const userCacheManager = new CacheManager({
    db: 2,
    keyPrefix: 'itfy:user:',
});

export const eventCacheManager = new CacheManager({
    db: 3,
    keyPrefix: 'itfy:event:',
});

export default CacheManager;
