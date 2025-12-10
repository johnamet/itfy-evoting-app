/**
 * EventController
 * 
 * Handles event management operations:
 * - CRUD operations
 * - Event status transitions (draft → active → closed)
 * - Event results and analytics
 * - Event search and filtering
 * - Event statistics
 * 
 * @module controllers/EventController
 */

import BaseController from './BaseController.js';
import { eventService } from '../services/index.js';

class EventController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get all events (paginated with filters)
     * GET /api/v1/events
     * Access: Public
     */
    getAllEvents = this.asyncHandler(async (req, res) => {
        const pagination = this.getPagination(req);
        const sortOptions = this.getSortOptions(req, { createdAt: -1 });
        const filters = this.getFilterOptions(req, [
            'status', 'category', 'isPublic', 'featured', 'createdBy'
        ]);

        try {
            const result = await eventService.getAllEvents({
                ...pagination,
                sort: sortOptions,
                filters
            });

            return this.sendPaginatedResponse(
                res,
                result.events,
                { total: result.total, ...pagination },
                'Events retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get event by ID
     * GET /api/v1/events/:id
     * Access: Public
     */
    getEventById = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(id);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            return this.sendSuccess(res, event, 'Event retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Create new event
     * POST /api/v1/events
     * Access: Level 2+ (organizers)
     */
    createEvent = this.asyncHandler(async (req, res) => {
        const eventData = this.getRequestBody(req);
        const createdBy = this.getUserId(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            eventData,
            ['title', 'startDate', 'endDate', 'category']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate date range
        if (!this.validateDateRange(eventData.startDate, eventData.endDate)) {
            return this.sendBadRequest(res, 'Invalid date range - start date must be before end date');
        }

        // Ensure start date is in the future
        const startDate = new Date(eventData.startDate);
        if (startDate < new Date()) {
            return this.sendBadRequest(res, 'Start date must be in the future');
        }

        try {
            const event = await eventService.createEvent({
                ...eventData,
                createdBy
            });

            return this.sendCreated(res, event, 'Event created successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Update event
     * PUT /api/v1/events/:id
     * Access: Event owner or Admin
     */
    updateEvent = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const updates = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        // Get event to check ownership
        try {
            const existingEvent = await eventService.getEventById(id);
            
            if (!existingEvent) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, existingEvent.createdBy)) {
                return this.sendForbidden(res, 'You can only update your own events');
            }

            // Prevent updates to active/closed events
            if (existingEvent.status !== 'draft') {
                return this.sendBadRequest(res, 'Cannot update event that is active or closed');
            }

            // Validate date range if provided
            const startDate = updates.startDate || existingEvent.startDate;
            const endDate = updates.endDate || existingEvent.endDate;
            
            if (!this.validateDateRange(startDate, endDate)) {
                return this.sendBadRequest(res, 'Invalid date range - start date must be before end date');
            }

            const event = await eventService.updateEvent(id, updates);
            return this.sendSuccess(res, event, 'Event updated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Delete event
     * DELETE /api/v1/events/:id
     * Access: Event owner or Admin
     */
    deleteEvent = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(id);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'You can only delete your own events');
            }

            // Prevent deletion of active events
            if (event.status === 'active') {
                return this.sendBadRequest(res, 'Cannot delete active event. Close it first.');
            }

            await eventService.deleteEvent(id);
            return this.sendNoContent(res);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Activate event
     * POST /api/v1/events/:id/activate
     * Access: Event owner or Admin
     */
    activateEvent = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(id);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'You can only activate your own events');
            }

            // Validate event can be activated
            if (event.status === 'active') {
                return this.sendBadRequest(res, 'Event is already active');
            }

            if (event.status === 'closed') {
                return this.sendBadRequest(res, 'Cannot activate closed event');
            }

            const activatedEvent = await eventService.activateEvent(id);
            return this.sendSuccess(res, activatedEvent, 'Event activated successfully');
        } catch (error) {
            if (error.message.includes('minimum')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Close event
     * POST /api/v1/events/:id/close
     * Access: Event owner or Admin
     */
    closeEvent = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(id);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'You can only close your own events');
            }

            // Validate event can be closed
            if (event.status !== 'active') {
                return this.sendBadRequest(res, 'Only active events can be closed');
            }

            const closedEvent = await eventService.closeEvent(id);
            return this.sendSuccess(res, closedEvent, 'Event closed successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get event results
     * GET /api/v1/events/:id/results
     * Access: Public (for closed events)
     */
    getEventResults = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(id);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Only show results for closed events (unless admin/owner)
            const canViewResults = event.status === 'closed' || 
                                   this.canModifyResource(req, event.createdBy);

            if (!canViewResults) {
                return this.sendForbidden(res, 'Results are only available for closed events');
            }

            const results = await eventService.getEventResults(id);
            return this.sendSuccess(res, results, 'Event results retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get event statistics
     * GET /api/v1/events/:id/statistics
     * Access: Event owner or Admin
     */
    getEventStatistics = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const event = await eventService.getEventById(id);
            
            if (!event) {
                return this.sendNotFound(res, 'Event not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, event.createdBy)) {
                return this.sendForbidden(res, 'You can only view statistics for your own events');
            }

            const stats = await eventService.getEventStatistics(id);
            return this.sendSuccess(res, stats, 'Event statistics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Search events
     * GET /api/v1/events/search
     * Access: Public
     */
    searchEvents = this.asyncHandler(async (req, res) => {
        const { q } = this.getRequestQuery(req);
        const pagination = this.getPagination(req);

        if (!q || q.trim().length === 0) {
            return this.sendBadRequest(res, 'Search query is required');
        }

        try {
            const result = await eventService.searchEvents(q, pagination);

            return this.sendPaginatedResponse(
                res,
                result.events,
                { total: result.total, ...pagination },
                'Search results retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get featured events
     * GET /api/v1/events/featured
     * Access: Public
     */
    getFeaturedEvents = this.asyncHandler(async (req, res) => {
        const { limit = 10 } = this.getRequestQuery(req);

        try {
            const events = await eventService.getFeaturedEvents(parseInt(limit));
            return this.sendSuccess(res, events, 'Featured events retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get upcoming events
     * GET /api/v1/events/upcoming
     * Access: Public
     */
    getUpcomingEvents = this.asyncHandler(async (req, res) => {
        const pagination = this.getPagination(req, { limit: 20 });

        try {
            const result = await eventService.getUpcomingEvents(pagination);

            return this.sendPaginatedResponse(
                res,
                result.events,
                { total: result.total, ...pagination },
                'Upcoming events retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default EventController;
