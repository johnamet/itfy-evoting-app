/**
 * SlideController
 * 
 * Handles HTTP requests for slide/carousel management
 * 
 * @extends BaseController
 * @module controllers/SlideController
 */

import BaseController from './BaseController.js';
import { slideService } from '../services/index.js';

class SlideController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Create new slide
     * POST /api/v1/slides
     * Access: Event Manager (Level 3+)
     */
    createSlide = this.asyncHandler(async (req, res) => {
        const slideData = this.getRequestBody(req);
        const metadata = this.getRequestMetadata(req);

        // Validate required fields
        const missing = this.validateRequiredFields(slideData, ['title', 'image']);
        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate event ID if provided
        if (slideData.event && !this.validateMongoId(slideData.event)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        const result = await slideService.createSlide(slideData);

        this.sendCreated(res, result.data, result.message);
    });

    /**
     * Get all slides with filters
     * GET /api/v1/slides
     * Access: Public (optionally filtered by status)
     */
    getAllSlides = this.asyncHandler(async (req, res) => {
        const { event, status, global, page, limit, sort } = this.getQueryParams(req);

        const filters = {};
        if (event) filters.event = event;
        if (status) filters.status = status;
        if (global === 'true') filters.global = true;

        const options = {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 10,
            sort
        };

        const result = await slideService.getAllSlides(filters, options);

        if (result.data.pagination) {
            this.sendPaginatedResponse(res, result.data.docs, result.data.pagination);
        } else {
            this.sendSuccess(res, result.data);
        }
    });

    /**
     * Get active slides
     * GET /api/v1/slides/active
     * Access: Public
     */
    getActiveSlides = this.asyncHandler(async (req, res) => {
        const { event } = this.getQueryParams(req);

        const result = await slideService.getActiveSlides(event || null);

        this.sendSuccess(res, result.data);
    });

    /**
     * Get slide by ID
     * GET /api/v1/slides/:id
     * Access: Public
     */
    getSlideById = this.asyncHandler(async (req, res) => {
        const { id } = this.getParams(req);

        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid slide ID format');
        }

        const result = await slideService.getSlideById(id);

        this.sendSuccess(res, result.data);
    });

    /**
     * Get slides by event
     * GET /api/v1/slides/event/:eventId
     * Access: Public
     */
    getSlidesByEvent = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getParams(req);
        const { activeOnly } = this.getQueryParams(req);

        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        const result = await slideService.getSlidesByEvent(eventId, activeOnly === 'true');

        this.sendSuccess(res, result.data);
    });

    /**
     * Update slide
     * PUT /api/v1/slides/:id
     * Access: Event Manager (Level 3+)
     */
    updateSlide = this.asyncHandler(async (req, res) => {
        const { id } = this.getParams(req);
        const updateData = this.getRequestBody(req);

        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid slide ID format');
        }

        // Validate event ID if provided
        if (updateData.event && !this.validateMongoId(updateData.event)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        const result = await slideService.updateSlide(id, updateData);

        this.sendSuccess(res, result.data, result.message);
    });

    /**
     * Reorder slides
     * PUT /api/v1/slides/reorder
     * Access: Event Manager (Level 3+)
     */
    reorderSlides = this.asyncHandler(async (req, res) => {
        const { orderUpdates } = this.getRequestBody(req);

        if (!Array.isArray(orderUpdates) || orderUpdates.length === 0) {
            return this.sendBadRequest(res, 'orderUpdates array is required');
        }

        // Validate structure
        for (const update of orderUpdates) {
            if (!update.slideId || !this.validateMongoId(update.slideId)) {
                return this.sendBadRequest(res, 'Invalid slide ID in orderUpdates');
            }
            if (typeof update.order !== 'number') {
                return this.sendBadRequest(res, 'order must be a number');
            }
        }

        const result = await slideService.reorderSlides(orderUpdates);

        this.sendSuccess(res, result.data, result.message);
    });

    /**
     * Update slide status
     * PUT /api/v1/slides/:id/status
     * Access: Event Manager (Level 3+)
     */
    updateSlideStatus = this.asyncHandler(async (req, res) => {
        const { id } = this.getParams(req);
        const { status } = this.getRequestBody(req);

        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid slide ID format');
        }

        if (!status || !['active', 'inactive'].includes(status)) {
            return this.sendBadRequest(res, 'status must be active or inactive');
        }

        const result = await slideService.updateSlideStatus(id, status);

        this.sendSuccess(res, result.data, result.message);
    });

    /**
     * Clone slide
     * POST /api/v1/slides/:id/clone
     * Access: Event Manager (Level 3+)
     */
    cloneSlide = this.asyncHandler(async (req, res) => {
        const { id } = this.getParams(req);
        const { targetEventId } = this.getRequestBody(req);

        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid slide ID format');
        }

        if (targetEventId && !this.validateMongoId(targetEventId)) {
            return this.sendBadRequest(res, 'Invalid target event ID format');
        }

        const result = await slideService.cloneSlide(id, targetEventId || null);

        this.sendCreated(res, result.data, result.message);
    });

    /**
     * Get slide statistics
     * GET /api/v1/slides/statistics
     * Access: Event Manager (Level 3+)
     */
    getSlideStatistics = this.asyncHandler(async (req, res) => {
        const { event } = this.getQueryParams(req);

        if (event && !this.validateMongoId(event)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        const result = await slideService.getSlideStatistics(event || null);

        this.sendSuccess(res, result.data);
    });

    /**
     * Bulk update slide status
     * PUT /api/v1/slides/bulk/status
     * Access: Event Manager (Level 3+)
     */
    bulkUpdateStatus = this.asyncHandler(async (req, res) => {
        const { slideIds, status } = this.getRequestBody(req);

        if (!Array.isArray(slideIds) || slideIds.length === 0) {
            return this.sendBadRequest(res, 'slideIds array is required');
        }

        if (!status || !['active', 'inactive'].includes(status)) {
            return this.sendBadRequest(res, 'status must be active or inactive');
        }

        // Validate all slide IDs
        for (const id of slideIds) {
            if (!this.validateMongoId(id)) {
                return this.sendBadRequest(res, `Invalid slide ID: ${id}`);
            }
        }

        const result = await slideService.bulkUpdateStatus(slideIds, status);

        this.sendSuccess(res, result.data, result.message);
    });

    /**
     * Delete slide
     * DELETE /api/v1/slides/:id
     * Access: Event Manager (Level 3+)
     */
    deleteSlide = this.asyncHandler(async (req, res) => {
        const { id } = this.getParams(req);

        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid slide ID format');
        }

        const result = await slideService.deleteSlide(id);

        this.sendSuccess(res, result.data, result.message);
    });

    /**
     * Delete all slides for an event
     * DELETE /api/v1/slides/event/:eventId
     * Access: Super Admin (Level 4+)
     */
    deleteEventSlides = this.asyncHandler(async (req, res) => {
        const { eventId } = this.getParams(req);

        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        const result = await slideService.deleteEventSlides(eventId);

        this.sendSuccess(res, result.data, result.message);
    });
}

export default SlideController;
