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
    requireDelete 
} from '../middleware/auth.js';

const router = express.Router();
const formController = new FormController();

// Standard form CRUD operations
router.post('/', requireCreate, (req, res) => formController.createForm(req, res));
router.get('/', optionalAuth, (req, res) => formController.getForms(req, res));
router.get('/:id', optionalAuth, (req, res) => formController.getFormById(req, res));
router.put('/:id', requireUpdate, (req, res) => formController.updateForm(req, res));
router.delete('/:id', requireDelete, (req, res) => formController.deleteForm(req, res));

// Form submissions
router.post('/:id/submit', optionalAuth, (req, res) => formController.submitForm(req, res));
router.get('/:id/submissions', requireRead, (req, res) => formController.getFormSubmissions(req, res));
router.get('/:id/export', requireRead, (req, res) => formController.exportFormSubmissions(req, res));

// Form operations
router.post('/:id/duplicate', requireCreate, (req, res) => formController.duplicateForm(req, res));
router.patch('/:id/status', requireUpdate, (req, res) => formController.updateFormStatus(req, res));
router.get('/:id/analytics', requireRead, (req, res) => formController.getFormAnalytics(req, res));

// Model-specific form operations (must be after other routes to avoid conflicts)
router.get('/model/:model', optionalAuth, (req, res) => formController.getFormsByModel(req, res));
router.get('/model/:model/:modelId', optionalAuth, (req, res) => formController.getFormByModelAndModelID(req, res));
router.post('/model/:model/:modelId', requireCreate, (req, res) => formController.createFormForModel(req, res));

export default router;
