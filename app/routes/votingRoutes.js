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

// Voting operations
router.post('/initiate-vote', optionalAuth, (req, res) => votingController.initiateVote(req, res));
router.get('/history', requireRead, (req, res) => votingController.getUserVotingHistory(req, res));

// Payment operations
router.get('/verify/:reference', optionalAuth, (req, res) => paymentController.verifyPayment(req, res));
router.post('/webhook', (req, res) => paymentController.handleWebhook(req, res));
router.get('/payment/:reference', optionalAuth, (req, res) => paymentController.getPaymentDetails(req, res));

// Cost estimation
router.post('/estimate-cost', optionalAuth, (req, res) => votingController.getVotingCostEstimate(req, res));

// Results (public access for transparency)
router.get('/results/event/:eventId', optionalAuth, (req, res) => votingController.getEventResults(req, res));
router.get('/results/category/:categoryId', optionalAuth, (req, res) => votingController.getCategoryResults(req, res));

// Eligibility and verification
router.get('/eligibility/:eventId', requireRead, (req, res) => votingController.checkVotingEligibility(req, res));
router.get('/verify-vote/:voteId', requireRead, (req, res) => votingController.verifyVote(req, res));

// Vote bundles (admin operations)
router.post('/bundles', requireLevel(3), (req, res) => votingController.createVoteBundle(req, res));
router.get('/bundles/:bundleId',  (req, res) => votingController.getVoteBundle(req, res));
router.get('/bundles/event/:eventId',  (req, res) => votingController.getVoteBundlesByEvent(req, res));
router.get('/bundles/category/:categoryId', (req, res) => votingController.getVoteBundlesByCategory(req, res));
router.get('/bundles/event/:eventId/category/:categoryId', (req, res) => votingController.getVoteBundlesByEventAndCategory(req, res));

// Statistics and analytics
router.get('/stats/:eventId', requireRead, (req, res) => votingController.getVotingStats(req, res));
router.get('/updates/:eventId', optionalAuth, (req, res) => votingController.getVotingUpdates(req, res));

// Export and audit (admin operations)
router.get('/export/:eventId', requireLevel(3), (req, res) => votingController.exportResults(req, res));
router.get('/audit/:eventId', requireLevel(3), (req, res) => votingController.auditVoting(req, res));

// Payment statistics (admin only)
router.get('/payment-stats', requireLevel(3), (req, res) => paymentController.getPaymentStats(req, res));
router.get('/payments', requireLevel(3), (req, res) => paymentController.listPayments(req, res));

export default router;