import BaseRepository from '../BaseRepository.js';
import Form from '../models/Form.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

/**
 * FormsRepository
 * 
 * Manages dynamic forms with intelligent caching. Forms are cached with a 15-minute TTL
 * since they are accessed frequently but don't change often.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - Event-specific and type-specific queries are cached
 * - Response count updates invalidate entity caches
 * - Active status changes invalidate caches
 * 
 * @extends BaseRepository
 */
class FormsRepository extends BaseRepository {
    constructor() {
        super(Form, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 900 // 15 minutes
        });
    }

    /**
     * Create a new form
     * 
     * @param {Object} formData - Form data
     * @param {string} formData.title - Form title
     * @param {string} [formData.description] - Form description
     * @param {string} [formData.event] - Event ID (if event-specific)
     * @param {string} [formData.type='general'] - Form type (registration, survey, feedback, etc.)
     * @param {Array<Object>} formData.fields - Array of form field definitions
     * @param {Object} [formData.settings] - Form settings (redirectUrl, submitMessage, etc.)
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created form
     */
    async createForm(formData, options = {}) {
        this._validateRequiredFields(formData, ['title', 'fields']);

        if (!Array.isArray(formData.fields) || formData.fields.length === 0) {
            throw new Error('Form must have at least one field');
        }

        const formToCreate = {
            ...formData,
            type: formData.type || 'general',
            active: true,
            responseCount: 0,
            settings: formData.settings || {}
        };

        return await this.create(formToCreate, options);
    }

    /**
     * Find forms by event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Event forms
     */
    async findByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.find(
            { event: eventId },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Find active forms by event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Active event forms
     */
    async findActiveByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.find(
            { event: eventId, active: true },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Find forms by type
     * 
     * @param {string} type - Form type
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Forms of type
     */
    async findByType(type, options = {}) {
        if (!type) {
            throw new Error('Form type is required');
        }

        return await this.find(
            { type, active: true },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Find global forms (not event-specific)
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Global forms
     */
    async findGlobalForms(options = {}) {
        return await this.find(
            { event: { $exists: false }, active: true },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Update form
     * 
     * @param {string} formId - Form ID
     * @param {Object} updateData - Update data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async updateForm(formId, updateData, options = {}) {
        if (!formId) {
            throw new Error('Form ID is required');
        }

        // Validate fields if being updated
        if (updateData.fields) {
            if (!Array.isArray(updateData.fields) || updateData.fields.length === 0) {
                throw new Error('Form must have at least one field');
            }
        }

        // Prevent updating responseCount directly
        const { responseCount, ...safeUpdateData } = updateData;

        return await this.updateById(formId, safeUpdateData, options);
    }

    /**
     * Increment response count
     * 
     * @param {string} formId - Form ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async incrementResponseCount(formId, options = {}) {
        if (!formId) {
            throw new Error('Form ID is required');
        }

        const form = await this.Model.findByIdAndUpdate(
            formId,
            { $inc: { responseCount: 1 } },
            { new: true, session: options.session }
        ).lean();

        // Manually invalidate cache
        await this._invalidateCache('findById', formId, { entity: form });

        return form;
    }

    /**
     * Activate form
     * 
     * @param {string} formId - Form ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async activateForm(formId, options = {}) {
        if (!formId) {
            throw new Error('Form ID is required');
        }

        return await this.updateById(formId, { active: true }, options);
    }

    /**
     * Deactivate form
     * 
     * @param {string} formId - Form ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async deactivateForm(formId, options = {}) {
        if (!formId) {
            throw new Error('Form ID is required');
        }

        return await this.updateById(formId, { active: false }, options);
    }

    /**
     * Delete form
     * 
     * @param {string} formId - Form ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Deleted form
     */
    async deleteForm(formId, options = {}) {
        if (!formId) {
            throw new Error('Form ID is required');
        }

        return await this.deleteById(formId, options);
    }

    /**
     * Delete all forms for an event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result
     */
    async deleteByEvent(eventId, options = {}) {
        if (!eventId) {
            throw new Error('Event ID is required');
        }

        return await this.deleteMany({ event: eventId }, options);
    }

    /**
     * Add field to form
     * 
     * @param {string} formId - Form ID
     * @param {Object} field - Field definition
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async addField(formId, field, options = {}) {
        if (!formId || !field) {
            throw new Error('Form ID and field are required');
        }

        const form = await this.findById(formId, { skipCache: true });
        
        if (!form) {
            throw new Error('Form not found');
        }

        const updatedFields = [...form.fields, field];
        return await this.updateById(formId, { fields: updatedFields }, options);
    }

    /**
     * Remove field from form
     * 
     * @param {string} formId - Form ID
     * @param {string} fieldName - Name of field to remove
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async removeField(formId, fieldName, options = {}) {
        if (!formId || !fieldName) {
            throw new Error('Form ID and field name are required');
        }

        const form = await this.findById(formId, { skipCache: true });
        
        if (!form) {
            throw new Error('Form not found');
        }

        const updatedFields = form.fields.filter(f => f.name !== fieldName);
        
        if (updatedFields.length === form.fields.length) {
            throw new Error('Field not found');
        }

        if (updatedFields.length === 0) {
            throw new Error('Cannot remove last field from form');
        }

        return await this.updateById(formId, { fields: updatedFields }, options);
    }

    /**
     * Update form settings
     * 
     * @param {string} formId - Form ID
     * @param {Object} settings - New settings
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated form
     */
    async updateSettings(formId, settings, options = {}) {
        if (!formId || !settings) {
            throw new Error('Form ID and settings are required');
        }

        return await this.updateById(formId, { settings }, options);
    }

    /**
     * Get form statistics
     * 
     * @param {string} [eventId] - Optional event ID filter
     * @returns {Promise<Object>} Form statistics
     */
    async getFormStats(eventId = null) {
        const query = eventId ? { event: eventId } : {};

        const [totalForms, activeForms, typeBreakdown, totalResponses] = await Promise.all([
            this.count(query),
            this.count({ ...query, active: true }),
            this.Model.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 }
                    }
                }
            ]),
            this.Model.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$responseCount' }
                    }
                }
            ])
        ]);

        const typeStats = typeBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        return {
            totalForms,
            activeForms,
            inactiveForms: totalForms - activeForms,
            typeBreakdown: typeStats,
            totalResponses: totalResponses[0]?.total || 0
        };
    }

    /**
     * Get most popular forms
     * Based on response count
     * 
     * @param {number} [limit=5] - Number of forms to return
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Most popular forms
     */
    async getMostPopular(limit = 5, options = {}) {
        return await this.find(
            { active: true },
            {
                ...options,
                sort: { responseCount: -1 },
                limit
            }
        );
    }

    /**
     * Find forms with no responses
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Forms with zero responses
     */
    async findWithNoResponses(options = {}) {
        return await this.find(
            { active: true, responseCount: 0 },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Clone form
     * Creates a copy with a new title
     * 
     * @param {string} formId - Source form ID
     * @param {string} newTitle - Title for the cloned form
     * @param {string} [targetEventId] - Optional target event ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Cloned form
     */
    async cloneForm(formId, newTitle, targetEventId = null, options = {}) {
        if (!formId || !newTitle) {
            throw new Error('Form ID and new title are required');
        }

        const sourceForm = await this.findById(formId);
        
        if (!sourceForm) {
            throw new Error('Source form not found');
        }

        const { _id, createdAt, updatedAt, responseCount, ...formData } = sourceForm.toObject();

        const clonedFormData = {
            ...formData,
            title: newTitle,
            event: targetEventId !== null ? targetEventId : formData.event,
            responseCount: 0
        };

        return await this.createForm(clonedFormData, options);
    }

    /**
     * Validate form structure
     * Check if form has all required fields configured correctly
     * 
     * @param {string} formId - Form ID
     * @returns {Promise<Object>} Validation result
     */
    async validateFormStructure(formId) {
        if (!formId) {
            throw new Error('Form ID is required');
        }

        const form = await this.findById(formId);
        
        if (!form) {
            return {
                valid: false,
                errors: ['Form not found']
            };
        }

        const errors = [];

        // Check if form has fields
        if (!form.fields || form.fields.length === 0) {
            errors.push('Form has no fields');
        }

        // Validate each field has required properties
        form.fields.forEach((field, index) => {
            if (!field.name) {
                errors.push(`Field ${index + 1} is missing name`);
            }
            if (!field.type) {
                errors.push(`Field ${index + 1} (${field.name || 'unnamed'}) is missing type`);
            }
            if (!field.label) {
                errors.push(`Field ${index + 1} (${field.name || 'unnamed'}) is missing label`);
            }
        });

        // Check for duplicate field names
        const fieldNames = form.fields.map(f => f.name).filter(Boolean);
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        
        if (duplicates.length > 0) {
            errors.push(`Duplicate field names: ${[...new Set(duplicates)].join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Count forms by type
     * 
     * @param {string} type - Form type
     * @returns {Promise<number>} Form count
     */
    async countByType(type) {
        if (!type) {
            throw new Error('Form type is required');
        }

        return await this.count({ type, active: true });
    }

    /**
     * Search forms by title
     * 
     * @param {string} searchTerm - Search term
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Matching forms
     */
    async searchByTitle(searchTerm, options = {}) {
        if (!searchTerm) {
            throw new Error('Search term is required');
        }

        return await this.find(
            {
                active: true,
                title: { $regex: searchTerm, $options: 'i' }
            },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }
}

export default FormsRepository;
