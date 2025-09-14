#!/usr/bin/env node
/**
 * Form Routes
 * 
 * Defines API endpoints for form management operations.
 */

import express from 'express';
import FormController from '../controllers/FormController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete, 
    authenticate,
    requireLevel
} from '../middleware/auth.js';

const router = express.Router();
const formController = new FormController();

// Standard form CRUD operations
router.get('/', optionalAuth, (req, res) => formController.getForms(req, res));
router.get('/:id', optionalAuth, (req, res) => formController.getFormById(req, res));
router.post('/:id/submit', optionalAuth, (req, res) => formController.submitForm(req, res));
router.get('/model/:model', optionalAuth, (req, res) => formController.getFormsByModel(req, res));
router.get('/model/:model/:modelId', optionalAuth, (req, res) => formController.getFormByModelAndModelID(req, res));

router.use(authenticate)
router.put('/:id', requireLevel(2), (req, res) => formController.updateForm(req, res));
router.delete('/:id', requireLevel(4), (req, res) => formController.deleteForm(req, res));
router.post('/', requireLevel(3), (req, res) => formController.createForm(req, res));
router.get('/:id/submissions', requireLevel(1), (req, res) => formController.getFormSubmissions(req, res));

// Form submissions
router.get('/:id/export', requireLevel(1), (req, res) => formController.exportFormSubmissions(req, res));

// Form operations
router.post('/:id/duplicate', requireLevel(3), (req, res) => formController.duplicateForm(req, res));
router.patch('/:id/status', requireLevel(2), (req, res) => formController.updateFormStatus(req, res));
router.get('/:id/analytics', requireLevel(1), (req, res) => formController.getFormAnalytics(req, res));

// Model-specific form operations (must be after other routes to avoid conflicts)

router.post('/model/:model/:modelId', requireLevel(3), (req, res) => formController.createFormForModel(req, res));

export default router;
