#!/usr/bin/env node
/**
 * Form Controller
 * 
 * Handles HTTP requests for form management including creation,
 * retrieval, updates, submissions, and model-specific forms.
 *
 * @swagger
 * tags:
 *   name: Forms
 *   description: Manages dynamic form creation and submission
 */

import BaseController from './BaseController.js';
import FormService from '../services/FormService.js';

class FormController extends BaseController {
    constructor() {
        super();
        this.formService = new FormService();
    }

    /**
     * Create a new form
     * POST /api/forms
     */
    async createForm(req, res) {
        try {
            const validation = this.validateRequiredParams(req, ['title', 'fields']);
            if (validation) {
                return this.sendError(res, validation.message, 400);
            }

            const userId = this.getUserId(req);
            if (!userId) {
                return this.sendError(res, 'Authentication required', 401);
            }

            const result = await this.formService.createForm(req.body, userId);
            return this.sendSuccess(res, result.form, 'Form created successfully', 201);

        } catch (error) {
            return this.handleServiceError(res, error, 'create form');
        }
    }

    /**
     * Get form by ID
     * GET /api/forms/:id
     */
    async getFormById(req, res) {
        try {
            const { id } = req.params;
            const includeSubmissions = req.query.includeSubmissions === 'true';

            const result = await this.formService.getFormById(id, includeSubmissions);
            return this.sendSuccess(res, result.form, 'Form retrieved successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'get form by ID');
        }
    }

    /**
     * Update form by ID
     * PUT /api/forms/:id
     */
    async updateForm(req, res) {
        try {
            const { id } = req.params;
            const userId = this.getUserId(req);
            
            if (!userId) {
                return this.sendError(res, 'Authentication required', 401);
            }

            const result = await this.formService.updateForm(id, req.body, userId);
            return this.sendSuccess(res, result.form, 'Form updated successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'update form');
        }
    }

    /**
     * Delete form by ID
     * DELETE /api/forms/:id
     */
    async deleteForm(req, res) {
        try {
            const { id } = req.params;
            const userId = this.getUserId(req);
            
            if (!userId) {
                return this.sendError(res, 'Authentication required', 401);
            }

            const result = await this.formService.deleteForm(id, userId);
            return this.sendSuccess(res, null, 'Form deleted successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'delete form');
        }
    }

    /**
     * Get all forms with filtering and pagination
     * GET /api/forms
     */
    async getForms(req, res) {
        try {
            const query = {
                status: req.query.status,
                search: req.query.search,
                createdBy: req.query.createdBy,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await this.formService.getForms(query);
            return this.sendSuccess(res, result, 'Forms retrieved successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'get forms');
        }
    }

    /**
     * Submit form data
     * POST /api/forms/:id/submit
     */
    async submitForm(req, res) {
        try {
            const { id } = req.params;
            const validation = this.validateRequiredParams(req, ['data']);
            
            if (validation) {
                return this.sendError(res, validation.message, 400);
            }

            const submissionData = {
                ...req.body,
                ipAddress: req.ip || req.connection.remoteAddress
            };

            const userId = this.getUserId(req);
            const result = await this.formService.submitForm(id, submissionData, userId);
            
            return this.sendSuccess(res, result.submission, 'Form submitted successfully', 201);

        } catch (error) {
            return this.handleServiceError(res, error, 'submit form');
        }
    }

    /**
     * Get form submissions
     * GET /api/forms/:id/submissions
     */
    async getFormSubmissions(req, res) {
        try {
            const { id } = req.params;
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                sortBy: req.query.sortBy || 'submittedAt',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await this.formService.getFormSubmissions(id, query);
            return this.sendSuccess(res, result, 'Form submissions retrieved successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'get form submissions');
        }
    }

    /**
     * Export form submissions as CSV
     * GET /api/forms/:id/export
     */
    async exportFormSubmissions(req, res) {
        try {
            const { id } = req.params;
            const format = req.query.format || 'csv';

            const result = await this.formService.exportFormSubmissions(id, format);
            
            res.set({
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="form_${id}_submissions.csv"`
            });
            
            return res.send(result.data);

        } catch (error) {
            return this.handleServiceError(res, error, 'export form submissions');
        }
    }

    /**
     * Duplicate an existing form
     * POST /api/forms/:id/duplicate
     */
    async duplicateForm(req, res) {
        try {
            const { id } = req.params;
            const userId = this.getUserId(req);
            
            if (!userId) {
                return this.sendError(res, 'Authentication required', 401);
            }

            const result = await this.formService.duplicateForm(id, userId);
            return this.sendSuccess(res, result.form, 'Form duplicated successfully', 201);

        } catch (error) {
            return this.handleServiceError(res, error, 'duplicate form');
        }
    }

    /**
     * Get form by model and model ID
     * GET /api/forms/model/:model/:modelId
     */
    async getFormByModelAndModelID(req, res) {
        try {
            const { model, modelId } = req.params;
            const includeSubmissions = req.query.includeSubmissions === 'true';

            const result = await this.formService.getFormByModelAndModelID(model, modelId, includeSubmissions);
            return this.sendSuccess(res, result.form, 'Form retrieved successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'get form by model and model ID');
        }
    }

    /**
     * Create form for specific model
     * POST /api/forms/model/:model/:modelId
     */
    async createFormForModel(req, res) {
        try {
            const { model, modelId } = req.params;
            const validation = this.validateRequiredParams(req, ['title', 'fields']);
            
            if (validation) {
                return this.sendError(res, validation.message, 400);
            }

            const userId = this.getUserId(req);
            if (!userId) {
                return this.sendError(res, 'Authentication required', 401);
            }

            const result = await this.formService.createFormForModel(model, modelId, req.body, userId);
            return this.sendSuccess(res, result.form, 'Form created for model successfully', 201);

        } catch (error) {
            return this.handleServiceError(res, error, 'create form for model');
        }
    }

    /**
     * Get forms by model type
     * GET /api/forms/model/:model
     */
    async getFormsByModel(req, res) {
        try {
            const { model } = req.params;
            const query = {
                status: req.query.status,
                search: req.query.search,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await this.formService.getFormsByModel(model, query);
            return this.sendSuccess(res, result, 'Forms retrieved successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'get forms by model');
        }
    }

    /**
     * Get form analytics
     * GET /api/forms/:id/analytics
     */
    async getFormAnalytics(req, res) {
        try {
            const { id } = req.params;
            const dateRange = {
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            const result = await this.formService.getFormAnalytics(id, dateRange);
            return this.sendSuccess(res, result, 'Form analytics retrieved successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'get form analytics');
        }
    }

    /**
     * Update form status
     * PATCH /api/forms/:id/status
     */
    async updateFormStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const userId = this.getUserId(req);
            
            if (!userId) {
                return this.sendError(res, 'Authentication required', 401);
            }

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const result = await this.formService.updateFormStatus(id, status, userId);
            return this.sendSuccess(res, result.form, 'Form status updated successfully');

        } catch (error) {
            return this.handleServiceError(res, error, 'update form status');
        }
    }
}

export default FormController;
