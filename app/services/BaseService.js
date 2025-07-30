#!/usr/bin/env node
/**
 * Base Service Class
 * 
 * Provides common functionality for all services including:
 * - Error handling
 * - Validation utilities
 * - Transaction management
 * - Logging
 */

import mongoose from 'mongoose';

class BaseService {
    constructor() {
        this.logger = console; // Can be replaced with proper logger
    }

    /**
     * Handle and format errors consistently
     * @param {Error} error - The error to handle
     * @param {String} operation - The operation that failed
     * @param {Object} context - Additional context for the error
     * @param {Boolean} useCleanMessage - If true, uses the original error message without prefix
     * @returns {Error} Formatted error
     */
    _handleError(error, operation, context = {}, useCleanMessage = false) {
        const errorMessage = useCleanMessage ? error.message : `${operation} failed: ${error.message}`;
        const serviceError = new Error(errorMessage);
        
        // Preserve original error properties
        serviceError.originalError = error;
        serviceError.operation = operation;
        serviceError.context = context;
        serviceError.stack = error.stack;
        
        // Add service-specific error codes
        if (error.name === 'ValidationError') {
            serviceError.code = 'VALIDATION_ERROR';
            serviceError.statusCode = 400;
        } else if (error.name === 'CastError') {
            serviceError.code = 'INVALID_ID';
            serviceError.statusCode = 400;
        } else if (error.code === 11000) {
            serviceError.code = 'DUPLICATE_ERROR';
            serviceError.statusCode = 409;
        } else {
            serviceError.code = 'INTERNAL_ERROR';
            serviceError.statusCode = 500;
        }

        this.logger.error(`Service Error - ${operation}:`, {
            message: error.message,
            code: serviceError.code,
            context,
            stack: error.stack
        });

        return serviceError;
    }

    /**
     * Throw an error with clean message (for validation errors expected by tests)
     * @param {String} message - Error message
     * @param {String} operation - Operation context
     * @param {Object} context - Additional context
     * @throws {Error} Clean error message
     */
    _throwCleanError(message, operation, context = {}) {
        const error = new Error(message);
        throw this._handleError(error, operation, context, true);
    }

    /**
     * Validate required fields in data object
     * @param {Object} data - Data to validate
     * @param {Array} requiredFields - Array of required field names
     * @throws {Error} If validation fails
     */
    _validateRequiredFields(data, requiredFields) {
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
    }

    /**
     * Validate ObjectId format
     * @param {String} id - ID to validate
     * @param {String} fieldName - Name of the field for error message
     * @throws {Error} If ID is invalid
     */
    _validateObjectId(id, fieldName = 'ID') {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error(`Invalid ${fieldName} format`);
        }
    }

    /**
     * Validate email format
     * @param {String} email - Email to validate
     * @throws {Error} If email is invalid
     */
    _validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }
    }

    /**
     * Validate date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @throws {Error} If date range is invalid
     */
    _validateDateRange(startDate, endDate) {
        if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
            throw new Error('Start date must be before end date');
        }
    }

    /**
     * Execute operation within a database transaction
     * @param {Function} operation - Operation to execute
     * @param {Object} options - Transaction options
     * @returns {Promise} Result of the operation
     */
    async _withTransaction(operation, options = {}) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction(options);
            const result = await operation(session);
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Sanitize data by removing undefined and null values
     * @param {Object} data - Data to sanitize
     * @returns {Object} Sanitized data
     */
    _sanitizeData(data) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                    sanitized[key] = this._sanitizeData(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        
        return sanitized;
    }

    /**
     * Generate pagination options
     * @param {Number} page - Page number (1-based)
     * @param {Number} limit - Items per page
     * @param {Number} maxLimit - Maximum allowed limit
     * @returns {Object} Pagination options
     */
    _generatePaginationOptions(page = 1, limit = 10, maxLimit = 100) {
        const validPage = Math.max(1, parseInt(page));
        const validLimit = Math.min(maxLimit, Math.max(1, parseInt(limit)));
        const skip = (validPage - 1) * validLimit;

        return {
            page: validPage,
            limit: validLimit,
            skip
        };
    }

    /**
     * Format pagination response
     * @param {Array} items - Items for current page
     * @param {Number} total - Total number of items
     * @param {Number} page - Current page
     * @param {Number} limit - Items per page
     * @returns {Object} Formatted pagination response
     */
    _formatPaginationResponse(items, total, page, limit) {
        const totalPages = Math.ceil(total / limit);
        
        return {
            items,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        };
    }

    /**
     * Log service operation
     * @param {String} operation - Operation name
     * @param {Object} context - Operation context
     * @param {String} level - Log level (info, warn, error)
     */
    _log(operation, context = {}, level = 'info') {
        this.logger[level](`Service Operation - ${operation}:`, context);
    }

    /**
     * Create search filter from query parameters
     * @param {Object} query - Query parameters
     * @param {Array} searchableFields - Fields that can be searched
     * @returns {Object} MongoDB filter object
     */
    _createSearchFilter(query, searchableFields = []) {
        const filter = {};
        
        // Handle search term across multiple fields
        if (query.search && searchableFields.length > 0) {
            const searchRegex = new RegExp(query.search, 'i');
            filter.$or = searchableFields.map(field => ({
                [field]: { $regex: searchRegex }
            }));
        }

        // Handle date range filters
        if (query.startDate || query.endDate) {
            filter.createdAt = {};
            if (query.startDate) {
                filter.createdAt.$gte = new Date(query.startDate);
            }
            if (query.endDate) {
                filter.createdAt.$lte = new Date(query.endDate);
            }
        }

        // Handle status filter
        if (query.status) {
            filter.status = query.status;
        }

        // Handle active/inactive filter
        if (query.isActive !== undefined) {
            filter.isActive = query.isActive === 'true';
        }

        return filter;
    }
}

export default BaseService;
