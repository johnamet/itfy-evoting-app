#!/usr/bin/env node
/**
 * Category Controller
 * 
 * Handles category management operations for voting categories.
 *
 * @swagger
 * tags:
 *   name: Categories
 *   description: Manages categories within events
 */

import BaseController from './BaseController.js';
import CategoryService from '../services/CategoryService.js';

export default class CategoryController extends BaseController {
    constructor() {
        super();
        this.categoryService = new CategoryService();
    }

    /**
     * Create a new category
     */
    async createCategory(req, res) {
        try {
            const categoryData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const category = await this.categoryService.createCategory(
                categoryData,
                createdBy
            );

            return this.sendSuccess(res, category, 'Category created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create category');
        }
    }

    /**
     * Get all categories with filtering and pagination
     */
    async getCategories(req, res) {
        try {
            const query = req.query;
            const categories = await this.categoryService.getCategories(query);
            return this.sendSuccess(res, categories, 'Categories retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get categories');
        }
    }

    /**
     * Get category by ID
     */
    async getCategoryById(req, res) {
        try {
            const { id } = req.params;
            const includeDetails = req.query.includeDetails;

            console.log(req.query)

            const category = await this.categoryService.getCategoryById(id, includeDetails);

            if (!category) {
                return this.sendError(res, 'Category not found', 404);
            }

            return this.sendSuccess(res, category, 'Category retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get category');
        }
    }

    /**
     * Update category
     */
    async updateCategory(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            const category = await this.categoryService.updateCategory(id,
                updateData,
                updatedBy
            );

            if (!category) {
                return this.sendError(res, 'Category not found', 404);
            }

            return this.sendSuccess(res, category, 'Category updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update category');
        }
    }

    /**
     * Delete category
     */
    async deleteCategory(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            const result = await this.categoryService.deleteCategory(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'Category not found', 404);
            }

            return this.sendSuccess(res, null, 'Category deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete category');
        }
    }

    /**
     * Get categories by event
     */
    async getCategoriesByEvent(req, res) {
        try {
            const { eventId } = req.params;
            const query = req.query;
            console.log(query)

            const categories = await this.categoryService.getCategoriesByEvent(eventId, query);
            return this.sendSuccess(res, categories, 'Event categories retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event categories');
        }
    }

    /**
     * Update category status
     */
    async updateCategoryStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedBy = req.user?.id || req.user?._id;

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const category = await this.categoryService.updateCategory(id,
                {
                    status,
                    isActive: status.toLowerCase() === 'active' ? true : false
                },
                updatedBy
            );

            if (!category) {
                return this.sendError(res, 'Category not found', 404);
            }

            return this.sendSuccess(res, category, 'Category status updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update category status');
        }
    }

    /**
     * Get category statistics
     */
    async getCategoryStats(req, res) {
        try {
            const { id } = req.params;
            const stats = await this.categoryService.getCategoryStats(id);

            if (!stats) {
                return this.sendError(res, 'Category not found', 404);
            }

            return this.sendSuccess(res, stats, 'Category statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get category statistics');
        }
    }

    /**
     * Reorder categories
     */
    async reorderCategories(req, res) {
        try {
            const { categoryIds } = req.body;
            const updatedBy = req.user?.id;

            if (!categoryIds || !Array.isArray(categoryIds)) {
                return this.sendError(res, 'Category IDs array is required', 400);
            }

            const result = await this.categoryService.reorderCategories(categoryIds, updatedBy);
            return this.sendSuccess(res, result, 'Categories reordered successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to reorder categories');
        }
    }
}
