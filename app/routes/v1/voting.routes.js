#!/usr/bin/env node
/**
 * Voting Routes
 * 
 * @module routes/v1/voting
 */

import express from 'express';
import VotingController from '../../controllers/VotingController.js';
import { optionalAuth, requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const votingController = new VotingController();

// ===== Core Voting Operations (Public/Anonymous) =====

/**
 * @route POST /api/v1/voting/cast
 * @desc Cast vote with vote bundles
 * @access Public (Anonymous)
 */
router.post('/cast', (req, res) => votingController.castVote(req, res));

/**
 * @route POST /api/v1/voting/bulk
 * @desc Cast multiple votes (bulk voting)
 * @access Public (Anonymous)
 */
router.post('/bulk', (req, res) => votingController.bulkCastVotes(req, res));

/**
 * @route GET /api/v1/voting/status
 * @desc Check if email has voted
 * @access Public
 */
router.get('/status', (req, res) => votingController.checkVoteStatus(req, res));

/**
 * @route POST /api/v1/voting/has-voted
 * @desc Check voting status for email/event/category
 * @access Public
 */
router.post('/has-voted', (req, res) => votingController.hasVoted(req, res));

// ===== Vote Bundle Routes (Public Viewing) =====

/**
 * @route GET /api/v1/voting/bundles/active
 * @desc Get active vote bundles
 * @access Public
 */
router.get('/bundles/active', (req, res) => votingController.getActiveVoteBundles(req, res));

/**
 * @route GET /api/v1/voting/bundles/event/:eventId
 * @desc Get vote bundles for specific event
 * @access Public
 */
router.get('/bundles/event/:eventId', (req, res) => votingController.getEventVoteBundles(req, res));

/**
 * @route GET /api/v1/voting/bundles/category/:categoryId
 * @desc Get vote bundles for specific category
 * @access Public
 */
router.get('/bundles/category/:categoryId', (req, res) => votingController.getCategoryVoteBundles(req, res));

/**
 * @route GET /api/v1/voting/bundles/:bundleId
 * @desc Get single vote bundle details
 * @access Public
 */
router.get('/bundles/:bundleId', (req, res) => votingController.getVoteBundle(req, res));

// ===== Vote Bundle Admin Routes =====

/**
 * @route GET /api/v1/voting/bundles/admin/all
 * @desc Get all vote bundles (admin view)
 * @access Private (Event Manager - Level 2+)
 */
router.get('/bundles/admin/all', requireLevel(2), (req, res) => votingController.getAllVoteBundles(req, res));

/**
 * @route POST /api/v1/voting/bundles
 * @desc Create new vote bundle
 * @access Private (Event Manager - Level 3+)
 */
router.post('/bundles', requireLevel(3), (req, res) => votingController.createVoteBundle(req, res));

/**
 * @route PUT /api/v1/voting/bundles/:bundleId
 * @desc Update vote bundle
 * @access Private (Event Manager - Level 3+)
 */
router.put('/bundles/:bundleId', requireLevel(3), (req, res) => votingController.updateVoteBundle(req, res));

/**
 * @route POST /api/v1/voting/bundles/:bundleId/archive
 * @desc Archive vote bundle
 * @access Private (Event Manager - Level 3+)
 */
router.post('/bundles/:bundleId/archive', requireLevel(3), (req, res) => votingController.archiveVoteBundle(req, res));

/**
 * @route DELETE /api/v1/voting/bundles/:bundleId
 * @desc Delete vote bundle (hard delete)
 * @access Private (Super Admin - Level 4+)
 */
router.delete('/bundles/:bundleId', requireLevel(4), (req, res) => votingController.deleteVoteBundle(req, res));

// ===== Vote Retrieval (Admin/Analytics) =====

/**
 * @route GET /api/v1/voting/event/:eventId
 * @desc Get all votes for an event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId', requireLevel(3), (req, res) => votingController.getEventVotes(req, res));

/**
 * @route GET /api/v1/voting/candidate/:candidateId
 * @desc Get votes for a candidate
 * @access Private (Event Manager - Level 3+)
 */
router.get('/candidate/:candidateId', requireLevel(3), (req, res) => votingController.getCandidateVotes(req, res));

/**
 * @route GET /api/v1/voting/analytics/:eventId
 * @desc Get vote analytics for event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/analytics/:eventId', requireLevel(3), (req, res) => votingController.getVoteAnalytics(req, res));

export default router;
