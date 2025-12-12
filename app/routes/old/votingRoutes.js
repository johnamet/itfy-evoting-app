#!/usr/bin/env node
/**
 * Voting Routes
 * 
 * Defines API endpoints for voting operations.
 */

import express from 'express';
import VotingController from '../controllers/VotingController.js';
import PaymentController from '../controllers/PaymentController.js';
import { 
    optionalAuth, 
    requireRead, 
    requireCreate, 
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const votingController = new VotingController();
const paymentController = new PaymentController();

// === Core Voting Operations (Public/Anonymous) ===
router.post('/cast', (req, res) => votingController.castVote(req, res)); // Anonymous vote casting
router.post('/bulk', (req, res) => votingController.bulkCastVotes(req, res)); // Bulk voting
router.get('/status', (req, res) => votingController.checkVoteStatus(req, res)); // Check if email has voted
router.post('/has-voted', (req, res) => votingController.hasVoted(req, res)); // Check voting status

// === Vote Retrieval (Admin/Analytics) ===
router.get('/event/:eventId', requireRead, (req, res) => votingController.getEventVotes(req, res));
router.get('/candidate/:candidateId', requireRead, (req, res) => votingController.getCandidateVotes(req, res));
router.get('/analytics/:eventId', requireRead, (req, res) => votingController.getVoteAnalytics(req, res));

// === Payment Operations ===
router.get('/verify/:reference', (req, res) => paymentController.verifyPayment(req, res));
router.post('/webhook', (req, res) => paymentController.handleWebhook(req, res));
router.get('/payment/:reference', (req, res) => paymentController.getPaymentDetails(req, res));

// Vote bundles - Public viewing routes (must come before parameterized routes)
router.get('/bundles/active', (req, res) => votingController.getActiveVoteBundles(req, res));
router.get('/bundles/event/:eventId', (req, res) => votingController.getEventVoteBundles(req, res));
router.get('/bundles/category/:categoryId', (req, res) => votingController.getCategoryVoteBundles(req, res));

// Vote bundles - Admin management routes
router.get('/bundles/admin', requireLevel(2), (req, res) => votingController.getAllVoteBundles(req, res));
router.post('/bundles', requireLevel(3), (req, res) => votingController.createVoteBundle(req, res));
router.put('/bundles/:bundleId', requireLevel(3), (req, res) => votingController.updateVoteBundle(req, res));
router.post('/bundles/:bundleId/archive', requireLevel(3), (req, res) => votingController.archiveVoteBundle(req, res));
router.delete('/bundles/:bundleId', requireLevel(4), (req, res) => votingController.deleteVoteBundle(req, res));

// Vote bundle - Single bundle detail (public, must come after specific routes)
router.get('/bundles/:bundleId', (req, res) => votingController.getVoteBundle(req, res));

// === Payment Statistics (Admin) ===
router.get('/payment-stats', requireLevel(3), (req, res) => paymentController.getPaymentStats(req, res));
router.get('/payments', requireLevel(3), (req, res) => paymentController.listPayments(req, res));

export default router;