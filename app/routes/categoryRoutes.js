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
    requireDelete, 
    authenticate,
    requireLevel
} from '../middleware/auth.js';

const router = express.Router();
const categoryController = new CategoryController();

// Category CRUD operations


router.get('/', optionalAuth, (req, res) => categoryController.getCategories(req, res));
router.get('/:id', optionalAuth, (req, res) => categoryController.getCategoryById(req, res));
router.get('/event/:eventId', optionalAuth, (req, res) => categoryController.getCategoriesByEvent(req, res));
router.get('/:id/stats', (req, res) => categoryController.getCategoryStats(req, res));

router.use(authenticate)
router.post('/', requireLevel(3), (req, res) => categoryController.createCategory(req, res));
router.put('/:id', requireLevel(3), (req, res) => categoryController.updateCategory(req, res));
router.delete('/:id', requireLevel(3), (req, res) => categoryController.deleteCategory(req, res));
router.patch('/:id/status', requireLevel(3), (req, res) => categoryController.updateCategoryStatus(req, res));
router.post('/reorder', requireLevel(3), (req, res) => categoryController.reorderCategories(req, res));

export default router;
