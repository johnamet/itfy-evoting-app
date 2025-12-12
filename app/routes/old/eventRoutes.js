#!/usr/bin/env node
/**
 * Event Routes
 * 
 * Defines API endpoints for event management operations.
 */

import express from 'express';
import EventController from '../controllers/EventController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete, 
    authenticate,
    requireLevel
} from '../middleware/auth.js';

const router = express.Router();
const eventController = new EventController();

router.get('/', optionalAuth, (req, res) => eventController.getEvents(req, res));
router.get('/upcoming', optionalAuth, (req, res) => eventController.getUpcomingEvents(req, res));
router.get('/past', optionalAuth, (req, res) => eventController.getPastEvents(req, res));
router.get('/:id', optionalAuth, (req, res) => eventController.getEventById(req, res));

router.use(authenticate); // All routes require authentication by default

// Event CRUD operations
router.post('/', requireLevel(3), (req, res) => eventController.createEvent(req, res));
router.post('/:id/register', (req, res) => eventController.registerForEvent(req, res)); // Users can register themselves
router.delete('/:id/register', (req, res) => eventController.unregisterFromEvent(req, res)); // Users can unregister themselves
router.put('/:id', authenticate, (req, res) => eventController.updateEvent(req, res));
router.delete('/:id', (req, res) => eventController.deleteEvent(req, res));

// Event operations
router.get('/:id/stats', (req, res) => eventController.getEventStats(req, res));
router.get('/:id/participants', (req, res) => eventController.getEventParticipants(req, res));
router.patch('/:id/status', (req, res) => eventController.updateEventStatus(req, res));

export default router;
