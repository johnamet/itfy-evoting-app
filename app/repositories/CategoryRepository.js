import BaseRepository from '../BaseRepository.js';
import Category from '../../models/Category.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

/**
 * CategoryRepository
 * 
 * Manages voting categories with intelligent caching. Categories are cached with a 15-minute TTL
 * since they don't change frequently but are accessed often during voting events.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - Event-specific queries are cached for quick access
 * - Position updates invalidate all query caches
 * - Status changes invalidate both entity and query caches
 * 
 * @extends BaseRepository
 */
class CategoryRepository extends BaseRepository {
    constructor() {
        super(Category, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 900 // 15 minutes
        });
    }

    /**
     * Create a new category
     * 
     * @param {Object} categoryData - Category data
     * @param {string} categoryData.name - Category name
     * @param {string} categoryData.event - Event ID
     * @param {string} [categoryData.description] - Category description
     * @param {number} [categoryData.position] - Display position
     * @param {number} [categoryData.maxSelections=1] - Maximum selections allowed
     * @param {boolean} [categoryData.required=false] - Whether category is required
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created category
     */
    async createCategory(categoryData, options = {}) {
        this._validateRequiredFields(categoryData, ['name', 'event']);

        const categoryToCreate = {
            ...categoryData,
            maxSelections: categoryData.maxSelections || 1,
            required: categoryData.required !== undefined ? categoryData.required : false,
            active: true
        };

        // Set position if not provided
        if (!categoryToCreate.position) {
            const maxPosition = await this.Model.findOne({ event: categoryData.event })
                .sort({ position: -1 })
                .select('position')
                .lean();
            
            categoryToCreate.position = maxPosition ? maxPosition.position + 1 : 1;
        }

        return await this.create(categoryToCreate, options);
    }

    /**
     * Update a category
     * 
     * @param {string} categoryId - Category ID
     * @param {Object} updateData - Update data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated category
     */
    async updateCategory(categoryId, updateData, options = {}) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        // Prevent updating event reference
        const { event, ...safeUpdateData } = updateData;

        return await this.updateById(categoryId, safeUpdateData, options);
    }

    /**
     * Find categories by event ID
     * Results are sorted by position
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Event categories sorted by position
     */
    async findByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.find(
            { event: eventId },
            {
                ...options,
                sort: options.sort || { position: 1, createdAt: 1 }
            }
        );
    }

    /**
     * Find active categories for an event
     * Only returns categories where active=true
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Active event categories
     */
    async findActiveByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.find(
            { event: eventId, active: true },
            {
                ...options,
                sort: options.sort || { position: 1, createdAt: 1 }
            }
        );
    }

    /**
     * Find required categories for an event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Required categories
     */
    async findRequiredByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.find(
            { event: eventId, required: true, active: true },
            {
                ...options,
                sort: options.sort || { position: 1, createdAt: 1 }
            }
        );
    }

    /**
     * Count categories in an event
     * 
     * @param {string} eventId - Event ID
     * @param {boolean} [activeOnly=false] - Count only active categories
     * @returns {Promise<number>} Category count
     */
    async countByEvent(eventId, activeOnly = false) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        const query = { event: eventId };
        if (activeOnly) {
            query.active = true;
        }

        return await this.count(query);
    }

    /**
     * Activate a category
     * 
     * @param {string} categoryId - Category ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated category
     */
    async activateCategory(categoryId, options = {}) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        return await this.updateById(categoryId, { active: true }, options);
    }

    /**
     * Deactivate a category
     * 
     * @param {string} categoryId - Category ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated category
     */
    async deactivateCategory(categoryId, options = {}) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        return await this.updateById(categoryId, { active: false }, options);
    }

    /**
     * Update category position
     * Invalidates all query caches since ordering affects list queries
     * 
     * @param {string} categoryId - Category ID
     * @param {number} newPosition - New position
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated category
     */
    async updatePosition(categoryId, newPosition, options = {}) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        if (typeof newPosition !== 'number' || newPosition < 1) {
            throw new Error('Position must be a positive number');
        }

        return await this.updateById(categoryId, { position: newPosition }, options);
    }

    /**
     * Reorder categories for an event
     * Updates positions for multiple categories
     * 
     * @param {string} eventId - Event ID
     * @param {Array<Object>} orderUpdates - Array of {categoryId, position} objects
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result
     */
    async reorderCategories(eventId, orderUpdates, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
            throw new Error('Order updates array is required');
        }

        return await this.withTransaction(async (session) => {
            const updates = orderUpdates.map(({ categoryId, position }) => {
                return this.updateById(
                    categoryId,
                    { position },
                    { ...options, session }
                );
            });

            await Promise.all(updates);

            return {
                success: true,
                updatedCount: orderUpdates.length
            };
        });
    }

    /**
     * Delete a category
     * Note: Should check if category has votes before deletion
     * 
     * @param {string} categoryId - Category ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Deleted category
     */
    async deleteCategory(categoryId, options = {}) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        return await this.deleteById(categoryId, options);
    }

    /**
     * Delete all categories for an event
     * Useful when deleting an event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result with deleted count
     */
    async deleteByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.deleteMany({ event: eventId }, options);
    }

    /**
     * Update multiple categories for an event
     * Useful for bulk status changes
     * 
     * @param {string} eventId - Event ID
     * @param {Object} updateData - Update data to apply
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result with modified count
     */
    async updateByEvent(eventId, updateData, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        // Prevent updating event reference
        const { event, ...safeUpdateData } = updateData;

        return await this.updateMany({ event: eventId }, safeUpdateData, options);
    }

    /**
     * Get category with vote count
     * 
     * @param {string} categoryId - Category ID
     * @returns {Promise<Object>} Category with vote count
     */
    async getCategoryWithVoteCount(categoryId) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        const result = await this.Model.aggregate([
            { $match: { _id: this._toObjectId(categoryId) } },
            {
                $lookup: {
                    from: 'votes',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'votes'
                }
            },
            {
                $addFields: {
                    voteCount: { $size: '$votes' }
                }
            },
            {
                $project: {
                    votes: 0
                }
            }
        ]);

        return result[0] || null;
    }

    /**
     * Get event categories with vote counts
     * 
     * @param {string} eventId - Event ID
     * @returns {Promise<Array>} Categories with vote counts
     */
    async getEventCategoriesWithVoteCounts(eventId) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        const categories = await this.Model.aggregate([
            { $match: { event: this._toObjectId(eventId) } },
            {
                $lookup: {
                    from: 'votes',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'votes'
                }
            },
            {
                $addFields: {
                    voteCount: { $size: '$votes' }
                }
            },
            {
                $project: {
                    votes: 0
                }
            },
            {
                $sort: { position: 1, createdAt: 1 }
            }
        ]);

        return categories;
    }

    /**
     * Get category statistics
     * 
     * @param {string} categoryId - Category ID
     * @returns {Promise<Object>} Category statistics
     */
    async getCategoryStats(categoryId) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        const stats = await this.Model.aggregate([
            { $match: { _id: this._toObjectId(categoryId) } },
            {
                $lookup: {
                    from: 'candidates',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'candidates'
                }
            },
            {
                $lookup: {
                    from: 'votes',
                    localField: '_id',
                    foreignField: 'category',
                    as: 'votes'
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    active: 1,
                    required: 1,
                    maxSelections: 1,
                    candidateCount: { $size: '$candidates' },
                    voteCount: { $size: '$votes' },
                    activeCandidates: {
                        $size: {
                            $filter: {
                                input: '$candidates',
                                as: 'candidate',
                                cond: { $eq: ['$$candidate.active', true] }
                            }
                        }
                    }
                }
            }
        ]);

        return stats[0] || null;
    }

    /**
     * Validate category voting rules
     * Check if user selections comply with category rules
     * 
     * @param {string} categoryId - Category ID
     * @param {Array<string>} candidateIds - Selected candidate IDs
     * @returns {Promise<Object>} Validation result
     */
    async validateSelections(categoryId, candidateIds = []) {
        if (!categoryId) {
            throw new Error('Category ID is required');
        }

        const category = await this.findById(categoryId);

        if (!category) {
            return {
                valid: false,
                error: 'Category not found'
            };
        }

        if (!category.active) {
            return {
                valid: false,
                error: 'Category is not active'
            };
        }

        if (category.required && candidateIds.length === 0) {
            return {
                valid: false,
                error: 'This category requires at least one selection'
            };
        }

        if (candidateIds.length > category.maxSelections) {
            return {
                valid: false,
                error: `Maximum ${category.maxSelections} selection(s) allowed for this category`
            };
        }

        return {
            valid: true,
            category
        };
    }
}

export default CategoryRepository;
