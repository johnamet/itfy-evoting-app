#!/usr/bin/env node
/**
 * Cache Routes
 * 
 * Defines API endpoints for cache management operations.
 */

import express from 'express';
import CacheController from '../controllers/CacheController.js';
import { 
    requireRead, 
    requireDelete, 
    requireUpdate, 
    requireCreate, 
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const cacheController = new CacheController();

// Cache monitoring (Admin level access required)
router.get('/stats', requireLevel(3), (req, res) => cacheController.getCacheStats(req, res));
router.get('/health', requireLevel(3), (req, res) => cacheController.getCacheHealth(req, res));
router.get('/config', requireLevel(3), (req, res) => cacheController.getCacheConfig(req, res));
router.get('/keys', requireLevel(3), (req, res) => cacheController.getCacheKeys(req, res));
router.get('/value/:key', requireLevel(3), (req, res) => cacheController.getCachedValue(req, res));

// Cache management (Super admin level access required)
router.delete('/clear/all', requireLevel(4), (req, res) => cacheController.clearAllCaches(req, res));
router.delete('/clear/type/:type', requireLevel(4), (req, res) => cacheController.clearCacheByType(req, res));
router.delete('/clear/pattern', requireLevel(3), (req, res) => cacheController.clearCacheByPattern(req, res));
router.delete('/key/:key', requireLevel(3), (req, res) => cacheController.deleteCacheKey(req, res));

// Specific cache invalidation (Admin level access required)
router.delete('/user/:userId', requireLevel(3), (req, res) => cacheController.invalidateUserCache(req, res));
router.delete('/event/:eventId', requireLevel(3), (req, res) => cacheController.invalidateEventCache(req, res));

// Cache configuration (Super admin level access required)
router.put('/config', requireLevel(4), (req, res) => cacheController.updateCacheConfig(req, res));

// Cache warming (Admin level access required)
router.post('/warm-up', requireLevel(3), (req, res) => cacheController.warmUpCaches(req, res));

export default router;
