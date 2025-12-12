#!/usr/bin/env node
/**
 * Candidate Routes
 * 
 * @module routes/v1/candidates
 */

import express from 'express';
import CandidateController from '../../controllers/CandidateController.js';
import { optionalAuth, requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const candidateController = new CandidateController();

/**
 * @route GET /api/v1/candidates
 * @desc Get all candidates (with filters)
 * @access Public
 */
router.get('/', optionalAuth, (req, res) => candidateController.getAllCandidates(req, res));

/**
 * @route GET /api/v1/candidates/:id
 * @desc Get candidate by ID
 * @access Public
 */
router.get('/:id', optionalAuth, (req, res) => candidateController.getCandidateById(req, res));

/**
 * @route POST /api/v1/candidates
 * @desc Create new candidate
 * @access Private (Event Manager - Level 3+)
 */
router.post('/', requireLevel(3), (req, res) => candidateController.createCandidate(req, res));

/**
 * @route PUT /api/v1/candidates/:id
 * @desc Update candidate
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id', requireLevel(3), (req, res) => candidateController.updateCandidate(req, res));

/**
 * @route DELETE /api/v1/candidates/:id
 * @desc Delete candidate
 * @access Private (Event Manager - Level 3+)
 */
router.delete('/:id', requireLevel(3), (req, res) => candidateController.deleteCandidate(req, res));

/**
 * @route GET /api/v1/candidates/:id/votes
 * @desc Get candidate vote count
 * @access Public
 */
router.get('/:id/votes', (req, res) => candidateController.getCandidateVotes(req, res));

/**
 * @route PUT /api/v1/candidates/:id/status
 * @desc Update candidate status
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/status', requireLevel(3), (req, res) => candidateController.updateCandidateStatus(req, res));

/**
 * @route GET /api/v1/candidates/event/:eventId
 * @desc Get candidates by event
 * @access Public
 */
router.get('/event/:eventId', (req, res) => candidateController.getCandidatesByEvent(req, res));

/**
 * @route GET /api/v1/candidates/category/:categoryId
 * @desc Get candidates by category
 * @access Public
 */
router.get('/category/:categoryId', (req, res) => candidateController.getCandidatesByCategory(req, res));

export default router;
