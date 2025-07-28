#!/usr/bin/env node
/**
 * Cache utility module
 * This module provides an in-memory caching system with TTL support
 * It includes features like expiration, size limits, and cache statistics
 */

import Config from '../../config/config.js';

class Cache {
    constructor(options = {}) {
        this.cache = new Map();
        this.timers = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0,
            startTime: Date.now()
        };
        
        // Configuration
        this.config = {
            maxSize: options.maxSize || 1000, // Maximum number of entries
            defaultTTL: options.defaultTTL || 3600000, // Default TTL in milliseconds (1 hour)
            checkInterval: options.checkInterval || 300000, // Check for expired entries every 5 minutes
            enableStats: options.enableStats !== false, // Enable statistics by default
            onEviction: options.onEviction || null // Callback when items are evicted
        };
        
        // Start cleanup interval
        this.startCleanupInterval();
        
        console.log(`Cache initialized with max size: ${this.config.maxSize}, default TTL: ${this.config.defaultTTL}ms`);
    }

    /**
     * Set a value in the cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {boolean} Success status
     */
    set(key, value, ttl = this.config.defaultTTL) {
        try {
            // Check if we need to evict entries due to size limit
            if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
                this.evictLRU();
            }

            // Clear existing timer if key already exists
            if (this.timers.has(key)) {
                clearTimeout(this.timers.get(key));
            }

            // Create cache entry
            const entry = {
                value,
                createdAt: Date.now(),
                expiresAt: Date.now() + ttl,
                accessCount: 0,
                lastAccessed: Date.now()
            };

            this.cache.set(key, entry);

            // Set expiration timer
            if (ttl > 0) {
                const timer = setTimeout(() => {
                    this.delete(key);
                }, ttl);
                this.timers.set(key, timer);
            }

            if (this.config.enableStats) {
                this.stats.sets++;
            }

            return true;
        } catch (error) {
            console.error('Cache set error:', error.message);
            return false;
        }
    }

    /**
     * Get a value from the cache
     * @param {string} key - Cache key
     * @returns {any} Cached value or null if not found/expired
     */
    get(key) {
        try {
            const entry = this.cache.get(key);

            if (!entry) {
                if (this.config.enableStats) {
                    this.stats.misses++;
                }
                return null;
            }

            // Check if entry has expired
            if (Date.now() > entry.expiresAt) {
                this.delete(key);
                if (this.config.enableStats) {
                    this.stats.misses++;
                }
                return null;
            }

            // Update access statistics
            entry.accessCount++;
            entry.lastAccessed = Date.now();

            if (this.config.enableStats) {
                this.stats.hits++;
            }

            return entry.value;
        } catch (error) {
            console.error('Cache get error:', error.message);
            if (this.config.enableStats) {
                this.stats.misses++;
            }
            return null;
        }
    }

    /**
     * Check if a key exists in the cache
     * @param {string} key - Cache key
     * @returns {boolean} True if key exists and not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;
        
        if (Date.now() > entry.expiresAt) {
            this.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * Delete a key from the cache
     * @param {string} key - Cache key
     * @returns {boolean} True if key was deleted
     */
    delete(key) {
        try {
            const deleted = this.cache.delete(key);
            
            if (this.timers.has(key)) {
                clearTimeout(this.timers.get(key));
                this.timers.delete(key);
            }

            if (deleted && this.config.enableStats) {
                this.stats.deletes++;
            }

            return deleted;
        } catch (error) {
            console.error('Cache delete error:', error.message);
            return false;
        }
    }

    /**
     * Clear all entries from the cache
     */
    clear() {
        try {
            // Clear all timers
            for (const timer of this.timers.values()) {
                clearTimeout(timer);
            }
            
            this.cache.clear();
            this.timers.clear();
            
            console.log('Cache cleared');
        } catch (error) {
            console.error('Cache clear error:', error.message);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            uptime,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            maxSize: this.config.maxSize,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * Get all cache keys
     * @returns {Array} Array of cache keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size
     * @returns {number} Number of entries in cache
     */
    size() {
        return this.cache.size;
    }

    /**
     * Evict least recently used entry
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            const evictedEntry = this.cache.get(oldestKey);
            this.delete(oldestKey);
            
            if (this.config.enableStats) {
                this.stats.evictions++;
            }
            
            if (this.config.onEviction) {
                this.config.onEviction(oldestKey, evictedEntry.value, 'size');
            }
            
            console.log(`Evicted LRU entry: ${oldestKey}`);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                const evictedEntry = this.cache.get(key);
                this.delete(key);
                cleanedCount++;
                
                if (this.config.onEviction) {
                    this.config.onEviction(key, evictedEntry.value, 'expired');
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} expired cache entries`);
        }
    }

    /**
     * Start automatic cleanup interval
     */
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.checkInterval);
    }

    /**
     * Stop automatic cleanup interval
     */
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Get approximate memory usage
     * @returns {Object} Memory usage information
     */
    getMemoryUsage() {
        try {
            const sampleEntries = Array.from(this.cache.entries()).slice(0, 10);
            let totalSize = 0;
            
            for (const [key, entry] of sampleEntries) {
                totalSize += JSON.stringify({ key, entry }).length * 2; // Rough estimate
            }
            
            const avgEntrySize = sampleEntries.length > 0 ? totalSize / sampleEntries.length : 0;
            const estimatedTotalSize = avgEntrySize * this.cache.size;
            
            return {
                estimatedSize: `${(estimatedTotalSize / 1024).toFixed(2)} KB`,
                avgEntrySize: `${avgEntrySize.toFixed(0)} bytes`,
                entries: this.cache.size
            };
        } catch (error) {
            return { error: 'Unable to calculate memory usage' };
        }
    }

    /**
     * Increment a numeric value in the cache
     * @param {string} key - Cache key
     * @param {number} increment - Amount to increment (default: 1)
     * @param {number} ttl - TTL for new entries
     * @returns {number} New value
     */
    increment(key, increment = 1, ttl = this.config.defaultTTL) {
        const current = this.get(key) || 0;
        const newValue = Number(current) + increment;
        this.set(key, newValue, ttl);
        return newValue;
    }

    /**
     * Decrement a numeric value in the cache
     * @param {string} key - Cache key
     * @param {number} decrement - Amount to decrement (default: 1)
     * @param {number} ttl - TTL for new entries
     * @returns {number} New value
     */
    decrement(key, decrement = 1, ttl = this.config.defaultTTL) {
        return this.increment(key, -decrement, ttl);
    }

    /**
     * Get multiple values at once
     * @param {Array} keys - Array of cache keys
     * @returns {Object} Object with key-value pairs
     */
    mget(keys) {
        const result = {};
        for (const key of keys) {
            result[key] = this.get(key);
        }
        return result;
    }

    /**
     * Set multiple values at once
     * @param {Object} entries - Object with key-value pairs
     * @param {number} ttl - TTL for all entries
     * @returns {boolean} Success status
     */
    mset(entries, ttl = this.config.defaultTTL) {
        try {
            for (const [key, value] of Object.entries(entries)) {
                this.set(key, value, ttl);
            }
            return true;
        } catch (error) {
            console.error('Cache mset error:', error.message);
            return false;
        }
    }
}

// Create cache instances for different purposes
const mainCache = new Cache({
    maxSize: 1000,
    defaultTTL: 3600000 // 1 hour
});

const sessionCache = new Cache({
    maxSize: 500,
    defaultTTL: 1800000 // 30 minutes
});

const userCache = new Cache({
    maxSize: 2000,
    defaultTTL: 7200000 // 2 hours
});

const eventCache = new Cache({
    maxSize: 100,
    defaultTTL: 1800000 // 30 minutes
});

export default mainCache;
export { Cache, sessionCache, userCache, eventCache, mainCache };