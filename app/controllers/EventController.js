#!/usr/bin/env node
/**
 * Event Controller
 * 
 * Handles event management operations.
 */

import BaseController from './BaseController.js';
import EventService from '../services/EventService.js';

export default class EventController extends BaseController {
    constructor() {
        super();
        this.eventService = new EventService();
    }

    /**
     * Create a new event
     * 
     * @swagger
     * /events:
     *   post:
     *     summary: Create a new event
     *     description: Creates a new voting event in the system
     *     tags: [Events]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - title
     *               - description
     *               - startDate
     *               - endDate
     *             properties:
     *               title:
     *                 type: string
     *                 example: "Student Union Elections 2025"
     *               description:
     *                 type: string
     *                 example: "Annual student union elections for academic year 2025"
     *               startDate:
     *                 type: string
     *                 format: date-time
     *                 example: "2025-09-01T09:00:00.000Z"
     *               endDate:
     *                 type: string
     *                 format: date-time
     *                 example: "2025-09-03T18:00:00.000Z"
     *               votingFee:
     *                 type: number
     *                 example: 500
     *               status:
     *                 type: string
     *                 enum: [draft, active, completed, cancelled]
     *                 default: draft
     *               isPublic:
     *                 type: boolean
     *                 default: true
     *     responses:
     *       201:
     *         description: Event created successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/Event'
     *       400:
     *         description: Bad request - Missing required fields
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async createEvent(req, res) {
        try {
            const eventData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const event = await this.eventService.createEvent({
                ...eventData,
                createdBy
            });

            return this.sendSuccess(res, event, 'Event created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create event');
        }
    }

    /**
     * Get all events with filtering and pagination
     * 
     * @swagger
     * /events:
     *   get:
     *     summary: Get all events
     *     description: Retrieves a list of events with optional filtering and pagination
     *     tags: [Events]
     *     security: []
     *     parameters:
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           minimum: 1
     *           default: 1
     *         description: Page number for pagination
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           minimum: 1
     *           maximum: 100
     *           default: 20
     *         description: Number of items per page
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [draft, active, completed, cancelled]
     *         description: Filter by event status
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Search events by title or description
     *       - in: query
     *         name: startDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter events starting from this date
     *       - in: query
     *         name: endDate
     *         schema:
     *           type: string
     *           format: date
     *         description: Filter events ending before this date
     *       - in: query
     *         name: include
     *         schema:
     *           type: string
     *           enum: [details, categories, candidates]
     *         description: Include additional details in response
     *     responses:
     *       200:
     *         description: Events retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         events:
     *                           type: array
     *                           items:
     *                             $ref: '#/components/schemas/Event'
     *                         pagination:
     *                           $ref: '#/components/schemas/PaginationInfo'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getEvents(req, res) {
        try {
            const query = req.query;
            const events = await this.eventService.getEvents(query);
            return this.sendSuccess(res, events, 'Events retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get events');
        }
    }

    /**
     * Get event by ID
     */
    async getEventById(req, res) {
        try {
            const { id } = req.params;
            const includeDetails = req.query.include === 'details';

            const event = await this.eventService.getEventById(id, includeDetails);

            if (!event) {
                return this.sendError(res, 'Event not found', 404);
            }

            return this.sendSuccess(res, event, 'Event retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event');
        }
    }

    /**
     * Update event
     */
    async updateEvent(req, res) {
        console.log("Update Event req", req)
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user.id
            const event = await this.eventService.updateEvent(id,
                updateData,
                updatedBy
            );

            if (!event) {
                return this.sendError(res, 'Event not found', 404);
            }

            return this.sendSuccess(res, event, 'Event updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update event');
        }
    }

    /**
     * Delete event
     */
    async deleteEvent(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            const result = await this.eventService.deleteEvent(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'Event not found', 404);
            }

            return this.sendSuccess(res, null, 'Event deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete event');
        }
    }

    /**
     * Get event statistics
     */
    async getEventStats(req, res) {
        try {
            const { id } = req.params;
            const stats = await this.eventService.getEventStats(id);

            if (!stats) {
                return this.sendError(res, 'Event not found', 404);
            }

            return this.sendSuccess(res, stats, 'Event statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event statistics');
        }
    }

    /**
     * Get event participants
     */
    async getEventParticipants(req, res) {
        try {
            const { id } = req.params;
            const query = req.query;

            const participants = await this.eventService.getEventParticipants(id, query);
            return this.sendSuccess(res, participants, 'Event participants retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get event participants');
        }
    }

    /**
     * Register for event
     */
    async registerForEvent(req, res) {
        try {
            const { id } = req.params;
            const registrationData = req.body;

            const registration = await this.eventService.registerForEvent(id, registrationData);
            return this.sendSuccess(res, registration, 'Successfully registered for event', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to register for event');
        }
    }

    /**
     * Unregister from event
     */
    async unregisterFromEvent(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return this.sendError(res, 'User authentication required', 401);
            }

            await this.eventService.unregisterFromEvent(id, userId);
            return this.sendSuccess(res, null, 'Successfully unregistered from event');
        } catch (error) {
            return this.handleError(res, error, 'Failed to unregister from event');
        }
    }

    /**
     * Update event status
     */
    async updateEventStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedBy = req.user?.id;

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const event = await this.eventService.updateEventStatus(id, status, updatedBy);

            if (!event) {
                return this.sendError(res, 'Event not found', 404);
            }

            return this.sendSuccess(res, event, 'Event status updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update event status');
        }
    }

    /**
     * Get upcoming events
     */
    async getUpcomingEvents(req, res) {
        try {
            const query = req.query;
            query.type = 'upcoming';
            const events = await this.eventService.getEvents(query);
            return this.sendSuccess(res, events, 'Upcoming events retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get upcoming events');
        }
    }

    /**
     * Get past events
     */
    async getPastEvents(req, res) {
        try {
            const query = req.query;
            const events = await this.eventService.getPastEvents(query);
            return this.sendSuccess(res, events, 'Past events retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get past events');
        }
    }
}
