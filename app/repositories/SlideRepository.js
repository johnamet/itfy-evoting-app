import BaseRepository from '../BaseRepository.js';
import Slide from '../../models/Slide.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

/**
 * SlideRepository
 * 
 * Manages presentation slides with intelligent caching. Slides are cached with a 15-minute TTL
 * since they are accessed frequently during events but don't change often.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - Event-specific queries are cached
 * - Position updates invalidate query caches
 * - Active status changes invalidate caches
 * 
 * @extends BaseRepository
 */
class SlideRepository extends BaseRepository {
    constructor() {
        super(Slide, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 900 // 15 minutes
        });
    }

    /**
     * Create a new slide
     * 
     * @param {Object} slideData - Slide data
     * @param {string} [slideData.event] - Event ID (if event-specific)
     * @param {string} slideData.title - Slide title
     * @param {string} [slideData.content] - Slide content
     * @param {string} [slideData.type='info'] - Slide type (info, image, video, etc.)
     * @param {number} [slideData.position] - Display position
     * @param {number} [slideData.duration=5] - Display duration in seconds
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created slide
     */
    async createSlide(slideData, options = {}) {
        this._validateRequiredFields(slideData, ['title']);

        const slideToCreate = {
            ...slideData,
            type: slideData.type || 'info',
            duration: slideData.duration || 5,
            active: true
        };

        // Set position if not provided
        if (!slideToCreate.position) {
            const query = slideData.event ? { event: slideData.event } : { event: { $exists: false } };
            const maxPosition = await this.Model.findOne(query)
                .sort({ position: -1 })
                .select('position')
                .lean();
            
            slideToCreate.position = maxPosition ? maxPosition.position + 1 : 1;
        }

        return await this.create(slideToCreate, options);
    }

    /**
     * Find slides by event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Event slides sorted by position
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
     * Find active slides by event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Active event slides
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
     * Find global slides (not event-specific)
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Global slides
     */
    async findGlobalSlides(options = {}) {
        return await this.find(
            { event: { $exists: false } },
            {
                ...options,
                sort: options.sort || { position: 1, createdAt: 1 }
            }
        );
    }

    /**
     * Find active global slides
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Active global slides
     */
    async findActiveGlobalSlides(options = {}) {
        return await this.find(
            {
                event: { $exists: false },
                active: true
            },
            {
                ...options,
                sort: options.sort || { position: 1, createdAt: 1 }
            }
        );
    }

    /**
     * Update slide
     * 
     * @param {string} slideId - Slide ID
     * @param {Object} updateData - Update data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated slide
     */
    async updateSlide(slideId, updateData, options = {}) {
        if (!slideId) {
            throw new Error('Slide ID is required');
        }

        return await this.updateById(slideId, updateData, options);
    }

    /**
     * Update slide position
     * 
     * @param {string} slideId - Slide ID
     * @param {number} newPosition - New position
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated slide
     */
    async updatePosition(slideId, newPosition, options = {}) {
        if (!slideId) {
            throw new Error('Slide ID is required');
        }

        if (typeof newPosition !== 'number' || newPosition < 1) {
            throw new Error('Position must be a positive number');
        }

        return await this.updateById(slideId, { position: newPosition }, options);
    }

    /**
     * Reorder slides
     * Updates positions for multiple slides
     * 
     * @param {Array<Object>} orderUpdates - Array of {slideId, position} objects
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result
     */
    async reorderSlides(orderUpdates, options = {}) {
        if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
            throw new Error('Order updates array is required');
        }

        return await this.withTransaction(async (session) => {
            const updates = orderUpdates.map(({ slideId, position }) => {
                return this.updateById(
                    slideId,
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
     * Activate slide
     * 
     * @param {string} slideId - Slide ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated slide
     */
    async activateSlide(slideId, options = {}) {
        if (!slideId) {
            throw new Error('Slide ID is required');
        }

        return await this.updateById(slideId, { active: true }, options);
    }

    /**
     * Deactivate slide
     * 
     * @param {string} slideId - Slide ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated slide
     */
    async deactivateSlide(slideId, options = {}) {
        if (!slideId) {
            throw new Error('Slide ID is required');
        }

        return await this.updateById(slideId, { active: false }, options);
    }

    /**
     * Delete slide
     * 
     * @param {string} slideId - Slide ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Deleted slide
     */
    async deleteSlide(slideId, options = {}) {
        if (!slideId) {
            throw new Error('Slide ID is required');
        }

        return await this.deleteById(slideId, options);
    }

    /**
     * Delete all slides for an event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result
     */
    async deleteByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.deleteMany({ event: eventId }, options);
    }

    /**
     * Count slides by event
     * 
     * @param {string} eventId - Event ID
     * @param {boolean} [activeOnly=false] - Count only active slides
     * @returns {Promise<number>} Slide count
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
     * Find slides by type
     * 
     * @param {string} type - Slide type
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Slides of type
     */
    async findByType(type, options = {}) {
        if (!type) {
            throw new Error('Slide type is required');
        }

        return await this.find(
            { type },
            {
                ...options,
                sort: options.sort || { position: 1, createdAt: 1 }
            }
        );
    }

    /**
     * Get total slide duration for an event
     * 
     * @param {string} eventId - Event ID
     * @param {boolean} [activeOnly=true] - Count only active slides
     * @returns {Promise<number>} Total duration in seconds
     */
    async getTotalDuration(eventId, activeOnly = true) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        const query = { event: eventId };
        if (activeOnly) {
            query.active = true;
        }

        const result = await this.Model.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalDuration: { $sum: '$duration' }
                }
            }
        ]);

        return result[0]?.totalDuration || 0;
    }

    /**
     * Get slide statistics
     * 
     * @param {string} [eventId] - Optional event ID filter
     * @returns {Promise<Object>} Slide statistics
     */
    async getSlideStats(eventId = null) {
        const query = eventId ? { event: eventId } : {};

        const [totalCount, activeCount, typeBreakdown] = await Promise.all([
            this.count(query),
            this.count({ ...query, active: true }),
            this.Model.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const typeStats = typeBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        return {
            totalSlides: totalCount,
            activeSlides: activeCount,
            inactiveSlides: totalCount - activeCount,
            typeBreakdown: typeStats
        };
    }

    /**
     * Bulk activate slides
     * 
     * @param {Array<string>} slideIds - Array of slide IDs
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result
     */
    async bulkActivate(slideIds, options = {}) {
        if (!Array.isArray(slideIds) || slideIds.length === 0) {
            throw new Error('Slide IDs array is required');
        }

        return await this.updateMany(
            { _id: { $in: slideIds } },
            { active: true },
            options
        );
    }

    /**
     * Bulk deactivate slides
     * 
     * @param {Array<string>} slideIds - Array of slide IDs
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result
     */
    async bulkDeactivate(slideIds, options = {}) {
        if (!Array.isArray(slideIds) || slideIds.length === 0) {
            throw new Error('Slide IDs array is required');
        }

        return await this.updateMany(
            { _id: { $in: slideIds } },
            { active: false },
            options
        );
    }

    /**
     * Clone slide to another event
     * 
     * @param {string} slideId - Source slide ID
     * @param {string} [targetEventId] - Target event ID (null for global)
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Cloned slide
     */
    async cloneSlide(slideId, targetEventId = null, options = {}) {
        if (!slideId) {
            throw new Error('Slide ID is required');
        }

        const sourceSlide = await this.findById(slideId);
        
        if (!sourceSlide) {
            throw new Error('Source slide not found');
        }

        const { _id, createdAt, updatedAt, ...slideData } = sourceSlide.toObject();

        const clonedSlideData = {
            ...slideData,
            event: targetEventId || undefined,
            position: undefined // Will be auto-assigned
        };

        return await this.createSlide(clonedSlideData, options);
    }
}

export default SlideRepository;
