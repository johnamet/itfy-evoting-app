#!/usr/bin/env node
/**
 * Category Service
 * 
 * Handles category management for voting events including creation,
 * updates, and category-related business logic.
 */

import BaseService from './BaseService.js';
import CategoryRepository from '../repositories/CategoryRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import CandidateRepository from '../repositories/CandidateRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import CacheService from './CacheService.js';

class CategoryService extends BaseService {
    constructor() {
        super();
        this.categoryRepository = new CategoryRepository();
        this.eventRepository = new EventRepository();
        this.candidateRepository = new CandidateRepository();
        this.activityRepository = new ActivityRepository();
    }

    /**
     * Create a new category for an event
     * @param {Object} categoryData - Category data
     * @param {String} createdBy - ID of user creating the category
     * @returns {Promise<Object>} Created category
     */
    async createCategory(categoryData, createdBy) {
        try {
            this._log('create_category', { name: categoryData.name, eventId: categoryData.eventId, createdBy });

            // Validate required fields
            this._validateRequiredFields(categoryData, ['name', 'eventId']);
            this._validateObjectId(categoryData.eventId, 'Event ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Check if event exists
            const event = await this.eventRepository.findById(categoryData.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Check if event can have categories added
            if (event.status === 'active' || event.status === 'completed') {
                throw new Error('Cannot add categories to active or completed events');
            }

            // Check for duplicate category name in the same event
            const existingCategory = await this.categoryRepository.findByNameAndEvent(
                categoryData.name, 
                categoryData.eventId
            );
            if (existingCategory) {
                throw new Error('Category with this name already exists in the event');
            }

            // Create category
            const categoryToCreate = {
                ...this._sanitizeData(categoryData),
                createdBy,
                createdAt: new Date()
            };

            const category = await this.categoryRepository.create(categoryToCreate);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'category_create',
                targetType: 'category',
                targetId: category._id,
                metadata: { 
                    categoryName: category.name,
                    eventId: category.eventId,
                    eventName: event.name
                }
            });

            // Invalidate event cache
            CacheService.invalidateEvent(categoryData.eventId);

            this._log('create_category_success', { categoryId: category._id, name: category.name });

            return {
                success: true,
                category: {
                    id: category._id,
                    name: category.name,
                    description: category.description,
                    eventId: category.eventId,
                    maxCandidates: category.maxCandidates,
                    allowMultipleVotes: category.allowMultipleVotes,
                    createdAt: category.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_category', { name: categoryData.name });
        }
    }

    /**
     * Update category details
     * @param {String} categoryId - Category ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user updating the category
     * @returns {Promise<Object>} Updated category
     */
    async updateCategory(categoryId, updateData, updatedBy) {
        try {
            this._log('update_category', { categoryId, updatedBy });

            this._validateObjectId(categoryId, 'Category ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current category
            const currentCategory = await this.categoryRepository.findById(categoryId);
            if (!currentCategory) {
                throw new Error('Category not found');
            }

            // Check if event allows updates
            const event = await this.eventRepository.findById(currentCategory.eventId);
            if (event.status === 'active' || event.status === 'completed') {
                throw new Error('Cannot update categories of active or completed events');
            }

            // Check for duplicate name if name is being updated
            if (updateData.name && updateData.name !== currentCategory.name) {
                const existingCategory = await this.categoryRepository.findByNameAndEvent(
                    updateData.name, 
                    currentCategory.eventId
                );
                if (existingCategory) {
                    throw new Error('Category with this name already exists in the event');
                }
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            delete sanitizedData._id;
            delete sanitizedData.eventId;
            delete sanitizedData.createdAt;
            delete sanitizedData.createdBy;
            sanitizedData.updatedAt = new Date();

            // Update category
            const updatedCategory = await this.categoryRepository.updateById(categoryId, sanitizedData);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'category_update',
                targetType: 'category',
                targetId: categoryId,
                metadata: { 
                    categoryName: updatedCategory.name,
                    updatedFields: Object.keys(sanitizedData),
                    eventId: updatedCategory.eventId
                }
            });

            // Invalidate event cache
            CacheService.invalidateEvent(currentCategory.eventId);

            this._log('update_category_success', { categoryId });

            return {
                success: true,
                category: {
                    id: updatedCategory._id,
                    name: updatedCategory.name,
                    description: updatedCategory.description,
                    maxCandidates: updatedCategory.maxCandidates,
                    allowMultipleVotes: updatedCategory.allowMultipleVotes,
                    updatedAt: updatedCategory.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_category', { categoryId });
        }
    }

    /**
     * Delete a category
     * @param {String} categoryId - Category ID
     * @param {String} deletedBy - ID of user deleting the category
     * @returns {Promise<Object>} Deletion result
     */
    async deleteCategory(categoryId, deletedBy) {
        try {
            this._log('delete_category', { categoryId, deletedBy });

            this._validateObjectId(categoryId, 'Category ID');
            this._validateObjectId(deletedBy, 'Deleted By User ID');

            // Get category
            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            // Check if event allows deletions
            const event = await this.eventRepository.findById(category.eventId);
            if (event.status === 'active' || event.status === 'completed') {
                throw new Error('Cannot delete categories from active or completed events');
            }

            // Check if category has candidates
            const candidates = await this.candidateRepository.findByCategory(categoryId);
            if (candidates.length > 0) {
                throw new Error('Cannot delete category with existing candidates');
            }

            // Delete category
            await this.categoryRepository.deleteById(categoryId);

            // Log activity
            await this.activityRepository.logActivity({
                user: deletedBy,
                action: 'category_delete',
                targetType: 'category',
                targetId: categoryId,
                metadata: { 
                    categoryName: category.name,
                    eventId: category.eventId
                }
            });

            // Invalidate event cache
            CacheService.invalidateEvent(category.eventId);

            this._log('delete_category_success', { categoryId });

            return {
                success: true,
                message: 'Category deleted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'delete_category', { categoryId });
        }
    }

    /**
     * Get category by ID
     * @param {String} categoryId - Category ID
     * @returns {Promise<Object>} Category details
     */
    async getCategoryById(categoryId) {
        try {
            this._log('get_category_by_id', { categoryId });

            this._validateObjectId(categoryId, 'Category ID');

            // Check cache first
            const cacheKey = `category:${categoryId}`;
            let category = CacheService.get(cacheKey);

            if (!category) {
                category = await this.categoryRepository.findById(categoryId);
                if (!category) {
                    throw new Error('Category not found');
                }

                // Cache the category
                CacheService.set(cacheKey, category, 1800000); // 30 minutes
            }

            // Get candidates count
            const candidates = await this.candidateRepository.findByCategory(categoryId);
            const candidatesCount = candidates.length;

            return {
                success: true,
                category: {
                    id: category._id,
                    name: category.name,
                    description: category.description,
                    eventId: category.eventId,
                    maxCandidates: category.maxCandidates,
                    allowMultipleVotes: category.allowMultipleVotes,
                    candidatesCount,
                    createdAt: category.createdAt,
                    updatedAt: category.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_category_by_id', { categoryId });
        }
    }

    /**
     * Get categories for an event
     * @param {String} eventId - Event ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Event categories
     */
    async getCategoriesByEvent(eventId, query = {}) {
        try {
            this._log('get_categories_by_event', { eventId, query });

            this._validateObjectId(eventId, 'Event ID');

            // Check cache first
            const cacheKey = `categories:event:${eventId}`;
            let categories = CacheService.get(cacheKey);

            if (!categories) {
                categories = await this.categoryRepository.findByEvent(eventId);
                
                // Cache the categories
                CacheService.set(cacheKey, categories, 1800000); // 30 minutes
            }

            // Get candidates count for each category
            const categoriesWithStats = await Promise.all(
                categories.map(async (category) => {
                    const candidates = await this.candidateRepository.findByCategory(category._id);
                    return {
                        id: category._id,
                        name: category.name,
                        description: category.description,
                        maxCandidates: category.maxCandidates,
                        allowMultipleVotes: category.allowMultipleVotes,
                        candidatesCount: candidates.length,
                        createdAt: category.createdAt
                    };
                })
            );

            return {
                success: true,
                data: categoriesWithStats
            };
        } catch (error) {
            throw this._handleError(error, 'get_categories_by_event', { eventId });
        }
    }

    /**
     * Get categories with filtering and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Paginated categories
     */
    async getCategories(query = {}) {
        try {
            this._log('get_categories', { query });

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Create filter based on query
            const filter = this._createSearchFilter(query, ['name', 'description']);

            // Add event filter if specified
            if (query.eventId) {
                this._validateObjectId(query.eventId, 'Event ID');
                filter.eventId = query.eventId;
            }

            const categories = await this.categoryRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { createdAt: -1 }
            });

            // Get total count for pagination
            const total = await this.categoryRepository.countDocuments(filter);

            // Format categories with additional information
            const formattedCategories = await Promise.all(
                categories.map(async (category) => {
                    const candidates = await this.candidateRepository.findByCategory(category._id);
                    return {
                        id: category._id,
                        name: category.name,
                        description: category.description,
                        eventId: category.eventId,
                        maxCandidates: category.maxCandidates,
                        allowMultipleVotes: category.allowMultipleVotes,
                        candidatesCount: candidates.length,
                        createdAt: category.createdAt
                    };
                })
            );

            return {
                success: true,
                data: this._formatPaginationResponse(formattedCategories, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_categories', { query });
        }
    }

    /**
     * Check if category can accept more candidates
     * @param {String} categoryId - Category ID
     * @returns {Promise<Object>} Availability status
     */
    async checkCandidateAvailability(categoryId) {
        try {
            this._log('check_candidate_availability', { categoryId });

            this._validateObjectId(categoryId, 'Category ID');

            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            const candidates = await this.candidateRepository.findByCategory(categoryId);
            const currentCount = candidates.length;
            const maxCandidates = category.maxCandidates || Infinity;
            const canAddMore = currentCount < maxCandidates;

            return {
                success: true,
                data: {
                    currentCandidates: currentCount,
                    maxCandidates: category.maxCandidates,
                    canAddMore,
                    remaining: maxCandidates === Infinity ? Infinity : maxCandidates - currentCount
                }
            };
        } catch (error) {
            throw this._handleError(error, 'check_candidate_availability', { categoryId });
        }
    }

    /**
     * Get category statistics
     * @param {String} categoryId - Category ID
     * @returns {Promise<Object>} Category statistics
     */
    async getCategoryStats(categoryId) {
        try {
            this._log('get_category_stats', { categoryId });

            this._validateObjectId(categoryId, 'Category ID');

            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            const candidates = await this.candidateRepository.findByCategory(categoryId);
            const candidatesCount = candidates.length;

            // Get vote counts if event is active or completed
            let totalVotes = 0;
            const candidateStats = [];

            for (const candidate of candidates) {
                const votes = await this.voteRepository.getVotesByCandidate(candidate._id);
                const voteCount = votes.length;
                totalVotes += voteCount;

                candidateStats.push({
                    candidateId: candidate._id,
                    candidateName: candidate.name,
                    votes: voteCount
                });
            }

            return {
                success: true,
                data: {
                    categoryId: category._id,
                    categoryName: category.name,
                    candidatesCount,
                    totalVotes,
                    maxCandidates: category.maxCandidates,
                    allowMultipleVotes: category.allowMultipleVotes,
                    candidates: candidateStats
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_category_stats', { categoryId });
        }
    }
}

export default CategoryService;
