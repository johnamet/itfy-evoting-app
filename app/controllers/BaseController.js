#!/usr/bin/env node
/**
 * Base Controller
 * 
 * Provides common functionality for all controllers including
 * error handling, response formatting, and logging.
 */

class BaseController {
    constructor() {
        this.name = this.constructor.name;
    }

    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {Object} data - Response data
     * @param {String} message - Success message
     * @param {Number} statusCode - HTTP status code
     */
    sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString()
        };

        if (data !== null) {
            response.data = data;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {String} message - Error message
     * @param {Number} statusCode - HTTP status code
     * @param {Object} details - Additional error details
     */
    sendError(res, message = 'Internal Server Error', statusCode = 500, details = null) {
        const response = {
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        };

        if (details) {
            response.details = details;
        }

        console.error(`[${this.name}] Error: ${message}`, details);
        return res.status(statusCode).json(response);
    }

    /**
     * Handle service errors and send appropriate response
     * @param {Object} res - Express response object
     * @param {Error} error - Error object
     * @param {String} operation - Operation being performed
     */
    handleError(res, error, operation = 'operation') {
        return this.handleServiceError(res, error, operation);
    }

    /**
     * Handle service errors and send appropriate response
     * @param {Object} res - Express response object
     * @param {Error} error - Error object
     * @param {String} operation - Operation being performed
     */
    handleServiceError(res, error, operation = 'operation') {
        console.error(`[${this.name}] Service error during ${operation}:`, error);

        if (error.message.includes('not found') || error.message.includes('No active form')) {
            return this.sendError(res, error.message, 404);
        }

        if (error.message.includes('validation') || error.message.includes('required') || 
            error.message.includes('invalid') || error.message.includes('must be')) {
            return this.sendError(res, error.message, 400);
        }

        if (error.message.includes('unauthorized') || error.message.includes('permission')) {
            return this.sendError(res, error.message, 403);
        }

        return this.sendError(res, 'An unexpected error occurred', 500, {
            operation,
            originalError: error.message
        });
    }

    /**
     * Validate request parameters
     * @param {Object} req - Express request object
     * @param {Array} requiredParams - Array of required parameter names
     * @returns {Object|null} Validation error object or null if valid
     */
    validateRequiredParams(req, requiredParams) {
        const missing = [];

        for (const param of requiredParams) {
            if (req.body[param] === undefined && req.params[param] === undefined && req.query[param] === undefined) {
                missing.push(param);
            }
        }

        if (missing.length > 0) {
            return {
                message: `Missing required parameters: ${missing.join(', ')}`,
                missing
            };
        }

        return null;
    }

    /**
     * Extract user ID from request (assuming authentication middleware sets it)
     * @param {Object} req - Express request object
     * @returns {String|null} User ID or null if not found
     */
    getUserId(req) {
        return req.user?.id || req.user?._id || req.userId || null;
    }

    /**
     * Log controller activity
     * @param {String} action - Action being performed
     * @param {Object} data - Additional data to log
     */
    log(action, data = {}) {
        console.log(`[${this.name}] ${action}:`, data);
    }
}

export default BaseController;
