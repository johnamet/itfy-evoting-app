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
    requireDelete 
} from '../middleware/auth.js';

const router = express.Router();
const slideController = new SlideController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/slides/' });

// Slide CRUD operations
router.post('/', requireCreate, (req, res) => slideController.createSlide(req, res));
router.get('/', optionalAuth, (req, res) => slideController.getSlides(req, res));
router.get('/:id', optionalAuth, (req, res) => slideController.getSlideById(req, res));
router.put('/:id', requireUpdate, (req, res) => slideController.updateSlide(req, res));
router.delete('/:id', requireDelete, (req, res) => slideController.deleteSlide(req, res));

// Slide operations
router.get('/event/:eventId', optionalAuth, (req, res) => slideController.getSlidesByEvent(req, res));
router.post('/reorder', requireUpdate, (req, res) => slideController.reorderSlides(req, res));
router.post('/:id/duplicate', requireCreate, (req, res) => slideController.duplicateSlide(req, res));
router.get('/:id/preview', optionalAuth, (req, res) => slideController.getSlidePreview(req, res));

// File operations
router.post('/:id/media', requireUpdate, upload.single('media'), (req, res) => slideController.uploadSlideMedia(req, res));

// Status operations
router.patch('/:id/status', requireUpdate, (req, res) => slideController.updateSlideStatus(req, res));

export default router;
