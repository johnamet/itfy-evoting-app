#!/usr/bin/env node
/**
 * Nomination Routes
 * 
 * @module routes/v1/nominations
 */

import express from 'express';
import NominationController from '../../controllers/NominationController.js';
import { authenticate, requireLevel, optionalAuth } from '../../middleware/auth.js';

const router = express.Router();
const nominationController = new NominationController();

/**
 * @route POST /api/v1/nominations
 * @desc Submit nomination
 * @access Public
 */
router.post('/', (req, res) => nominationController.submitNomination(req, res));

/**
 * @route GET /api/v1/nominations
 * @desc Get all nominations (admin)
 * @access Private (Event Manager - Level 3+)
 */
router.get('/', requireLevel(3), (req, res) => nominationController.getAllNominations(req, res));

/**
 * @route GET /api/v1/nominations/:id
 * @desc Get nomination by ID
 * @access Private (Event Manager - Level 3+)
 */
router.get('/:id', requireLevel(3), (req, res) => nominationController.getNominationById(req, res));

/**
 * @route PUT /api/v1/nominations/:id/approve
 * @desc Approve nomination
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/approve', requireLevel(3), (req, res) => nominationController.approveNomination(req, res));

/**
 * @route PUT /api/v1/nominations/:id/reject
 * @desc Reject nomination
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/reject', requireLevel(3), (req, res) => nominationController.rejectNomination(req, res));

/**
 * @route GET /api/v1/nominations/event/:eventId
 * @desc Get nominations by event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId', requireLevel(3), (req, res) => nominationController.getNominationsByEvent(req, res));

/**
 * @route GET /api/v1/nominations/category/:categoryId
 * @desc Get nominations by category
 * @access Private (Event Manager - Level 3+)
 */
router.get('/category/:categoryId', requireLevel(3), (req, res) => nominationController.getNominationsByCategory(req, res));

/**
 * @route PUT /api/v1/nominations/:id/status
 * @desc Update nomination status
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/status', requireLevel(3), (req, res) => nominationController.updateNominationStatus(req, res));

export default router;
