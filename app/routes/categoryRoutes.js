#!/usr/bin/env node
/**
 * Category Routes
 * 
 * Defines API endpoints for category management operations.
 */

import express from 'express';
import CategoryController from '../controllers/CategoryController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete 
} from '../middleware/auth.js';

const router = express.Router();
const categoryController = new CategoryController();

// Category CRUD operations
router.post('/', requireCreate, (req, res) => categoryController.createCategory(req, res));
router.get('/', optionalAuth, (req, res) => categoryController.getCategories(req, res));
router.get('/:id', optionalAuth, (req, res) => categoryController.getCategoryById(req, res));
router.put('/:id', requireUpdate, (req, res) => categoryController.updateCategory(req, res));
router.delete('/:id', requireDelete, (req, res) => categoryController.deleteCategory(req, res));

// Category operations
router.get('/event/:eventId', optionalAuth, (req, res) => categoryController.getCategoriesByEvent(req, res));
router.get('/:id/stats', requireRead, (req, res) => categoryController.getCategoryStats(req, res));
router.patch('/:id/status', requireUpdate, (req, res) => categoryController.updateCategoryStatus(req, res));
router.post('/reorder', requireUpdate, (req, res) => categoryController.reorderCategories(req, res));

export default router;
