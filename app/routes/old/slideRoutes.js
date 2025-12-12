#!/usr/bin/env node
/**
 * Slide Routes
 * 
 * Defines API endpoints for slide management operations.
 */

import express from 'express';
import multer from 'multer';
import SlideController from '../controllers/SlideController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireUpdate, 
    requireDelete, 
    requireLevel,
    authenticate
} from '../middleware/auth.js';

const router = express.Router();
const slideController = new SlideController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/slides/' });
router.get('/published', (req, res) => slideController.getPublishedSlides(req, res));
router.get('/', (req, res) => slideController.getSlides(req, res))
router.get('/event/:eventId', optionalAuth, (req, res) => slideController.getSlidesByEvent(req, res));

router.use(authenticate)

// Slide CRUD operations
router.post('/', requireLevel(3), (req, res) => slideController.createSlide(req, res));
router.get('/:id', requireLevel(1), (req, res) => slideController.getSlideById(req, res));
router.put('/:id', requireLevel(2), (req, res) => slideController.updateSlide(req, res));
router.delete('/:id', requireLevel(3), (req, res) => slideController.deleteSlide(req, res));

// Slide operations
router.post('/reorder', requireLevel(2), (req, res) => slideController.reorderSlides(req, res));
router.post('/:id/duplicate', requireLevel(3), (req, res) => slideController.duplicateSlide(req, res));
router.get('/:id/preview', optionalAuth, (req, res) => slideController.getSlidePreview(req, res));

// File operations
router.post('/:id/media', requireLevel(2), upload.single('media'), (req, res) => slideController.uploadSlideMedia(req, res));

// Status operations
router.patch('/:id/status', requireLevel(2), (req, res) => slideController.updateSlideStatus(req, res));

export default router;
