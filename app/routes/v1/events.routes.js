#!/usr/bin/env node
/**
 * Event Routes
 * 
 * @module routes/v1/events
 */

import express from 'express';
import EventController from '../../controllers/EventController.js';
import { optionalAuth, authenticate, requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const eventController = new EventController();

/**
 * @route GET /api/v1/events
 * @desc Get all events (public + filtered by status)
 * @access Public
 */
router.get('/', optionalAuth, (req, res) => eventController.getAllEvents(req, res));

/**
 * @route GET /api/v1/events/active
 * @desc Get active events
 * @access Public
 */
router.get('/active', (req, res) => eventController.getActiveEvents(req, res));

/**
 * @route GET /api/v1/events/:id
 * @desc Get event by ID
 * @access Public
 */
router.get('/:id', optionalAuth, (req, res) => eventController.getEventById(req, res));

/**
 * @route POST /api/v1/events
 * @desc Create new event
 * @access Private (Event Manager - Level 3+)
 */
router.post('/', requireLevel(3), (req, res) => eventController.createEvent(req, res));

/**
 * @route PUT /api/v1/events/:id
 * @desc Update event
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id', requireLevel(3), (req, res) => eventController.updateEvent(req, res));

/**
 * @route DELETE /api/v1/events/:id
 * @desc Delete event
 * @access Private (Admin - Level 4+)
 */
router.delete('/:id', requireLevel(4), (req, res) => eventController.deleteEvent(req, res));

/**
 * @route GET /api/v1/events/:id/categories
 * @desc Get event categories
 * @access Public
 */
router.get('/:id/categories', (req, res) => eventController.getEventCategories(req, res));

/**
 * @route POST /api/v1/events/:id/categories
 * @desc Create category for event
 * @access Private (Event Manager - Level 3+)
 */
router.post('/:id/categories', requireLevel(3), (req, res) => eventController.createCategory(req, res));

/**
 * @route PUT /api/v1/events/:eventId/categories/:categoryId
 * @desc Update event category
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:eventId/categories/:categoryId', requireLevel(3), (req, res) => eventController.updateCategory(req, res));

/**
 * @route DELETE /api/v1/events/:eventId/categories/:categoryId
 * @desc Delete event category
 * @access Private (Event Manager - Level 3+)
 */
router.delete('/:eventId/categories/:categoryId', requireLevel(3), (req, res) => eventController.deleteCategory(req, res));

/**
 * @route GET /api/v1/events/:id/results
 * @desc Get event voting results
 * @access Public
 */
router.get('/:id/results', (req, res) => eventController.getEventResults(req, res));

/**
 * @route PUT /api/v1/events/:id/status
 * @desc Update event status
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/status', requireLevel(3), (req, res) => eventController.updateEventStatus(req, res));

/**
 * @route GET /api/v1/events/:id/statistics
 * @desc Get event statistics
 * @access Private (Event Manager - Level 3+)
 */
router.get('/:id/statistics', requireLevel(3), (req, res) => eventController.getEventStatistics(req, res));

export default router;
