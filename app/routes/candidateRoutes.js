#!/usr/bin/env node
/**
 * Candidate Routes
 * 
 * Defines API endpoints for candidate management operations.
 */

import express from 'express';
import multer from 'multer';
import CandidateController from '../controllers/CandidateController.js';
import { 
    authenticate, 
    optionalAuth, 
    requireRead, 
    requireCreate, 
    requireUpdate, 
    requireDelete 
} from '../middleware/auth.js';

const router = express.Router();
const candidateController = new CandidateController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/candidates/' });

// Candidate CRUD operations
router.post('/', requireCreate, (req, res) => candidateController.createCandidate(req, res));
router.get('/', optionalAuth, (req, res) => candidateController.getCandidates(req, res));
router.get('/:id', optionalAuth, (req, res) => candidateController.getCandidateById(req, res));
router.put('/:id', requireUpdate, (req, res) => candidateController.updateCandidate(req, res));
router.delete('/:id', requireDelete, (req, res) => candidateController.deleteCandidate(req, res));

// Candidate operations
router.get('/event/:eventId', optionalAuth, (req, res) => candidateController.getCandidatesByEvent(req, res));
router.get('/category/:categoryId', optionalAuth, (req, res) => candidateController.getCandidatesByCategory(req, res));
router.get('/:id/votes', optionalAuth, (req, res) => candidateController.getCandidateVoteCount(req, res));
router.get('/:id/stats', requireRead, (req, res) => candidateController.getCandidateStats(req, res));

// File operations
router.post('/:id/image', requireUpdate, upload.single('image'), (req, res) => candidateController.uploadCandidateImage(req, res));

// Status operations
router.patch('/:id/status', requireUpdate, (req, res) => candidateController.updateCandidateStatus(req, res));

export default router;
