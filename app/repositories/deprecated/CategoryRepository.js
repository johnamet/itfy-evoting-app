#!/usr/bin/env node
/**
 * Category Repository
 * 
 * Extends BaseRepository to provide Category-specific database operations.
 * Includes category management, candidate association, and filtering operations.
 */

import BaseRepository from './BaseRepository.js';
import Category from '../models/Category.js';
import mongoose from 'mongoose';

class CategoryRepository extends BaseRepository {
    
    constructor() {
        // Get the Category model
        super(Category);
    }

    /**
     * Create a new category
     * @param {Object} categoryData - Category data
     * @returns {Promise<Object>} Created category
     */
    async createCategory(categoryData) {
        try {
            // Check if category name already exists
            const existingCategory = await this.findByName(categoryData.name);
            if (existingCategory) {
                throw new Error(`Category with name '${categoryData.name}' already exists`);
            }

            return await this.create(categoryData);
        } catch (error) {
            throw this._handleError(error, 'createCategory');
        }
    }

    /**
     * Find category by name
     * @param {String} name - Category name
     * @returns {Promise<Object|null>} Category or null
     */
    async findByName(name) {
        try {
            return await this.findOne({ 
                name: name.trim(),
                isDeleted: false 
            });
        } catch (error) {
            throw this._handleError(error, 'findByName');
        }
    }

    /**
     * Get active categories
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Active categories
     */
    async getActiveCategories(options = {}) {
        try {
            return await this.find({
                isActive: true,
                isDeleted: false
            }, {
                ...options,
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'updatedBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ],
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActiveCategories');
        }
    }

    /**
     * Get categories by creator
     * @param {String|ObjectId} createdBy - Creator user ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Categories created by user
     */
    async getCategoriesByCreator(createdBy, options = {}) {
        try {
            return await this.find({
                createdBy: createdBy,
                isDeleted: false
            }, {
                ...options,
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'updatedBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ],
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getCategoriesByCreator');
        }
    }

    /**
     * Search categories by text
     * @param {String} searchText - Text to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching categories
     */
    async searchCategories(searchText, options = {}) {
        try {
            const searchRegex = new RegExp(searchText, 'i');
            return await this.find({
                $and: [
                    {
                        $or: [
                            { name: { $regex: searchRegex } },
                            { description: { $regex: searchRegex } }
                        ]
                    },
                    { isDeleted: false }
                ]
            }, {
                ...options,
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ],
                sort: { name: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'searchCategories');
        }
    }

    /**
     * Full text search using MongoDB text index
     * @param {String} searchText - Text to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching categories with text scores
     */
    async fullTextSearch(searchText, options = {}) {
        try {
            return await this.find({
                $and: [
                    { $text: { $search: searchText } },
                    { isDeleted: false }
                ]
            }, {
                ...options,
                projection: { score: { $meta: "textScore" } },
                sort: { score: { $meta: "textScore" } },
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ]
            });
        } catch (error) {
            throw this._handleError(error, 'fullTextSearch');
        }
    }

    /**
     * Update category by name
     * @param {String} name - Category name
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} Updated category
     */
    async updateCategoryByName(name, updateData) {
        try {
            const category = await this.findByName(name);
            if (!category) {
                throw new Error(`Category with name '${name}' not found`);
            }

            // If updating name, check for conflicts
            if (updateData.name && updateData.name !== name) {
                const existingCategory = await this.findByName(updateData.name);
                if (existingCategory) {
                    throw new Error(`Category with name '${updateData.name}' already exists`);
                }
            }

            return await this.updateById(category._id, updateData);
        } catch (error) {
            throw this._handleError(error, 'updateCategoryByName');
        }
    }

    /**
     * Soft delete category by name
     * @param {String} name - Category name
     * @returns {Promise<Object|null>} Soft deleted category
     */
    async softDeleteCategoryByName(name) {
        try {
            const category = await this.findByName(name);
            if (!category) {
                throw new Error(`Category with name '${name}' not found`);
            }

            return await this.updateById(category._id, { 
                isDeleted: true, 
                isActive: false,
                updatedAt: new Date()
            });
        } catch (error) {
            throw this._handleError(error, 'softDeleteCategoryByName');
        }
    }

    /**
     * Toggle category active status
     * @param {String|ObjectId} categoryId - Category ID
     * @returns {Promise<Object|null>} Updated category
     */
    async toggleActiveStatus(categoryId) {
        try {
            const category = await this.findById(categoryId);
            if (!category) {
                throw new Error(`Category with ID '${categoryId}' not found`);
            }

            if (category.isDeleted) {
                throw new Error('Cannot change status of deleted category');
            }

            return await this.updateById(categoryId, { 
                isActive: !category.isActive,
                updatedAt: new Date()
            });
        } catch (error) {
            throw this._handleError(error, 'toggleActiveStatus');
        }
    }

    /**
     * Add candidate to category
     * @param {String|ObjectId} categoryId - Category ID
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object|null>} Updated category
     */
    async addCandidateToCategory(categoryId, candidateId) {
        try {
            const category = await this.findById(categoryId);
            if (!category) {
                throw new Error(`Category with ID '${categoryId}' not found`);
            }

            if (category.isDeleted) {
                throw new Error('Cannot add candidate to deleted category');
            }

            // Check if candidate is already in the category
            if (category.candidates.includes(candidateId)) {
                throw new Error('Candidate is already in this category');
            }

            return await this.updateById(categoryId, {
                $push: { candidates: candidateId },
                updatedAt: new Date()
            });
        } catch (error) {
            throw this._handleError(error, 'addCandidateToCategory');
        }
    }

    /**
     * Remove candidate from category
     * @param {String|ObjectId} categoryId - Category ID
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object|null>} Updated category
     */
    async removeCandidateFromCategory(categoryId, candidateId) {
        try {
            const category = await this.findById(categoryId);
            if (!category) {
                throw new Error(`Category with ID '${categoryId}' not found`);
            }

            // Check if candidate is in the category
            if (!category.candidates.includes(candidateId)) {
                throw new Error('Candidate is not in this category');
            }

            return await this.updateById(categoryId, {
                $pull: { candidates: candidateId },
                updatedAt: new Date()
            });
        } catch (error) {
            throw this._handleError(error, 'removeCandidateFromCategory');
        }
    }

    /**
     * Get categories with candidate count
     * @param {Object} filter - Filter criteria
     * @returns {Promise<Array>} Categories with candidate counts
     */
    async getCategoriesWithCandidateCount(filter = {}) {
        try {
            const pipeline = [
                {
                    $match: {
                        isDeleted: false,
                        ...filter
                    }
                },
                {
                    $addFields: {
                        candidateCount: { $size: '$candidates' }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'createdBy',
                        foreignField: '_id',
                        as: 'createdByInfo'
                    }
                },
                {
                    $addFields: {
                        createdBy: { $arrayElemAt: ['$createdByInfo', 0] }
                    }
                },
                {
                    $project: {
                        createdByInfo: 0,
                        'createdBy.password': 0,
                        'createdBy.email': 0
                    }
                },
                {
                    $sort: { createdAt: -1 }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getCategoriesWithCandidateCount');
        }
    }

    /**
     * Get category statistics
     * @returns {Promise<Object>} Category statistics
     */
    async getCategoryStatistics() {
        try {
            const pipeline = [
                {
                    $match: { isDeleted: false }
                },
                {
                    $group: {
                        _id: null,
                        totalCategories: { $sum: 1 },
                        activeCategories: {
                            $sum: { $cond: ['$isActive', 1, 0] }
                        },
                        inactiveCategories: {
                            $sum: { $cond: ['$isActive', 0, 1] }
                        },
                        totalCandidates: { $sum: { $size: '$candidates' } },
                        avgCandidatesPerCategory: { $avg: { $size: '$candidates' } },
                        categoriesWithNoCandidates: {
                            $sum: { $cond: [{ $eq: [{ $size: '$candidates' }, 0] }, 1, 0] }
                        },
                        categoriesWithCandidates: {
                            $sum: { $cond: [{ $gt: [{ $size: '$candidates' }, 0] }, 1, 0] }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalCategories: 1,
                        activeCategories: 1,
                        inactiveCategories: 1,
                        totalCandidates: 1,
                        avgCandidatesPerCategory: { $round: ['$avgCandidatesPerCategory', 2] },
                        categoriesWithNoCandidates: 1,
                        categoriesWithCandidates: 1,
                        activePercentage: {
                            $round: [
                                { $multiply: [{ $divide: ['$activeCategories', '$totalCategories'] }, 100] },
                                2
                            ]
                        }
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            
            return stats || {
                totalCategories: 0,
                activeCategories: 0,
                inactiveCategories: 0,
                totalCandidates: 0,
                avgCandidatesPerCategory: 0,
                categoriesWithNoCandidates: 0,
                categoriesWithCandidates: 0,
                activePercentage: 0
            };
        } catch (error) {
            throw this._handleError(error, 'getCategoryStatistics');
        }
    }

    /**
     * Get categories with pagination
     * @param {Number} page - Page number (1-based)
     * @param {Number} limit - Items per page
     * @param {Object} filter - Filter criteria
     * @returns {Promise<Object>} Paginated categories
     */
    async getCategoriesWithPagination(page = 1, limit = 10, filter = {}) {
        try {
            const skip = (page - 1) * limit;
            
            const criteria = {
                isDeleted: false,
                ...filter
            };

            const categories = await this.find(criteria, {
                skip,
                limit,
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'updatedBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ],
                sort: { createdAt: -1 }
            });

            const total = await this.countDocuments(criteria);
            const totalPages = Math.ceil(total / limit);

            return {
                categories,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw this._handleError(error, 'getCategoriesWithPagination');
        }
    }

    /**
     * Validate category data
     * @param {Object} categoryData - Category data to validate
     * @returns {Promise<Boolean>} True if valid
     */
    async validateCategoryData(categoryData) {
        try {
            const errors = [];

            // Validate name
            if (!categoryData.name || typeof categoryData.name !== 'string') {
                errors.push('Category name is required and must be a string');
            } else if (categoryData.name.trim().length < 2) {
                errors.push('Category name must be at least 2 characters long');
            } else if (categoryData.name.trim().length > 100) {
                errors.push('Category name must be less than 100 characters');
            }

            // Validate description
            if (!categoryData.description || typeof categoryData.description !== 'string') {
                errors.push('Category description is required and must be a string');
            } else if (categoryData.description.trim().length < 10) {
                errors.push('Category description must be at least 10 characters long');
            } else if (categoryData.description.trim().length > 1000) {
                errors.push('Category description must be less than 1000 characters');
            }

            // Validate icon
            if (!categoryData.icon || typeof categoryData.icon !== 'string') {
                errors.push('Category icon is required and must be a string');
            } else if (categoryData.icon.trim().length < 1) {
                errors.push('Category icon cannot be empty');
            } else if (categoryData.icon.trim().length > 200) {
                errors.push('Category icon must be less than 200 characters');
            }

            // Validate createdBy
            if (!categoryData.createdBy) {
                errors.push('CreatedBy user ID is required');
            }

            // Validate updatedBy
            if (!categoryData.updatedBy) {
                errors.push('UpdatedBy user ID is required');
            }

            // Validate isActive (if provided)
            if (categoryData.isActive !== undefined && typeof categoryData.isActive !== 'boolean') {
                errors.push('isActive must be a boolean value');
            }

            if (errors.length > 0) {
                throw new Error(`Validation errors: ${errors.join(', ')}`);
            }

            return true;
        } catch (error) {
            throw this._handleError(error, 'validateCategoryData');
        }
    }

    /**
     * Bulk create categories
     * @param {Array} categoriesData - Array of category data
     * @returns {Promise<Object>} Creation results
     */
    async bulkCreateCategories(categoriesData) {
        try {
            const createdCategories = [];
            const errors = [];

            for (const categoryData of categoriesData) {
                try {
                    await this.validateCategoryData(categoryData);
                    const category = await this.createCategory(categoryData);
                    createdCategories.push(category);
                } catch (error) {
                    errors.push({
                        categoryData,
                        error: error.message
                    });
                }
            }

            return {
                success: createdCategories,
                errors: errors,
                successCount: createdCategories.length,
                errorCount: errors.length
            };
        } catch (error) {
            throw this._handleError(error, 'bulkCreateCategories');
        }
    }

    /**
     * Get recently created categories
     * @param {Number} limit - Number of recent categories to retrieve
     * @returns {Promise<Array>} Recent categories
     */
    async getRecentCategories(limit = 10) {
        try {
            return await this.find({
                isDeleted: false
            }, {
                limit,
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ],
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getRecentCategories');
        }
    }

    /**
     * Get categories by status
     * @param {String} status - Category status
     * @returns {Promise<Array>} Categories with specified status
     */
    async getCategoriesByStatus(status) {
        try {
            return await this.find({
                status: status,
                isDeleted: false
            }, {
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'candidates', select: 'name' }
                ],
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getCategoriesByStatus');
        }
    }

    /**
     * Check if category name is available
     * @param {String} name - Name to check
     * @param {String|ObjectId} excludeId - Category ID to exclude from check (for updates)
     * @returns {Promise<Boolean>} True if name is available
     */
    async isNameAvailable(name, excludeId = null) {
        try {
            const criteria = { 
                name: name.trim(),
                isDeleted: false 
            };
            
            if (excludeId) {
                criteria._id = { $ne: excludeId };
            }

            const existingCategory = await this.findOne(criteria);
            return !existingCategory;
        } catch (error) {
            throw this._handleError(error, 'isNameAvailable');
        }
    }
}

export default CategoryRepository;
