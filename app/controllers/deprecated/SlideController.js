#!/usr/bin/env node
/**
 * Slide Controller
 * 
 * Handles slide management operations for presentations and events.
 *
 * @swagger
 * tags:
 *   name: Slides
 *   description: Manages slides for event presentations
 */

import BaseController from './BaseController.js';
import SlideService from '../services/SlideService.js';

export default class SlideController extends BaseController {
    constructor() {
        super();
        this.slideService = new SlideService();
    }

    /**
     * Create a new slide
     */
    async createSlide(req, res) {
        try {
            const slideData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const slide = await this.slideService.createSlide(
                slideData,
                createdBy
            );

            return this.sendSuccess(res, slide, 'Slide created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create slide');
        }
    }

    /**
     * Get all slides with filtering and pagination
     */
    async getPublishedSlides(req, res) {
        try {
            const query = req.query;
            const slides = await this.slideService.getPublishedSlides(query);
            return this.sendSuccess(res, slides, 'Slides retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get slides');
        }
    }

    /**
     * Get all slides with filtering and pagination
     * 
     */
    async getSlides(req, res) {
        try {
            const query = req.query
            const slides = await this.slideService.getSlides(query)
            return this.sendSuccess(res, slides, 'Slides retrieved successfully')
        }catch(error){
            return this.handleError(res, error, 'Failed to get slides')
        }
      
    }

    /**
     * Get slide by ID
     */
    async getSlideById(req, res) {
        try {
            const { id } = req.params;

            const slide = await this.slideService.getSlideById(id);

            if (!slide) {
                return this.sendError(res, 'Slide not found', 404);
            }

            return this.sendSuccess(res, slide, 'Slide retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get slide');
        }
    }

    /**
     * Update slide
     */
    async updateSlide(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            const slide = await this.slideService.updateSlide(id,
                updateData,
                updatedBy
            );

            if (!slide) {
                return this.sendError(res, 'Slide not found', 404);
            }

            if (slide.isActive === false && updateData.published === true){
                return this.sendError(res, 'Cannot publish inactive slide')

            }

            return this.sendSuccess(res, slide, 'Slide updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update slide');
        }
    }

    /**
     * Delete slide
     */
    async deleteSlide(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            const result = await this.slideService.deleteSlide(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'Slide not found', 404);
            }

            return this.sendSuccess(res, null, 'Slide deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete slide');
        }
    }

    /**
     * Get slides by event
     */
    async getSlidesByEvent(req, res) {
        try {
            const { eventId } = req.params;
            const query = req.query;

            const slides = await this.slideService.getSlidesByEvent(eventId, query);
            return this.sendSuccess(res, slides, 'Event slides retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event slides');
        }
    }

    /**
     * Reorder slides
     */
    async reorderSlides(req, res) {
        try {
            const { slideIds } = req.body;
            const updatedBy = req.user?.id;

            if (!slideIds || !Array.isArray(slideIds)) {
                return this.sendError(res, 'Slide IDs array is required', 400);
            }

            const result = await this.slideService.reorderSlides(slideIds, updatedBy);
            return this.sendSuccess(res, result, 'Slides reordered successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to reorder slides');
        }
    }

    /**
     * Upload slide image/media
     */
    async uploadSlideMedia(req, res) {
        try {
            const { id } = req.params;
            const file = req.file;

            if (!file) {
                return this.sendError(res, 'Media file is required', 400);
            }

            const mediaUrl = await this.slideService.uploadSlideMedia(id, file);

            if (!mediaUrl) {
                return this.sendError(res, 'Slide not found', 404);
            }

            return this.sendSuccess(res, { mediaUrl }, 'Slide media uploaded successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to upload slide media');
        }
    }

    /**
     * Update slide status
     */
    async updateSlideStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedBy = req.user?.id;

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const slide = await this.slideService.updateSlideStatus(id, status, updatedBy);

            if (!slide) {
                return this.sendError(res, 'Slide not found', 404);
            }

            return this.sendSuccess(res, slide, 'Slide status updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update slide status');
        }
    }

    /**
     * Duplicate slide
     */
    async duplicateSlide(req, res) {
        try {
            const { id } = req.params;
            const duplicatedBy = req.user?.id;

            const duplicatedSlide = await this.slideService.duplicateSlide(id, duplicatedBy);

            if (!duplicatedSlide) {
                return this.sendError(res, 'Slide not found', 404);
            }

            return this.sendSuccess(res, duplicatedSlide, 'Slide duplicated successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to duplicate slide');
        }
    }

    /**
     * Get slide preview
     */
    async getSlidePreview(req, res) {
        try {
            const { id } = req.params;

            const preview = await this.slideService.getSlidePreview(id);

            if (!preview) {
                return this.sendError(res, 'Slide not found', 404);
            }

            return this.sendSuccess(res, preview, 'Slide preview generated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get slide preview');
        }
    }
}
