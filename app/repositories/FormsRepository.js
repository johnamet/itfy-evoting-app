#!/usr/bin/env node
/**
 * Forms Repository
 * 
 * Extends BaseRepository to provide Form-specific database operations.
 * Includes form management, model-based operations, and field configuration handling.
 */

import BaseRepository from './BaseRepository.js';
import Form from '../models/Form.js';

class FormsRepository extends BaseRepository {
    
    constructor() {
        // Get the Form model
        super(Form);
    }

    /**
     * Create a new form
     * @param {Object} formData - Form data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created form
     */
    async createForm(formData, options = {}) {
        try {
            if (Object.keys(formData).length === 0) {
                throw new Error("The Form Data is Empty");
            }

            // Check if form for this model already exists
            if (formData.modelId && formData.model) {
                const existingForm = await this.findByModelIdAndModel(formData.modelId, formData.model);
                if (existingForm) {
                    throw new Error(`Form for model '${formData.model}' with ID '${formData.modelId}' already exists`);
                }
            }

            const form = await this.create(formData, options);
            return form.toJSON();
        } catch (error) {
            throw this._handleError(error, 'createForm');
        }
    }

    /**
     * Find form by model ID and model name
     * @param {String} modelId - Model ID
     * @param {String} model - Model name
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} Found form or null
     */
    async findByModelIdAndModel(modelId, model, options = {}) {
        try {
            const criteria = { 
                modelId: modelId,
                model: model.trim(),
                isDeleted: false
            };
            return await this.findOne(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findByModelIdAndModel');
        }
    }

    /**
     * Find forms by model name
     * @param {String} model - Model name
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of forms
     */
    async findByModel(model, options = {}) {
        try {
            const criteria = { 
                model: model.trim(),
                isDeleted: false
            };
            return await this.find(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findByModel');
        }
    }

    /**
     * Find active forms
     * @param {Object} additionalCriteria - Additional search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of active forms
     */
    async findActiveForms(additionalCriteria = {}, options = {}) {
        try {
            const criteria = { 
                isActive: true,
                isDeleted: false,
                ...additionalCriteria
            };
            return await this.find(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findActiveForms');
        }
    }

    /**
     * Find forms with pagination
     * @param {Object} criteria - Search criteria
     * @param {Number} page - Page number
     * @param {Number} limit - Items per page
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Paginated forms
     */
    async findFormsWithPagination(criteria = {}, page = 1, limit = 10, options = {}) {
        try {
            const searchCriteria = {
                isDeleted: false,
                ...criteria
            };
            
            const defaultOptions = {
                sort: { createdAt: -1 },
                populate: [
                    { path: 'createdBy', select: 'firstName lastName email' },
                    { path: 'updatedBy', select: 'firstName lastName email' }
                ],
                ...options
            };

            return await this.findWithPagination(searchCriteria, page, limit, defaultOptions);
        } catch (error) {
            throw this._handleError(error, 'findFormsWithPagination');
        }
    }

    /**
     * Update form by ID
     * @param {String} id - Form ID
     * @param {Object} updateData - Update data
     * @param {Object} options - Update options
     * @returns {Promise<Object|null>} Updated form
     */
    async updateForm(id, updateData, options = {}) {
        try {
            // Add updatedAt timestamp
            updateData.updatedAt = new Date();

            const defaultOptions = {
                new: true,
                runValidators: true,
                populate: [
                    { path: 'createdBy', select: 'firstName lastName email' },
                    { path: 'updatedBy', select: 'firstName lastName email' }
                ],
                ...options
            };

            return await this.updateById(id, updateData, defaultOptions);
        } catch (error) {
            throw this._handleError(error, 'updateForm');
        }
    }

    /**
     * Soft delete form by ID
     * @param {String} id - Form ID
     * @param {String} updatedBy - User ID who is deleting
     * @param {Object} options - Additional options
     * @returns {Promise<Object|null>} Soft deleted form
     */
    async softDeleteForm(id, updatedBy, options = {}) {
        try {
            const updateData = {
                isDeleted: true,
                isActive: false,
                updatedBy: updatedBy,
                deletedAt: new Date()
            };

            return await this.updateById(id, updateData, options);
        } catch (error) {
            throw this._handleError(error, 'softDeleteForm');
        }
    }

    /**
     * Restore soft deleted form
     * @param {String} id - Form ID
     * @param {String} updatedBy - User ID who is restoring
     * @param {Object} options - Additional options
     * @returns {Promise<Object|null>} Restored form
     */
    async restoreForm(id, updatedBy, options = {}) {
        try {
            const updateData = {
                isDeleted: false,
                isActive: true,
                updatedBy: updatedBy,
                restoredAt: new Date()
            };

            return await this.updateById(id, updateData, options);
        } catch (error) {
            throw this._handleError(error, 'restoreForm');
        }
    }

    /**
     * Toggle form active status
     * @param {String} id - Form ID
     * @param {String} updatedBy - User ID who is toggling
     * @param {Object} options - Additional options
     * @returns {Promise<Object|null>} Updated form
     */
    async toggleActiveStatus(id, updatedBy, options = {}) {
        try {
            const form = await this.findById(id);
            if (!form) {
                throw new Error('Form not found');
            }

            const updateData = {
                isActive: !form.isActive,
                updatedBy: updatedBy
            };

            return await this.updateById(id, updateData, options);
        } catch (error) {
            throw this._handleError(error, 'toggleActiveStatus');
        }
    }

    /**
     * Find forms by creator
     * @param {String} createdBy - User ID who created the forms
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of forms created by user
     */
    async findByCreator(createdBy, options = {}) {
        try {
            const criteria = { 
                createdBy: createdBy,
                isDeleted: false
            };
            
            const defaultOptions = {
                sort: { createdAt: -1 },
                populate: [
                    { path: 'createdBy', select: 'firstName lastName email' },
                    { path: 'updatedBy', select: 'firstName lastName email' }
                ],
                ...options
            };

            return await this.find(criteria, defaultOptions);
        } catch (error) {
            throw this._handleError(error, 'findByCreator');
        }
    }

    /**
     * Update form fields
     * @param {String} id - Form ID
     * @param {Array} fields - New fields array
     * @param {String} updatedBy - User ID who is updating
     * @param {Object} options - Additional options
     * @returns {Promise<Object|null>} Updated form
     */
    async updateFormFields(id, fields, updatedBy, options = {}) {
        try {
            if (!Array.isArray(fields)) {
                throw new Error('Fields must be an array');
            }

            const updateData = {
                fields: fields,
                updatedBy: updatedBy
            };

            return await this.updateForm(id, updateData, options);
        } catch (error) {
            throw this._handleError(error, 'updateFormFields');
        }
    }

    /**
     * Search forms by model or fields content
     * @param {String} searchTerm - Search term
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of matching forms
     */
    async searchForms(searchTerm, options = {}) {
        try {
            if (!searchTerm || searchTerm.trim() === '') {
                return [];
            }

            const searchRegex = new RegExp(searchTerm.trim(), 'i');
            const criteria = {
                isDeleted: false,
                $or: [
                    { model: searchRegex },
                    { 'fields.name': searchRegex },
                    { 'fields.label': searchRegex },
                    { 'fields.placeholder': searchRegex }
                ]
            };

            const defaultOptions = {
                sort: { createdAt: -1 },
                populate: [
                    { path: 'createdBy', select: 'firstName lastName email' },
                    { path: 'updatedBy', select: 'firstName lastName email' }
                ],
                ...options
            };

            return await this.find(criteria, defaultOptions);
        } catch (error) {
            throw this._handleError(error, 'searchForms');
        }
    }

    /**
     * Get form statistics
     * @returns {Promise<Object>} Form statistics
     */
    async getFormStatistics() {
        try {
            const [totalForms, activeForms, deletedForms, formsByModel] = await Promise.all([
                this.countDocuments({}),
                this.countDocuments({ isActive: true, isDeleted: false }),
                this.countDocuments({ isDeleted: true }),
                this.model.aggregate([
                    { $match: { isDeleted: false } },
                    { $group: { _id: '$model', count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ])
            ]);

            return {
                totalForms,
                activeForms,
                inactiveForms: totalForms - activeForms - deletedForms,
                deletedForms,
                formsByModel: formsByModel.map(item => ({
                    model: item._id,
                    count: item.count
                }))
            };
        } catch (error) {
            throw this._handleError(error, 'getFormStatistics');
        }
    }

    /**
     * Bulk update forms
     * @param {Array} formIds - Array of form IDs
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - User ID who is updating
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Update result
     */
    async bulkUpdateForms(formIds, updateData, updatedBy, options = {}) {
        try {
            if (!Array.isArray(formIds) || formIds.length === 0) {
                throw new Error('Form IDs must be a non-empty array');
            }

            const criteria = { 
                _id: { $in: formIds },
                isDeleted: false
            };

            const updatePayload = {
                ...updateData,
                updatedBy: updatedBy,
                updatedAt: new Date()
            };

            const result = await this.updateMany(criteria, updatePayload, options);
            return result;
        } catch (error) {
            throw this._handleError(error, 'bulkUpdateForms');
        }
    }

    /**
     * Get forms with field count
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Forms with field count
     */
    async getFormsWithFieldCount(criteria = {}, options = {}) {
        try {
            const searchCriteria = {
                isDeleted: false,
                ...criteria
            };

            const aggregationPipeline = [
                { $match: searchCriteria },
                {
                    $addFields: {
                        fieldCount: { $size: { $ifNull: ['$fields', []] } }
                    }
                },
                { $sort: options.sort || { createdAt: -1 } }
            ];

            if (options.limit) {
                aggregationPipeline.push({ $limit: options.limit });
            }

            return await this.model.aggregate(aggregationPipeline);
        } catch (error) {
            throw this._handleError(error, 'getFormsWithFieldCount');
        }
    }

    /**
     * Increase the submission count for a form
     * @param {String} formId - Form ID
     * @returns {Promise<Object>} Update result
     */
    async increaseSubmissionCount(formId) {
        try {
            const result = await this.updateOne(
                { _id: formId },
                { $inc: { submissionCount: 1 } }
            );

            return result;
        } catch (error) {
            throw this._handleError(error, 'increaseSubmissionCount');
        }
    }

    /**
     * Create a submission for a form
     * @param {String} formId - Form ID
     * @param {Object} submissionData - Submission data
     * @returns {Promise<Object>} Created submission
     */
    async createSubmission(formId, submissionData) {
        try {
            const form = await this.findById(formId);
            if (!form) {
                throw new Error('Form not found');
            }

            const newSubmission = {
                data: submissionData.data,
                submittedBy: submissionData.submittedBy,
                ipAddress: submissionData.ipAddress,
                userAgent: submissionData.userAgent,
                createdAt: new Date()
            };

            form.submissions.push(newSubmission);
            await form.save();

            return newSubmission;
        } catch (error) {
            throw this._handleError(error, 'createSubmission');
        }
    }
}

export default FormsRepository;