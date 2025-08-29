#!/usr/bin/env node
/**
 * Form Service
 * 
 * Handles form management including creation, updates, submissions,
 * and form-related business logic.
 */

import BaseService from './BaseService.js';
import FormsRepository from '../repositories/FormsRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import CacheService from './CacheService.js';
import mongoose from 'mongoose';

class FormService extends BaseService {
    constructor() {
        super();
        this.formsRepository = new FormsRepository();
        this.userRepository = new UserRepository();
        this.activityRepository = new ActivityRepository();
    }

    /**
     * Create a new form
     * @param {Object} formData - Form data
     * @param {String} createdBy - ID of user creating the form
     * @returns {Promise<Object>} Created form
     */
    async createForm(formData, createdBy) {
        try {
            this._log('create_form', { title: formData.title, createdBy });

            // Validate required fields
            this._validateRequiredFields(formData, ['title', 'fields']);
            this._validateObjectId(createdBy, 'Created By User ID');

            // Validate form fields
            this._validateFormFields(formData.fields);

            // Create form
            const formToCreate = {
                ...this._sanitizeData(formData),
                status: formData.status || 'draft',
                submissionCount: 0,
                createdBy,
                createdAt: new Date()
            };

            const form = await this.formsRepository.create(formToCreate);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'form_create',
                targetType: 'form',
                targetId: form._id,
                metadata: { 
                    formTitle: form.title,
                    fieldsCount: form.fields.length
                }
            });

            this._log('create_form_success', { formId: form._id, title: form.title });

            return {
                success: true,
                form: {
                    id: form._id,
                    title: form.title,
                    description: form.description,
                    fields: form.fields,
                    status: form.status,
                    submissionCount: form.submissionCount,
                    createdAt: form.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_form', { title: formData.title });
        }
    }

    /**
     * Update form details
     * @param {String} formId - Form ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user updating the form
     * @returns {Promise<Object>} Updated form
     */
    async updateForm(formId, updateData, updatedBy) {
        try {
            this._log('update_form', { formId, updatedBy });

            this._validateObjectId(formId, 'Form ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current form
            const currentForm = await this.formsRepository.findById(formId);
            if (!currentForm) {
                throw new Error('Form not found');
            }

            // Check if form can be updated
            if (currentForm.status === 'archived') {
                throw new Error('Cannot update archived form');
            }

            // Validate form fields if being updated
            if (updateData.fields) {
                this._validateFormFields(updateData.fields);
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            delete sanitizedData._id;
            delete sanitizedData.submissionCount;
            delete sanitizedData.createdAt;
            delete sanitizedData.createdBy;
            sanitizedData.updatedAt = new Date();

            // Update form
            const updatedForm = await this.formsRepository.updateById(formId, sanitizedData);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'form_update',
                targetType: 'form',
                targetId: formId,
                metadata: { 
                    formTitle: updatedForm.title,
                    updatedFields: Object.keys(sanitizedData)
                }
            });

            // Invalidate cache
            CacheService.delete(`form:${formId}`);

            this._log('update_form_success', { formId });

            return {
                success: true,
                form: {
                    id: updatedForm._id,
                    title: updatedForm.title,
                    description: updatedForm.description,
                    fields: updatedForm.fields,
                    status: updatedForm.status,
                    submissionCount: updatedForm.submissionCount,
                    updatedAt: updatedForm.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_form', { formId });
        }
    }

    /**
     * Delete a form
     * @param {String} formId - Form ID
     * @param {String} deletedBy - ID of user deleting the form
     * @returns {Promise<Object>} Deletion result
     */
    async deleteForm(formId, deletedBy) {
        try {
            this._log('delete_form', { formId, deletedBy });

            this._validateObjectId(formId, 'Form ID');
            this._validateObjectId(deletedBy, 'Deleted By User ID');

            // Get form
            const form = await this.formsRepository.findById(formId);
            if (!form) {
                throw new Error('Form not found');
            }

            // Check if form has submissions
            if (form.submissionCount > 0) {
                throw new Error('Cannot delete form with existing submissions. Archive it instead.');
            }

            // Delete form
            await this.formsRepository.deleteById(formId);

            // Log activity
            await this.activityRepository.logActivity({
                user: deletedBy,
                action: 'form_delete',
                targetType: 'form',
                targetId: formId,
                metadata: { 
                    formTitle: form.title
                }
            });

            // Invalidate cache
            CacheService.delete(`form:${formId}`);

            this._log('delete_form_success', { formId });

            return {
                success: true,
                message: 'Form deleted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'delete_form', { formId });
        }
    }

    /**
     * Get form by ID
     * @param {String} formId - Form ID
     * @param {Boolean} includeSubmissions - Whether to include submission data
     * @returns {Promise<Object>} Form details
     */
    async getFormById(formId, includeSubmissions = false) {
        try {
            this._log('get_form_by_id', { formId, includeSubmissions });

            this._validateObjectId(formId, 'Form ID');

            // Check cache first
            const cacheKey = `form:${formId}`;
            let form = CacheService.get(cacheKey);

            if (!form) {
                form = await this.formsRepository.findById(formId);
                if (!form) {
                    throw new Error('Form not found');
                }

                // Cache the form
                CacheService.set(cacheKey, form, 1800000); // 30 minutes
            }

            const formData = {
                id: form._id,
                title: form.title,
                description: form.description,
                fields: form.fields,
                status: form.status,
                submissionCount: form.submissionCount,
                settings: form.settings,
                createdAt: form.createdAt,
                updatedAt: form.updatedAt
            };

            // Include submissions if requested
            if (includeSubmissions) {
                const submissions = await this.formsRepository.getFormSubmissions(formId);
                formData.submissions = submissions.map(submission => ({
                    id: submission._id,
                    data: submission.data,
                    submittedBy: submission.submittedBy,
                    submittedAt: submission.submittedAt,
                    ipAddress: submission.ipAddress
                }));
            }

            return {
                success: true,
                form: formData
            };
        } catch (error) {
            throw this._handleError(error, 'get_form_by_id', { formId });
        }
    }

    /**
     * Submit a form
     * @param {String} formId - Form ID
     * @param {Object} submissionData - Form submission data
     * @param {String} submittedBy - ID of user submitting the form
     * @param {Object} context - Additional context (IP, user agent, etc.)
     * @returns {Promise<Object>} Submission result
     */
    async submitForm(formId, submissionData, context = {}) {
        try {
            this._log('submit_form', { formId, context });

            this._log('submit_form_data', { formId, data: submissionData });

            submissionData.submittedBy = submissionData.data["Your Name"] || submissionData.data["Full Name"]

            this._validateObjectId(formId, 'Form ID');

            // Get form
            const form = await this.formsRepository.findById(formId);
            if (!form) {
                throw new Error('Form not found');
            }

            // Check if form accepts submissions
            if (form.isActive === false) {
                throw new Error('Form is not accepting submissions');
            }

            // Validate submission data against form fields
            this._validateFormSubmission(submissionData.data, form.fields);

            // Check if user already submitted (if single submission allowed)
            if (form.settings && form.settings.allowMultipleSubmissions === false) {
                const existingSubmission = await this.formsRepository.findUserSubmission(formId, submittedBy);
                if (existingSubmission) {
                    throw new Error('You have already submitted this form');
                }
            }

            // Create submission
            const submission = {
                data: submissionData.data,
                submittedBy: submissionData.submittedBy,
                submittedAt: new Date(),
                ipAddress: context.ipAddress || null,
                userAgent: context.userAgent || null
            };

            const savedSubmission = await this.formsRepository.createSubmission(formId, submission);

            // Update form submission count
            await this.formsRepository.increaseSubmissionCount(formId);

            // Invalidate form cache
            CacheService.clearAll();

            this._log('submit_form_success', { formId, submissionId: savedSubmission._id });

            return {
                success: true,
                submission: {
                    id: savedSubmission._id,
                    formId: savedSubmission.formId,
                    submittedAt: savedSubmission.submittedAt
                },
                message: 'Form submitted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'submit_form', { formId });
        }
    }

    /**
     * Get forms with filtering and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Paginated forms
     */
    async getForms(query = {}) {
        try {
            this._log('get_forms', { query });

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Create filter based on query
            const filter = this._createSearchFilter(query, ['title', 'description']);

            // Add specific filters
            if (query.status) {
                filter.status = query.status;
            }

            if (query.createdBy) {
                this._validateObjectId(query.createdBy, 'Created By User ID');
                filter.createdBy = query.createdBy;
            }

            const forms = await this.formsRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { createdAt: -1 }
            });

            // Get total count for pagination
            const total = await this.formsRepository.countDocuments(filter);

            // Format forms
            const formattedForms = forms.map(form => ({
                id: form._id,
                title: form.title,
                description: form.description,
                status: form.status,
                submissionCount: form.submissionCount,
                fieldsCount: form.fields ? form.fields.length : 0,
                createdAt: form.createdAt,
                fields: form.fields,
                updatedAt: form.updatedAt,
                status: form.status,
                isActive: form.isActive
            }));

            return {
                success: true,
                data: this._formatPaginationResponse(formattedForms, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_forms', { query });
        }
    }

    /**
     * Get form submissions with filtering and pagination
     * @param {String} formId - Form ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Form submissions
     */
    async getFormSubmissions(formId, query = {}) {
        try {
            this._log('get_form_submissions', { formId, query });

            this._validateObjectId(formId, 'Form ID');

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Date range filter
            const filter = { formId };
            if (query.startDate || query.endDate) {
                filter.submittedAt = {};
                if (query.startDate) {
                    filter.submittedAt.$gte = new Date(query.startDate);
                }
                if (query.endDate) {
                    filter.submittedAt.$lte = new Date(query.endDate);
                }
            }

            const submissions = await this.formsRepository.findSubmissions(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { submittedAt: -1 },
                populate: [
                    { path: 'submittedBy', select: 'username email profile.firstName profile.lastName' }
                ]
            });

            const total = await this.formsRepository.countSubmissions(filter);

            // Format submissions
            const formattedSubmissions = submissions.map(submission => ({
                id: submission._id,
                data: submission.data,
                submittedBy: {
                    id: submission.submittedBy._id,
                    username: submission.submittedBy.username,
                    email: submission.submittedBy.email,
                    name: submission.submittedBy.profile ? 
                        `${submission.submittedBy.profile.firstName} ${submission.submittedBy.profile.lastName}`.trim() 
                        : submission.submittedBy.username
                },
                submittedAt: submission.submittedAt,
                ipAddress: submission.ipAddress
            }));

            return {
                success: true,
                data: this._formatPaginationResponse(formattedSubmissions, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_form_submissions', { formId });
        }
    }

    /**
     * Archive a form
     * @param {String} formId - Form ID
     * @param {String} archivedBy - ID of user archiving the form
     * @returns {Promise<Object>} Archive result
     */
    async archiveForm(formId, archivedBy) {
        try {
            this._log('archive_form', { formId, archivedBy });

            this._validateObjectId(formId, 'Form ID');
            this._validateObjectId(archivedBy, 'Archived By User ID');

            // Update form status to archived
            const updatedForm = await this.formsRepository.updateById(formId, {
                status: 'archived',
                archivedAt: new Date(),
                archivedBy,
                updatedAt: new Date()
            });

            if (!updatedForm) {
                throw new Error('Form not found');
            }

            // Log activity
            await this.activityRepository.logActivity({
                user: archivedBy,
                action: 'form_archive',
                targetType: 'form',
                targetId: formId,
                metadata: { 
                    formTitle: updatedForm.title
                }
            });

            // Invalidate cache
            CacheService.delete(`form:${formId}`);

            this._log('archive_form_success', { formId });

            return {
                success: true,
                form: {
                    id: updatedForm._id,
                    title: updatedForm.title,
                    status: updatedForm.status,
                    archivedAt: updatedForm.archivedAt
                },
                message: 'Form archived successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'archive_form', { formId });
        }
    }

    /**
     * Validate form fields structure
     * @param {Array} fields - Form fields to validate
     * @throws {Error} If validation fails
     */
    _validateFormFields(fields) {
        if (!Array.isArray(fields) || fields.length === 0) {
            throw new Error('Form must have at least one field');
        }

        const validFieldTypes = ['text', 'email', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date', 'file'];

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            
            if (!field.name || !field.type) {
                throw new Error(`Field ${i + 1} must have name and type`);
            }

            if (!validFieldTypes.includes(field.type)) {
                throw new Error(`Invalid field type: ${field.type}`);
            }

            if ((field.type === 'select' || field.type === 'radio') && (!field.options || !Array.isArray(field.options))) {
                throw new Error(`Field ${field.name} must have options array`);
            }
        }
    }

    /**
     * Validate form submission data
     * @param {Object} submissionData - Submission data to validate
     * @param {Array} formFields - Form fields definition
     * @throws {Error} If validation fails
     */
    _validateFormSubmission(submissionData, formFields) {
        for (const field of formFields) {
            const value = submissionData[field.label];

            // Check required fields
            if (field.required && (value === undefined || value === null || value === '')) {
                throw new Error(`Field '${field.label || field.name}' is required`);
            }

            // Type-specific validation
            if (value !== undefined && value !== null && value !== '') {
                switch (field.type) {
                    case 'email':
                        this._validateEmail(value);
                        break;
                    case 'number':
                        if (isNaN(value)) {
                            throw new Error(`Field '${field.label || field.name}' must be a number`);
                        }
                        break;
                    case 'select':
                    case 'radio':
                        if (!field.options.includes(value)) {
                            throw new Error(`Invalid option for field '${field.label || field.name}'`);
                        }
                        break;
                    case 'checkbox':
                        if (!Array.isArray(value)) {
                            throw new Error(`Field '${field.label || field.name}' must be an array`);
                        }
                        for (const option of value) {
                            if (!field.options.includes(option)) {
                                throw new Error(`Invalid option '${option}' for field '${field.label || field.name}'`);
                            }
                        }
                        break;
                }
            }
        }
    }

    /**
     * Get form by model type and model ID
     * @param {String} model - Model type (e.g., 'event', 'nomination', 'registration')
     * @param {String} modelId - ID of the specific model instance
     * @param {Boolean} includeSubmissions - Whether to include submission data
     * @returns {Promise<Object>} Form details for the specified model
     */
    async getFormByModelAndModelID(model, modelId, includeSubmissions = false) {
        try {
            this._log('get_form_by_model_and_modelid', { model, modelId, includeSubmissions });

            // Validate inputs
            if (!model || typeof model !== 'string') {
                throw new Error('Model type is required and must be a string');
            }
            this._validateObjectId(modelId, 'Model ID');

            if (typeof modelId === 'string') {
                modelId = new mongoose.Types.ObjectId(modelId);
            }
            // Check cache first
            const cacheKey = `form:${model}:${modelId}`;
            let form = CacheService.get(cacheKey);

            if (!form) {
                // Find form by model and modelId
                form = await this.formsRepository.findOne({ 
                    model: model, 
                    modelId: modelId,
                    isActive: true,
                    isDeleted: false 
                });

                if (!form) {
                    throw new Error(`No active form found for ${model} with ID ${modelId}`);
                }

                // Cache the form
                CacheService.set(cacheKey, form, 1800000); // 30 minutes
            }

            const formData = {
                id: form._id,
                title: form.title,
                description: form.description,
                fields: form.fields,
                status: form.status,
                submissionCount: form.submissionCount,
                settings: form.settings,
                model: form.model,
                modelId: form.modelId,
                createdAt: form.createdAt,
                updatedAt: form.updatedAt
            };

            // Include submissions if requested
            if (includeSubmissions) {
                const submissions = await this.formsRepository.getFormSubmissions(form._id);
                formData.submissions = submissions.map(submission => ({
                    id: submission._id,
                    data: submission.data,
                    submittedBy: submission.submittedBy,
                    submittedAt: submission.submittedAt,
                    ipAddress: submission.ipAddress
                }));
            }

            this._log('get_form_by_model_and_modelid_success', { 
                formId: form._id, 
                model, 
                modelId 
            });

            return {
                success: true,
                form: formData
            };
        } catch (error) {
            throw this._handleError(error, 'get_form_by_model_and_modelid', { model, modelId });
        }
    }

    /**
     * Create a form for a specific model and model ID
     * @param {String} model - Model type (e.g., 'event', 'nomination', 'registration')
     * @param {String} modelId - ID of the specific model instance
     * @param {Object} formData - Form data (title, description, fields, etc.)
     * @param {String} createdBy - ID of user creating the form
     * @returns {Promise<Object>} Created form
     */
    async createFormForModel(model, modelId, formData, createdBy) {
        try {
            this._log('create_form_for_model', { 
                model, 
                modelId, 
                title: formData.title, 
                createdBy 
            });

            // Validate inputs
            if (!model || typeof model !== 'string') {
                throw new Error('Model type is required and must be a string');
            }
            this._validateObjectId(modelId, 'Model ID');
            this._validateRequiredFields(formData, ['title', 'fields']);
            this._validateObjectId(createdBy, 'Created By User ID');

            // Validate form fields
            this._validateFormFields(formData.fields);

            // Check if a form already exists for this model and modelId
            const existingForm = await this.formsRepository.findOne({
                model: model.toLowerCase(),
                modelId: modelId,
                isActive: true,
                isDeleted: false
            });

            if (existingForm) {
                throw new Error(`A form already exists for ${model} with ID ${modelId}`);
            }

            // Create form with model association
            const formToCreate = {
                ...this._sanitizeData(formData),
                model: model.toLowerCase(),
                modelId: modelId,
                status: formData.status || 'draft',
                submissionCount: 0,
                createdBy,
                createdAt: new Date()
            };

            const form = await this.formsRepository.create(formToCreate);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'form_create_for_model',
                targetType: 'form',
                targetId: form._id,
                metadata: { 
                    formTitle: form.title,
                    model: form.model,
                    modelId: form.modelId,
                    fieldsCount: form.fields.length
                }
            });

            this._log('create_form_for_model_success', { 
                formId: form._id, 
                model, 
                modelId, 
                title: form.title 
            });

            return {
                success: true,
                form: {
                    id: form._id,
                    title: form.title,
                    description: form.description,
                    fields: form.fields,
                    status: form.status,
                    submissionCount: form.submissionCount,
                    model: form.model,
                    modelId: form.modelId,
                    createdAt: form.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_form_for_model', { 
                model, 
                modelId, 
                title: formData.title 
            });
        }
    }

    /**
     * Get all forms for a specific model type
     * @param {String} model - Model type (e.g., 'event', 'nomination', 'registration')
     * @param {Object} query - Query parameters for filtering and pagination
     * @returns {Promise<Object>} Paginated forms for the model type
     */
    async getFormsByModel(model, query = {}) {
        try {
            this._log('get_forms_by_model', { model, query });

            // Validate input
            if (!model || typeof model !== 'string') {
                throw new Error('Model type is required and must be a string');
            }

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Create filter based on query
            const filter = this._createSearchFilter(query, ['title', 'description']);
            filter.model = model.toLowerCase();
            filter.isActive = true;
            filter.isDeleted = false;

            // Add specific filters
            if (query.status) {
                filter.status = query.status;
            }

            if (query.createdBy) {
                this._validateObjectId(query.createdBy, 'Created By User ID');
                filter.createdBy = query.createdBy;
            }

            if (query.modelId) {
                this._validateObjectId(query.modelId, 'Model ID');
                filter.modelId = query.modelId;
            }

            const forms = await this.formsRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { createdAt: -1 },
                populate: [
                    { path: 'createdBy', select: 'username email' }
                ]
            });

            // Get total count for pagination
            const total = await this.formsRepository.countDocuments(filter);

            // Format forms
            const formattedForms = forms.map(form => ({
                id: form._id,
                title: form.title,
                description: form.description,
                status: form.status,
                submissionCount: form.submissionCount,
                fieldsCount: form.fields ? form.fields.length : 0,
                model: form.model,
                modelId: form.modelId,
                createdBy: form.createdBy ? {
                    id: form.createdBy._id,
                    username: form.createdBy.username,
                    email: form.createdBy.email
                } : null,
                createdAt: form.createdAt,
                updatedAt: form.updatedAt
            }));

            this._log('get_forms_by_model_success', { 
                model, 
                count: formattedForms.length, 
                total 
            });

            return {
                success: true,
                data: this._formatPaginationResponse(formattedForms, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_forms_by_model', { model, query });
        }
    }
}

export default FormService;
