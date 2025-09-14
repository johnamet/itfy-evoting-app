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
    requireDelete, 
    requireLevel
} from '../middleware/auth.js';

const router = express.Router();
const candidateController = new CandidateController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/candidates/' });

router.get('/', optionalAuth, (req, res) => candidateController.getCandidates(req, res));
router.get('/search', optionalAuth, (req, res) => candidateController.searchCandidates(req, res));
router.get('/top/:eventId', optionalAuth, (req, res) => candidateController.getTopCandidates(req, res));
router.get('/event/:eventId', optionalAuth, (req, res) => candidateController.getCandidatesByEvent(req, res));
router.get('/category/:categoryId', optionalAuth, (req, res) => candidateController.getCandidatesByCategory(req, res));
router.get('/cid/:cid', optionalAuth, (req, res) => candidateController.findByCId(req, res));
router.get('/:id', optionalAuth, (req, res) => candidateController.getCandidateById(req, res));
router.get('/:id/votes', optionalAuth, (req, res) => candidateController.getCandidateVoteCount(req, res));
router.get('/:id/stats', (req, res) => candidateController.getCandidateStats(req, res));
router.get('/:id/statistics', (req, res) => candidateController.getCandidateStatistics(req, res));

router.use(authenticate);
// Candidate CRUD operations
router.post('/', requireLevel(3), (req, res) => candidateController.createCandidate(req, res));
router.post('/bulk', requireLevel(3), (req, res) => candidateController.bulkCreateCandidates(req, res));
router.put('/bulk-update', requireLevel(3), (req, res) => candidateController.bulkUpdateCandidates(req, res));
router.put('/:id', requireLevel(2), (req, res) => candidateController.updateCandidate(req, res));
router.delete('/:id', requireLevel(4), (req, res) => candidateController.deleteCandidate(req, res));

// Category management
router.post('/:id/categories/:categoryId', requireLevel(2), (req, res) => candidateController.addCategoryToCandidate(req, res));
router.delete('/:id/categories/:categoryId', requireLevel(2), (req, res) => candidateController.removeCategoryFromCandidate(req, res));

// File operations
router.post('/:id/image', requireLevel(2), upload.single('image'), (req, res) => candidateController.uploadCandidateImage(req, res));
router.put('/:id/photo', requireLevel(2), upload.single('photo'), (req, res) => candidateController.updateCandidatePhoto(req, res));
router.delete('/:id/photo', requireLevel(2), (req, res) => candidateController.removeCandidatePhoto(req, res));

// Status operations
router.patch('/:id/status', requireLevel(2), (req, res) => candidateController.updateCandidateStatus(req, res));

export default router;
