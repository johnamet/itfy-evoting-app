#!/usr/bin/env node
/**
 * Slide Service
 * 
 * Handles slide/presentation management including creation, updates,
 * ordering, and slide-related business logic for events.
 */

import BaseService from './BaseService.js';
import SlideRepository from '../repositories/SlideRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import CacheService from './CacheService.js';

class SlideService extends BaseService {
    constructor() {
        super();
        this.slideRepository = new SlideRepository();
        this.eventRepository = new EventRepository();
        this.activityRepository = new ActivityRepository();
    }

    /**
     * Create a new slide
     * @param {Object} slideData - Slide data
     * @param {String} createdBy - ID of user creating the slide
     * @returns {Promise<Object>} Created slide
     */
    async createSlide(slideData, createdBy) {
        try {
            this._log('create_slide', { title: slideData.title, eventId: slideData.eventId, createdBy });

            // Validate required fields
            this._validateRequiredFields(slideData, ['title', 'content', 'eventId']);
            this._validateObjectId(slideData.eventId, 'Event ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Check if event exists
            const event = await this.eventRepository.findById(slideData.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get next order position if not specified
            let order = slideData.order;
            if (order === undefined || order === null) {
                const maxOrder = await this.slideRepository.getMaxOrderForEvent(slideData.eventId);
                order = (maxOrder || 0) + 1;
            }

            // Validate slide type
            const validTypes = ['intro', 'content', 'candidate', 'results', 'outro'];
            if (slideData.type && !validTypes.includes(slideData.type)) {
                throw new Error('Invalid slide type');
            }

            // Create slide
            const slideToCreate = {
                ...this._sanitizeData(slideData),
                order,
                isActive: slideData.isActive !== false, // Default to true
                createdBy,
                createdAt: new Date()
            };

            const slide = await this.slideRepository.create(slideToCreate);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'slide_create',
                targetType: 'slide',
                targetId: slide._id,
                metadata: {
                    slideTitle: slide.title,
                    eventId: slide.eventId,
                    eventName: event.name,
                    order: slide.order
                }
            });

            // Invalidate event slides cache
            CacheService.delete(`slides:event:${slideData.eventId}`);

            this._log('create_slide_success', { slideId: slide._id, title: slide.title });

            return {
                success: true,
                slide: {
                    id: slide._id,
                    title: slide.title,
                    content: slide.content,
                    type: slide.type,
                    eventId: slide.eventId,
                    order: slide.order,
                    isActive: slide.isActive,
                    settings: slide.settings,
                    createdAt: slide.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_slide', { title: slideData.title });
        }
    }

    /**
     * Update slide details
     * @param {String} slideId - Slide ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user updating the slide
     * @returns {Promise<Object>} Updated slide
     */
    async updateSlide(slideId, updateData, updatedBy) {
        try {
            this._log('update_slide', { slideId, updatedBy });

            this._validateObjectId(slideId, 'Slide ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current slide
            const currentSlide = await this.slideRepository.findById(slideId);
            if (!currentSlide) {
                throw new Error('Slide not found');
            }

            // Validate slide type if being updated
            if (updateData.type) {
                const validTypes = ['intro', 'content', 'candidate', 'results', 'outro'];
                if (!validTypes.includes(updateData.type)) {
                    throw new Error('Invalid slide type');
                }
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            delete sanitizedData._id;
            delete sanitizedData.eventId;
            delete sanitizedData.createdAt;
            delete sanitizedData.createdBy;
            sanitizedData.updatedAt = new Date();

            if (!sanitizedData.isActive){
                sanitizedData.published = sanitizedData.isActive === true
            }

            // Update slide
            const updatedSlide = await this.slideRepository.updateById(slideId, sanitizedData);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'update',
                targetType: 'slide',
                targetId: slideId,
                metadata: {
                    slideTitle: updatedSlide.title,
                    updatedFields: Object.keys(sanitizedData),
                    eventId: updatedSlide.eventId
                }
            });

            // Invalidate caches
            CacheService.clearAll();

            this._log('update_slide_success', { slideId });

            return {
                success: true,
                slide: {
                    id: updatedSlide._id,
                    title: updatedSlide.title,
                    content: updatedSlide.content,
                    type: updatedSlide.type,
                    order: updatedSlide.order,
                    isActive: updatedSlide.isActive,
                    settings: updatedSlide.settings,
                    updatedAt: updatedSlide.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_slide', { slideId });
        }
    }

    /**
     * Delete a slide
     * @param {String} slideId - Slide ID
     * @param {String} deletedBy - ID of user deleting the slide
     * @returns {Promise<Object>} Deletion result
     */
    async deleteSlide(slideId, deletedBy) {
        try {
            this._log('delete_slide', { slideId, deletedBy });

            this._validateObjectId(slideId, 'Slide ID');
            this._validateObjectId(deletedBy, 'Deleted By User ID');

            // Get slide
            const slide = await this.slideRepository.findById(slideId);
            if (!slide) {
                throw new Error('Slide not found');
            }

            // Delete slide
            await this.slideRepository.deleteById(slideId);

            // Reorder remaining slides
            await this.reorderSlidesAfterDeletion(slide.eventId, slide.order);

            // Log activity
            await this.activityRepository.logActivity({
                user: deletedBy,
                action: 'slide_delete',
                targetType: 'slide',
                targetId: slideId,
                metadata: {
                    slideTitle: slide.title,
                    eventId: slide.eventId,
                    order: slide.order
                }
            });

            // Invalidate caches
            CacheService.delete(`slide:${slideId}`);
            CacheService.delete(`slides:event:${slide.eventId}`);

            this._log('delete_slide_success', { slideId });

            return {
                success: true,
                message: 'Slide deleted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'delete_slide', { slideId });
        }
    }

    /**
     * Get slide by ID
     * @param {String} slideId - Slide ID
     * @returns {Promise<Object>} Slide details
     */
    async getSlideById(slideId) {
        try {
            this._log('get_slide_by_id', { slideId });

            this._validateObjectId(slideId, 'Slide ID');

            // Check cache first
            const cacheKey = `slide:${slideId}`;
            let slide = CacheService.get(cacheKey);

            if (!slide) {
                slide = await this.slideRepository.findById(slideId);
                if (!slide) {
                    throw new Error('Slide not found');
                }

                // Cache the slide
                CacheService.set(cacheKey, slide, 1800000); // 30 minutes
            }

            return {
                success: true,
                slide: {
                    id: slide._id,
                    title: slide.title,
                    content: slide.content,
                    type: slide.type,
                    eventId: slide.eventId,
                    order: slide.order,
                    isActive: slide.isActive,
                    settings: slide.settings,
                    createdAt: slide.createdAt,
                    updatedAt: slide.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_slide_by_id', { slideId });
        }
    }

    /**
     * Get slides for an event
     * @param {String} eventId - Event ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Event slides
     */
    async getSlidesByEvent(eventId, query = {}) {
        try {
            this._log('get_slides_by_event', { eventId, query });

            this._validateObjectId(eventId, 'Event ID');

            // Check cache first
            const cacheKey = `slides:event:${eventId}`;
            let slides = CacheService.get(cacheKey);

            if (!slides) {
                const filter = { eventId };

                // Add active filter if specified
                if (query.isActive !== undefined) {
                    filter.isActive = query.isActive === 'true';
                }

                // Add type filter if specified
                if (query.type) {
                    filter.type = query.type;
                }

                slides = await this.slideRepository.find(filter, {
                    sort: { order: 1 }
                });

                // Cache the slides
                CacheService.set(cacheKey, slides, 1800000); // 30 minutes
            }

            // Format slides
            const formattedSlides = slides.map(slide => ({
                id: slide._id,
                title: slide.title,
                content: slide.content,
                type: slide.type,
                order: slide.order,
                isActive: slide.isActive,
                settings: slide.settings,
                createdAt: slide.createdAt,
                updatedAt: slide.updatedAt
            }));

            return {
                success: true,
                data: formattedSlides
            };
        } catch (error) {
            throw this._handleError(error, 'get_slides_by_event', { eventId });
        }
    }

    /**
     * Reorder slides for an event
     * @param {String} eventId - Event ID
     * @param {Array} slideOrder - Array of slide IDs in new order
     * @param {String} updatedBy - ID of user updating the order
     * @returns {Promise<Object>} Reorder result
     */
    async reorderSlides(eventId, slideOrder, updatedBy) {
        try {
            this._log('reorder_slides', { eventId, slideCount: slideOrder.length, updatedBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            if (!Array.isArray(slideOrder) || slideOrder.length === 0) {
                throw new Error('Slide order array is required');
            }

            // Validate all slide IDs
            for (const slideId of slideOrder) {
                this._validateObjectId(slideId, 'Slide ID');
            }

            // Get all slides for the event
            const eventSlides = await this.slideRepository.findByEvent(eventId);
            const eventSlideIds = eventSlides.map(slide => slide._id.toString());

            // Verify all provided slide IDs belong to the event
            for (const slideId of slideOrder) {
                if (!eventSlideIds.includes(slideId)) {
                    throw new Error(`Slide ${slideId} does not belong to event ${eventId}`);
                }
            }

            // Update slide orders
            const updatePromises = slideOrder.map((slideId, index) => {
                return this.slideRepository.updateById(slideId, {
                    order: index + 1,
                    updatedAt: new Date()
                });
            });

            await Promise.all(updatePromises);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'slides_reorder',
                targetType: 'event',
                targetId: eventId,
                metadata: {
                    slidesCount: slideOrder.length,
                    newOrder: slideOrder
                }
            });

            // Invalidate cache
            CacheService.delete(`slides:event:${eventId}`);

            this._log('reorder_slides_success', { eventId, slideCount: slideOrder.length });

            return {
                success: true,
                data: {
                    eventId,
                    slidesReordered: slideOrder.length,
                    newOrder: slideOrder
                },
                message: 'Slides reordered successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'reorder_slides', { eventId });
        }
    }

    /**
     * Duplicate a slide
     * @param {String} slideId - Slide ID to duplicate
     * @param {String} createdBy - ID of user creating the duplicate
     * @returns {Promise<Object>} Duplicated slide
     */
    async duplicateSlide(slideId, createdBy) {
        try {
            this._log('duplicate_slide', { slideId, createdBy });

            this._validateObjectId(slideId, 'Slide ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Get original slide
            const originalSlide = await this.slideRepository.findById(slideId);
            if (!originalSlide) {
                throw new Error('Slide not found');
            }

            // Get next order position
            const maxOrder = await this.slideRepository.getMaxOrderForEvent(originalSlide.eventId);
            const newOrder = (maxOrder || 0) + 1;

            // Create duplicate slide data
            const duplicateData = {
                title: `${originalSlide.title} (Copy)`,
                content: originalSlide.content,
                type: originalSlide.type,
                eventId: originalSlide.eventId,
                order: newOrder,
                isActive: originalSlide.isActive,
                settings: originalSlide.settings,
                createdBy,
                createdAt: new Date()
            };

            const duplicatedSlide = await this.slideRepository.create(duplicateData);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'slide_duplicate',
                targetType: 'slide',
                targetId: duplicatedSlide._id,
                metadata: {
                    originalSlideId: slideId,
                    originalTitle: originalSlide.title,
                    newTitle: duplicatedSlide.title,
                    eventId: duplicatedSlide.eventId
                }
            });

            // Invalidate cache
            CacheService.delete(`slides:event:${originalSlide.eventId}`);

            this._log('duplicate_slide_success', {
                originalId: slideId,
                duplicateId: duplicatedSlide._id
            });

            return {
                success: true,
                slide: {
                    id: duplicatedSlide._id,
                    title: duplicatedSlide.title,
                    content: duplicatedSlide.content,
                    type: duplicatedSlide.type,
                    eventId: duplicatedSlide.eventId,
                    order: duplicatedSlide.order,
                    isActive: duplicatedSlide.isActive,
                    settings: duplicatedSlide.settings,
                    createdAt: duplicatedSlide.createdAt
                },
                message: 'Slide duplicated successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'duplicate_slide', { slideId });
        }
    }

    /**
     * Toggle slide active status
     * @param {String} slideId - Slide ID
     * @param {String} updatedBy - ID of user updating the status
     * @returns {Promise<Object>} Toggle result
     */
    async toggleSlideStatus(slideId, updatedBy) {
        try {
            this._log('toggle_slide_status', { slideId, updatedBy });

            this._validateObjectId(slideId, 'Slide ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current slide
            const slide = await this.slideRepository.findById(slideId);
            if (!slide) {
                throw new Error('Slide not found');
            }

            // Toggle status
            const newStatus = !slide.isActive;
            const updatedSlide = await this.slideRepository.updateById(slideId, {
                isActive: newStatus,
                updatedAt: new Date()
            });

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'slide_status_toggle',
                targetType: 'slide',
                targetId: slideId,
                metadata: {
                    slideTitle: slide.title,
                    oldStatus: slide.isActive,
                    newStatus: newStatus,
                    eventId: slide.eventId
                }
            });

            // Invalidate caches
            CacheService.delete(`slide:${slideId}`);
            CacheService.delete(`slides:event:${slide.eventId}`);

            this._log('toggle_slide_status_success', { slideId, newStatus });

            return {
                success: true,
                slide: {
                    id: updatedSlide._id,
                    title: updatedSlide.title,
                    isActive: updatedSlide.isActive,
                    updatedAt: updatedSlide.updatedAt
                },
                message: `Slide ${newStatus ? 'activated' : 'deactivated'} successfully`
            };
        } catch (error) {
            throw this._handleError(error, 'toggle_slide_status', { slideId });
        }
    }

    /**
     * Get slide presentation for an event
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>} Presentation data
     */
    async getEventPresentation(eventId) {
        try {
            this._log('get_event_presentation', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            // Get event details
            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get active slides in order
            const slides = await this.slideRepository.find(
                { eventId, isActive: true },
                { sort: { order: 1 } }
            );

            // Format presentation data
            const presentation = {
                event: {
                    id: event._id,
                    name: event.name,
                    description: event.description,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    status: event.status
                },
                slides: slides.map((slide, index) => ({
                    id: slide._id,
                    title: slide.title,
                    content: slide.content,
                    type: slide.type,
                    order: slide.order,
                    slideNumber: index + 1,
                    settings: slide.settings
                })),
                totalSlides: slides.length
            };

            return {
                success: true,
                data: presentation
            };
        } catch (error) {
            throw this._handleError(error, 'get_event_presentation', { eventId });
        }
    }

    /**
     * Create a slide for events with gallery
     * @param {String} eventId - Event ID
     * @param {String} createdBy - ID of user creating the slide
     * @returns {Promise<Object>} Created slide
     */
    async createGallerySlideFromEvent(eventId, createdBy) {
        try {
            this._log('create_gallery_slide_from_event', { eventId, createdBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Get event details
            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Check if event has gallery
            if (!event.gallery || !Array.isArray(event.gallery) || event.gallery.length === 0) {
                throw new Error('Event does not have a gallery');
            }

            // Prepare slide data
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            const eventUrl = `${frontendUrl}/events/${event._id}`;
            const subtitle = event.description ? event.description.slice(0, 100) : '';

            const slideData = {
                title: event.name,
                content: {
                    subtitle,
                    gallery: event.gallery,
                    button: {
                        label: 'View',
                        url: eventUrl
                    }
                },
                type: 'gallery',
                eventId: event._id,
                isActive: true,
                settings: {}
            };

            // Create slide
            return await this.createSlide(slideData, createdBy);
        } catch (error) {
            throw this._handleError(error, 'create_gallery_slide_from_event', { eventId });
        }
    }

    /**
     * Get all slides
     */
    async getSlides(query) {
        if (!query){
            query = {}
        }
        try {
            this._log('get_slides', {});
            const slides = await this.slideRepository.find(query,{sort: {order: -1}})
            // Format slides
            const formattedSlides = slides.map(slide => ({
                id: slide._id,
                title: slide.title,
                subtitle: slide.subtitle,
                image: slide.image,
                order: slide.order,
                button: slide.button,
                isActive: slide.isActive,
                published: slide.published,
                settings: slide.settings,
                createdAt: slide.createdAt,
                updatedAt: slide.updatedAt
            }));
            return {
                success: true,
                data: formattedSlides
            };
        } catch (error) {
            throw this._handleError(error, 'get_slides', {});
        }
    }

    /**
     * Get all published slides
     * @returns {Promise<Object>} Published slides
     */
    async getPublishedSlides(query) {
        try {
            this._log('get_published_slides', {});

            // Find slides where isActive is true and published is true
            const slides = await this.slideRepository.find(
                { ...query, isActive: true, published: true },
                { sort: { createdAt: -1 } }
            );

            // Format slides
            const formattedSlides = slides.map(slide => ({
                id: slide._id,
                title: slide.title,
                subtitle: slide.subtitle,
                image: slide.image,
                order: slide.order,
                button: slide.button,
                isActive: slide.isActive,
                published: slide.published,
                settings: slide.settings,
                createdAt: slide.createdAt,
                updatedAt: slide.updatedAt
            }));

            return {
                success: true,
                data: formattedSlides
            };
        } catch (error) {
            throw this._handleError(error, 'get_published_slides', {});
        }
    }

    /**
     * Reorder slides after deletion (helper method)
     * @param {String} eventId - Event ID
     * @param {Number} deletedOrder - Order of deleted slide
     * @returns {Promise<void>}
     */
    async reorderSlidesAfterDeletion(eventId, deletedOrder) {
        try {
            // Get all slides with order greater than deleted slide
            const slidesToReorder = await this.slideRepository.find(
                { eventId, order: { $gt: deletedOrder } },
                { sort: { order: 1 } }
            );

            // Update their order positions
            const updatePromises = slidesToReorder.map(slide => {
                return this.slideRepository.updateById(slide._id, {
                    order: slide.order - 1,
                    updatedAt: new Date()
                });
            });

            await Promise.all(updatePromises);
        } catch (error) {
            console.error('Error reordering slides after deletion:', error.message);
        }
    }
}

export default SlideService;
