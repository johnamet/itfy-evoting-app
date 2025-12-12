#!/usr/bin/env node
/**
 * Slide Routes
 * 
 * @module routes/v1/slides
 */

import express from 'express';
import SlideController from '../../controllers/SlideController.js';
import { optionalAuth, requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const slideController = new SlideController();

// ===== Public Routes =====

/**
 * @route GET /api/v1/slides/active
 * @desc Get active slides (global or by event)
 * @access Public
 */
router.get('/active', (req, res) => slideController.getActiveSlides(req, res));

/**
 * @route GET /api/v1/slides/event/:eventId
 * @desc Get slides for specific event
 * @access Public
 */
router.get('/event/:eventId', (req, res) => slideController.getSlidesByEvent(req, res));

/**
 * @route GET /api/v1/slides/:id
 * @desc Get slide by ID
 * @access Public
 */
router.get('/:id', (req, res) => slideController.getSlideById(req, res));

/**
 * @route GET /api/v1/slides
 * @desc Get all slides with filters
 * @access Public
 */
router.get('/', (req, res) => slideController.getAllSlides(req, res));

// ===== Admin Routes =====

/**
 * @route GET /api/v1/slides/admin/statistics
 * @desc Get slide statistics
 * @access Private (Event Manager - Level 3+)
 */
router.get('/admin/statistics', requireLevel(3), (req, res) => slideController.getSlideStatistics(req, res));

/**
 * @route POST /api/v1/slides
 * @desc Create new slide
 * @access Private (Event Manager - Level 3+)
 */
router.post('/', requireLevel(3), (req, res) => slideController.createSlide(req, res));

/**
 * @route PUT /api/v1/slides/reorder
 * @desc Reorder slides
 * @access Private (Event Manager - Level 3+)
 */
router.put('/reorder', requireLevel(3), (req, res) => slideController.reorderSlides(req, res));

/**
 * @route PUT /api/v1/slides/bulk/status
 * @desc Bulk update slide status
 * @access Private (Event Manager - Level 3+)
 */
router.put('/bulk/status', requireLevel(3), (req, res) => slideController.bulkUpdateStatus(req, res));

/**
 * @route PUT /api/v1/slides/:id
 * @desc Update slide
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id', requireLevel(3), (req, res) => slideController.updateSlide(req, res));

/**
 * @route PUT /api/v1/slides/:id/status
 * @desc Update slide status
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/status', requireLevel(3), (req, res) => slideController.updateSlideStatus(req, res));

/**
 * @route POST /api/v1/slides/:id/clone
 * @desc Clone slide to another event
 * @access Private (Event Manager - Level 3+)
 */
router.post('/:id/clone', requireLevel(3), (req, res) => slideController.cloneSlide(req, res));

/**
 * @route DELETE /api/v1/slides/:id
 * @desc Delete slide
 * @access Private (Event Manager - Level 3+)
 */
router.delete('/:id', requireLevel(3), (req, res) => slideController.deleteSlide(req, res));

/**
 * @route DELETE /api/v1/slides/event/:eventId
 * @desc Delete all slides for event
 * @access Private (Super Admin - Level 4+)
 */
router.delete('/event/:eventId', requireLevel(4), (req, res) => slideController.deleteEventSlides(req, res));

export default router;
