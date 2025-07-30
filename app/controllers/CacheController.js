#!/usr/bin/env node
/**
 * Cache Controller
 * 
 * Handles cache management operations for administrators.
 * Provides endpoints to monitor and control application caching.
 */

import BaseController from './BaseController.js';
import CacheService from '../services/CacheService.js';

export default class CacheController extends BaseController {
    constructor() {
        super();
        this.cacheService = CacheService;
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(req, res) {
        try {
            // Only admins can access cache statistics
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const stats = await this.cacheService.getStats();
            return this.sendSuccess(res, stats, 'Cache statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get cache statistics');
        }
    }

    /**
     * Clear all caches
     */
    async clearAllCaches(req, res) {
        try {
            // Only admins can clear caches
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.cacheService.clearAll();
            return this.sendSuccess(res, result, 'All caches cleared successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to clear caches');
        }
    }

    /**
     * Clear specific cache by type
     */
    async clearCacheByType(req, res) {
        try {
            const { type } = req.params;

            // Only admins can clear caches
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!['user', 'event', 'main'].includes(type)) {
                return this.sendError(res, 'Invalid cache type. Valid types: user, event, main', 400);
            }

            const result = await this.cacheService.clearByType(type);
            return this.sendSuccess(res, result, `${type} cache cleared successfully`);
        } catch (error) {
            return this.handleError(res, error, `Failed to clear ${req.params.type} cache`);
        }
    }

    /**
     * Clear cache by key pattern
     */
    async clearCacheByPattern(req, res) {
        try {
            const { pattern } = req.body;

            // Only admins can clear caches
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!pattern) {
                return this.sendError(res, 'Pattern is required', 400);
            }

            const result = await this.cacheService.clearByPattern(pattern);
            return this.sendSuccess(res, result, 'Cache cleared by pattern successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to clear cache by pattern');
        }
    }

    /**
     * Invalidate user cache
     */
    async invalidateUserCache(req, res) {
        try {
            const { userId } = req.params;

            // Only admins can invalidate caches, or users can invalidate their own cache
            if (req.user?.role !== 'admin' && req.user?.id !== userId) {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = this.cacheService.invalidateUser(userId);
            return this.sendSuccess(res, { invalidated: result }, 'User cache invalidated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to invalidate user cache');
        }
    }

    /**
     * Invalidate event cache
     */
    async invalidateEventCache(req, res) {
        try {
            const { eventId } = req.params;

            // Only admins can invalidate event caches
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = this.cacheService.invalidateEvent(eventId);
            return this.sendSuccess(res, { invalidated: result }, 'Event cache invalidated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to invalidate event cache');
        }
    }

    /**
     * Get cache health status
     */
    async getCacheHealth(req, res) {
        try {
            // Only admins can access cache health
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const health = await this.cacheService.getHealth();
            return this.sendSuccess(res, health, 'Cache health status retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get cache health');
        }
    }

    /**
     * Warm up caches
     */
    async warmUpCaches(req, res) {
        try {
            const { types } = req.body;

            // Only admins can warm up caches
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.cacheService.warmUp(types);
            return this.sendSuccess(res, result, 'Cache warm-up completed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to warm up caches');
        }
    }

    /**
     * Get cache configuration
     */
    async getCacheConfig(req, res) {
        try {
            // Only admins can access cache configuration
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const config = await this.cacheService.getConfig();
            return this.sendSuccess(res, config, 'Cache configuration retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get cache configuration');
        }
    }

    /**
     * Update cache configuration
     */
    async updateCacheConfig(req, res) {
        try {
            const configData = req.body;

            // Only admins can update cache configuration
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.cacheService.updateConfig(configData);
            return this.sendSuccess(res, result, 'Cache configuration updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update cache configuration');
        }
    }

    /**
     * Get cache keys
     */
    async getCacheKeys(req, res) {
        try {
            const { type, pattern, limit = 100 } = req.query;

            // Only admins can access cache keys
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const keys = await this.cacheService.getKeys(type, pattern, parseInt(limit));
            return this.sendSuccess(res, keys, 'Cache keys retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get cache keys');
        }
    }

    /**
     * Get cached value by key
     */
    async getCachedValue(req, res) {
        try {
            const { key } = req.params;

            // Only admins can access cached values
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const value = await this.cacheService.getValue(key);
            
            if (value === null) {
                return this.sendError(res, 'Key not found in cache', 404);
            }

            return this.sendSuccess(res, { key, value }, 'Cached value retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get cached value');
        }
    }

    /**
     * Delete specific cache key
     */
    async deleteCacheKey(req, res) {
        try {
            const { key } = req.params;

            // Only admins can delete cache keys
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.cacheService.deleteKey(key);
            return this.sendSuccess(res, { deleted: result }, 'Cache key deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete cache key');
        }
    }
}
