/**
 * SlideService
 * 
 * Manages presentation slides/carousels for events and global display.
 * Handles slide creation, ordering, activation/deactivation, and statistics.
 * 
 * @extends BaseService
 * @module services/SlideService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class SlideService extends BaseService {
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'SlideService',
            primaryRepository: 'slide',
        });
    }

    /**
     * Create new slide
     * 
     * @param {Object} slideData - Slide data
     * @param {string} slideData.title - Slide title
     * @param {string} [slideData.description] - Slide description
     * @param {string} slideData.image - Image URL
     * @param {string} [slideData.link] - Link URL
     * @param {string} [slideData.event] - Event ID (optional, for event-specific slides)
     * @param {number} [slideData.order] - Display order
     * @param {string} [slideData.status='active'] - Status (active/inactive)
     */
    async createSlide(slideData) {
        return this.runInContext('createSlide', async () => {
            // Validate required fields
            this.validateRequiredFields(slideData, ['title', 'image']);

            // Validate image URL
            if (!this.validateUrl(slideData.image)) {
                throw new Error('Invalid image URL');
            }

            // Validate link URL if provided
            if (slideData.link && !this.validateUrl(slideData.link)) {
                throw new Error('Invalid link URL');
            }

            // Validate event if provided
            if (slideData.event) {
                const event = await this.repo('event').findById(slideData.event);
                if (!event) {
                    throw new Error('Event not found');
                }
            }

            // Create slide using repository
            const slide = await this.repo('slide').createSlide(slideData);

            return this.handleSuccess(slide, 'Slide created successfully');
        });
    }

    /**
     * Get slide by ID
     * 
     * @param {string} slideId - Slide ID
     */
    async getSlideById(slideId) {
        return this.runInContext('getSlideById', async () => {
            if (!slideId) {
                throw new Error('Slide ID is required');
            }

            const slide = await this.repo('slide').findById(slideId, {
                populate: [{ path: 'event', select: 'name status startDate endDate' }]
            });

            if (!slide) {
                throw new Error('Slide not found');
            }

            return this.handleSuccess(slide);
        });
    }

    /**
     * Get all slides with filtering
     * 
     * @param {Object} filters - Query filters
     * @param {string} [filters.event] - Filter by event ID
     * @param {string} [filters.status] - Filter by status
     * @param {boolean} [filters.global] - Get only global slides
     * @param {Object} options - Pagination options
     */
    async getAllSlides(filters = {}, options = {}) {
        return this.runInContext('getAllSlides', async () => {
            const { event, status, global } = filters;
            const query = {};

            if (event) {
                query.event = event;
            } else if (global) {
                query.event = { $exists: false };
            }

            if (status) {
                query.status = status;
            }

            const slides = await this.repo('slide').findWithPagination(query, {
                ...options,
                sort: options.sort || { order: 1, createdAt: -1 },
                populate: [{ path: 'event', select: 'name status' }]
            });

            return this.handleSuccess(slides);
        });
    }

    /**
     * Get active slides for display
     * 
     * @param {string} [eventId] - Event ID (optional, for event-specific slides)
     */
    async getActiveSlides(eventId = null) {
        return this.runInContext('getActiveSlides', async () => {
            let slides;

            if (eventId) {
                // Get active event-specific slides
                slides = await this.repo('slide').findActiveByEvent(eventId);
            } else {
                // Get active global slides
                slides = await this.repo('slide').findActiveGlobalSlides();
            }

            return this.handleSuccess(slides);
        });
    }

    /**
     * Get slides by event
     * 
     * @param {string} eventId - Event ID
     * @param {boolean} [activeOnly=false] - Get only active slides
     */
    async getSlidesByEvent(eventId, activeOnly = false) {
        return this.runInContext('getSlidesByEvent', async () => {
            if (!eventId) {
                throw new Error('Event ID is required');
            }

            // Verify event exists
            const event = await this.repo('event').findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            let slides;
            if (activeOnly) {
                slides = await this.repo('slide').findActiveByEvent(eventId);
            } else {
                slides = await this.repo('slide').findByEvent(eventId);
            }

            return this.handleSuccess(slides);
        });
    }

    /**
     * Update slide
     * 
     * @param {string} slideId - Slide ID
     * @param {Object} updateData - Update data
     */
    async updateSlide(slideId, updateData) {
        return this.runInContext('updateSlide', async () => {
            if (!slideId) {
                throw new Error('Slide ID is required');
            }

            // Validate URLs if provided
            if (updateData.image && !this.validateUrl(updateData.image)) {
                throw new Error('Invalid image URL');
            }

            if (updateData.link && !this.validateUrl(updateData.link)) {
                throw new Error('Invalid link URL');
            }

            // Validate event if changing
            if (updateData.event) {
                const event = await this.repo('event').findById(updateData.event);
                if (!event) {
                    throw new Error('Event not found');
                }
            }

            const slide = await this.repo('slide').updateSlide(slideId, updateData);

            if (!slide) {
                throw new Error('Slide not found');
            }

            return this.handleSuccess(slide, 'Slide updated successfully');
        });
    }

    /**
     * Reorder slides
     * 
     * @param {Array<Object>} orderUpdates - Array of {slideId, order} objects
     */
    async reorderSlides(orderUpdates) {
        return this.runInContext('reorderSlides', async () => {
            if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
                throw new Error('Order updates array is required');
            }

            // Validate all slides exist
            const slideIds = orderUpdates.map(u => u.slideId);
            const slides = await this.repo('slide').findMany({ _id: { $in: slideIds } });

            if (slides.length !== slideIds.length) {
                throw new Error('One or more slides not found');
            }

            // Convert order to position for repository
            const positionUpdates = orderUpdates.map(({ slideId, order }) => ({
                slideId,
                position: order
            }));

            const result = await this.repo('slide').reorderSlides(positionUpdates);

            return this.handleSuccess(result, 'Slides reordered successfully');
        });
    }

    /**
     * Update slide status
     * 
     * @param {string} slideId - Slide ID
     * @param {string} status - New status (active/inactive)
     */
    async updateSlideStatus(slideId, status) {
        return this.runInContext('updateSlideStatus', async () => {
            if (!slideId) {
                throw new Error('Slide ID is required');
            }

            if (!['active', 'inactive'].includes(status)) {
                throw new Error('Invalid status. Must be active or inactive');
            }

            const active = status === 'active';
            const slide = active 
                ? await this.repo('slide').activateSlide(slideId)
                : await this.repo('slide').deactivateSlide(slideId);

            if (!slide) {
                throw new Error('Slide not found');
            }

            return this.handleSuccess(slide, `Slide ${status === 'active' ? 'activated' : 'deactivated'} successfully`);
        });
    }

    /**
     * Delete slide
     * 
     * @param {string} slideId - Slide ID
     */
    async deleteSlide(slideId) {
        return this.runInContext('deleteSlide', async () => {
            if (!slideId) {
                throw new Error('Slide ID is required');
            }

            const slide = await this.repo('slide').deleteSlide(slideId);

            if (!slide) {
                throw new Error('Slide not found');
            }

            return this.handleSuccess(null, 'Slide deleted successfully');
        });
    }

    /**
     * Clone slide to another event or as global
     * 
     * @param {string} slideId - Source slide ID
     * @param {string} [targetEventId] - Target event ID (null for global)
     */
    async cloneSlide(slideId, targetEventId = null) {
        return this.runInContext('cloneSlide', async () => {
            if (!slideId) {
                throw new Error('Slide ID is required');
            }

            // Validate target event if provided
            if (targetEventId) {
                const event = await this.repo('event').findById(targetEventId);
                if (!event) {
                    throw new Error('Target event not found');
                }
            }

            const clonedSlide = await this.repo('slide').cloneSlide(slideId, targetEventId);

            return this.handleSuccess(clonedSlide, 'Slide cloned successfully');
        });
    }

    /**
     * Get slide statistics
     * 
     * @param {string} [eventId] - Event ID (optional)
     */
    async getSlideStatistics(eventId = null) {
        return this.runInContext('getSlideStatistics', async () => {
            // Validate event if provided
            if (eventId) {
                const event = await this.repo('event').findById(eventId);
                if (!event) {
                    throw new Error('Event not found');
                }
            }

            const stats = await this.repo('slide').getSlideStats(eventId);

            return this.handleSuccess(stats);
        });
    }

    /**
     * Bulk update slide status
     * 
     * @param {Array<string>} slideIds - Array of slide IDs
     * @param {string} status - New status (active/inactive)
     */
    async bulkUpdateStatus(slideIds, status) {
        return this.runInContext('bulkUpdateStatus', async () => {
            if (!Array.isArray(slideIds) || slideIds.length === 0) {
                throw new Error('Slide IDs array is required');
            }

            if (!['active', 'inactive'].includes(status)) {
                throw new Error('Invalid status. Must be active or inactive');
            }

            const result = status === 'active'
                ? await this.repo('slide').bulkActivate(slideIds)
                : await this.repo('slide').bulkDeactivate(slideIds);

            return this.handleSuccess(result, `${result.modifiedCount} slides updated successfully`);
        });
    }

    /**
     * Delete all slides for an event
     * 
     * @param {string} eventId - Event ID
     */
    async deleteEventSlides(eventId) {
        return this.runInContext('deleteEventSlides', async () => {
            if (!eventId) {
                throw new Error('Event ID is required');
            }

            // Verify event exists
            const event = await this.repo('event').findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            const result = await this.repo('slide').deleteByEvent(eventId);

            return this.handleSuccess(result, `${result.deletedCount} slides deleted successfully`);
        });
    }
}
