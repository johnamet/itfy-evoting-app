#!/usr/bin/env node
/**
 * Voting Routes
 * 
 * Defines API endpoints for voting operations.
 */

import express from 'express';
import VotingController from '../controllers/VotingController.js';
import { 
    optionalAuth, 
    requireRead, 
    requireCreate, 
    requireUpdate,
    requireDelete,
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const votingController = new VotingController();

// Voting operations
router.post('/vote', requireCreate, (req, res) => votingController.castVote(req, res));
router.get('/history', requireRead, (req, res) => votingController.getUserVotingHistory(req, res));

// Results (public access for transparency)
router.get('/results/event/:eventId', optionalAuth, (req, res) => votingController.getEventResults(req, res));
router.get('/results/category/:categoryId', optionalAuth, (req, res) => votingController.getCategoryResults(req, res));

// Eligibility and verification
router.get('/eligibility/:eventId', requireRead, (req, res) => votingController.checkVotingEligibility(req, res));
router.get('/verify/:voteId', requireRead, (req, res) => votingController.verifyVote(req, res));

// Vote bundles (admin operations)
router.post('/bundles', requireLevel(3), (req, res) => votingController.createVoteBundle(req, res));
router.get('/bundles/:bundleId', requireLevel(2), (req, res) => votingController.getVoteBundle(req, res));

// Statistics and analytics
router.get('/stats/:eventId', requireRead, (req, res) => votingController.getVotingStats(req, res));
router.get('/updates/:eventId', optionalAuth, (req, res) => votingController.getVotingUpdates(req, res));

// Export and audit (admin operations)
router.get('/export/:eventId', requireLevel(3), (req, res) => votingController.exportResults(req, res));
router.get('/audit/:eventId', requireLevel(3), (req, res) => votingController.auditVoting(req, res));

export default router;
