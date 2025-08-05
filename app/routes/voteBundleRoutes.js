#!/usr/bin/env node
/**
 * VoteBundle Routes
 * 
 * Defines API endpoints for vote bundle operations.
 */

import express from 'express';
import VoteBundleController from '../controllers/VoteBundleController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete,
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const voteBundleController = new VoteBundleController();

// Public routes (with optional auth)
router.get('/', optionalAuth, (req, res) => voteBundleController.getVoteBundles(req, res));
router.get('/stats', optionalAuth, (req, res) => voteBundleController.getVoteBundleStats(req, res));
router.get('/:id', optionalAuth, (req, res) => voteBundleController.getVoteBundleById(req, res));

// Filter routes
router.get('/event/:eventId', optionalAuth, (req, res) => voteBundleController.getVoteBundlesByEvent(req, res));
router.get('/category/:categoryId', optionalAuth, (req, res) => voteBundleController.getVoteBundlesByCategory(req, res));
router.get('/event/:eventId/category/:categoryId', optionalAuth, (req, res) => voteBundleController.getVoteBundlesByEventAndCategory(req, res));

// Admin routes
router.post('/', requireCreate, (req, res) => voteBundleController.createVoteBundle(req, res));
router.put('/:id', requireUpdate, (req, res) => voteBundleController.updateVoteBundle(req, res));
router.delete('/:id', requireDelete, (req, res) => voteBundleController.deleteVoteBundle(req, res));

export default router;
