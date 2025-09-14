#!/usr/bin/env node
/**
 * Cache middleware for Express
 * This module provides middleware functions for caching API responses
 */

import { mainCache, userCache, eventCache } from './cache.js';

/**
 * Generic cache middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
export function cacheMiddleware(options = {}) {
    const {
        cache = mainCache,
        ttl = 3600000, // 1 hour default
        keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
        condition = () => true,
        skipOnError = true
    } = options;

    return (req, res, next) => {
        // Skip caching if condition is not met
        if (!condition(req)) {
            return next();
        }

        // Generate cache key
        const cacheKey = keyGenerator(req);

        try {
            // Try to get cached response
            const cachedResponse = cache.get(cacheKey);
            
            if (cachedResponse) {
                console.log(`Cache HIT: ${cacheKey}`);
                res.set(cachedResponse.headers);
                return res.status(cachedResponse.status).json(cachedResponse.data);
            }

            console.log(`Cache MISS: ${cacheKey}`);

            // Store original res.json method
            const originalJson = res.json.bind(res);

            // Override res.json to cache the response
            res.json = function(data) {
                // Only cache successful responses
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const responseToCache = {
                        data,
                        status: res.statusCode,
                        headers: {
                            'content-type': 'application/json',
                            'x-cache': 'MISS'
                        }
                    };

                    cache.set(cacheKey, responseToCache, ttl);
                    console.log(`Cached response: ${cacheKey}`);
                }

                // Add cache header
                res.set('x-cache', 'MISS');
                return originalJson(data);
            };

            next();
        } catch (error) {
            console.error('Cache middleware error:', error.message);
            if (skipOnError) {
                next();
            } else {
                next(error);
            }
        }
    };
}

/**
 * User-specific cache middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
export function userCacheMiddleware(options = {}) {
    return cacheMiddleware({
        cache: userCache,
        ttl: 1800000, // 30 minutes
        keyGenerator: (req) => {
            const userId = req.user?.id || req.params.userId || 'anonymous';
            return `user:${userId}:${req.method}:${req.originalUrl}`;
        },
        condition: (req) => req.method === 'GET',
        ...options
    });
}

/**
 * Event-specific cache middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
export function eventCacheMiddleware(options = {}) {
    return cacheMiddleware({
        cache: eventCache,
        ttl: 900000, // 15 minutes
        keyGenerator: (req) => {
            const eventId = req.params.eventId || req.params.id;
            return `event:${eventId}:${req.method}:${req.originalUrl}`;
        },
        condition: (req) => req.method === 'GET',
        ...options
    });
}

/**
 * Cache invalidation middleware
 * Invalidates cache entries based on patterns
 */
export function cacheInvalidationMiddleware(options = {}) {
    const {
        patterns = [],
        cache = mainCache,
        onMutation = ['POST', 'PUT', 'PATCH', 'DELETE']
    } = options;

    return (req, res, next) => {
        // Store original res.json method
        const originalJson = res.json.bind(res);

        // Override res.json to invalidate cache on successful mutations
        res.json = function(data) {
            if (onMutation.includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    // Invalidate cache entries based on patterns
                    const cacheKeys = cache.keys();
                    let invalidatedCount = 0;

                    for (const pattern of patterns) {
                        const regex = new RegExp(pattern);
                        for (const key of cacheKeys) {
                            if (regex.test(key)) {
                                cache.delete(key);
                                invalidatedCount++;
                            }
                        }
                    }

                    if (invalidatedCount > 0) {
                        console.log(`Invalidated ${invalidatedCount} cache entries for ${req.method} ${req.originalUrl}`);
                    }
                } catch (error) {
                    console.error('Cache invalidation error:', error.message);
                }
            }

            return originalJson(data);
        };

        next();
    };
}

/**
 * Rate limiting middleware using cache
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
export function rateLimitMiddleware(options = {}) {
    const {
        cache = mainCache,
        windowMs = 900000, // 15 minutes
        maxRequests = 100,
        keyGenerator = (req) => req.ip,
        message = 'Too many requests',
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = options;

    return (req, res, next) => {
        try {
            const key = `ratelimit:${keyGenerator(req)}`;
            const currentRequests = cache.get(key) || 0;

            if (currentRequests >= maxRequests) {
                return res.status(429).json({
                    success: false,
                    message,
                    retryAfter: Math.ceil(windowMs / 1000)
                });
            }

            // Store original res.json method
            const originalJson = res.json.bind(res);

            // Override res.json to count requests
            res.json = function(data) {
                const shouldCount = (
                    (!skipSuccessfulRequests || res.statusCode >= 400) &&
                    (!skipFailedRequests || res.statusCode < 400)
                );

                
                if (shouldCount) {
                    cache.increment(key, 1, windowMs);
                }

                return originalJson(data);
            };

            next();
        } catch (error) {
            console.error('Rate limit middleware error:', error.message);
            next();
        }
    };
}

/**
 * Cache statistics endpoint middleware
 * @returns {Function} Express middleware function
 */
export function cacheStatsMiddleware() {
    return (req, res) => {
        try {
            const stats = {
                main: mainCache.getStats(),
                user: userCache.getStats(),
                event: eventCache.getStats()
            };

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                cache: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get cache statistics',
                error: error.message
            });
        }
    };
}

/**
 * Cache management endpoint middleware
 * @returns {Function} Express middleware function
 */
export function cacheManagementMiddleware() {
    return (req, res) => {
        try {
            const { action, cache: cacheType, key } = req.body;

            let targetCache = mainCache;
            switch (cacheType) {
                case 'user':
                    targetCache = userCache;
                    break;
                case 'event':
                    targetCache = eventCache;
                    break;
                default:
                    targetCache = mainCache;
            }

            let result = {};

            switch (action) {
                case 'clear':
                    targetCache.clear();
                    result = { message: `${cacheType || 'main'} cache cleared` };
                    break;
                
                case 'delete':
                    if (!key) {
                        return res.status(400).json({
                            success: false,
                            message: 'Key is required for delete action'
                        });
                    }
                    const deleted = targetCache.delete(key);
                    result = { deleted, key };
                    break;
                
                case 'get':
                    if (!key) {
                        return res.status(400).json({
                            success: false,
                            message: 'Key is required for get action'
                        });
                    }
                    const value = targetCache.get(key);
                    result = { key, value, exists: value !== null };
                    break;
                
                case 'keys':
                    result = { keys: targetCache.keys() };
                    break;
                
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid action. Supported: clear, delete, get, keys'
                    });
            }

            res.json({
                success: true,
                action,
                cache: cacheType || 'main',
                result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Cache management operation failed',
                error: error.message
            });
        }
    };
}
