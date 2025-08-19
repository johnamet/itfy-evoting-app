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
     * Send success response with pagination metadata
     * @param {Object} res - Express response object
     * @param {Object} data - Response data
     * @param {String} message - Success message
     * @param {Object} meta - Metadata (pagination, etc.)
     * @param {Number} statusCode - HTTP status code
     */
    sendSuccessWithMeta(res, data = null, message = 'Success', meta = {}, statusCode = 200) {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString(),
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        };

        if (data !== null) {
            response.data = data;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {Array} data - Response data array
     * @param {Number} page - Current page
     * @param {Number} limit - Items per page
     * @param {Number} total - Total count
     * @param {String} message - Success message
     */
    sendPaginatedResponse(res, data, page, limit, total, message = 'Data retrieved successfully') {
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        return this.sendSuccessWithMeta(res, data, message, {
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext,
                hasPrev
            }
        });
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
            timestamp: new Date().toISOString(),
            requestId: res.locals?.requestId || this.generateRequestId()
        };

        if (data !== null) {
            response.data = data;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send file download response with standardized headers
     * @param {Object} res - Express response object
     * @param {String|Buffer} data - File data
     * @param {String} filename - Download filename
     * @param {String} contentType - MIME type
     * @param {String} message - Success message
     */
    sendFileDownload(res, data, filename, contentType = 'application/octet-stream', message = 'File exported successfully') {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Success-Message', message);
        res.setHeader('X-Export-Timestamp', new Date().toISOString());
        
        return res.send(data);
    }

    /**
     * Send CSV download response
     * @param {Object} res - Express response object
     * @param {String} csvData - CSV content
     * @param {String} filename - Download filename
     * @param {String} message - Success message
     */
    sendCSVDownload(res, csvData, filename, message = 'CSV exported successfully') {
        return this.sendFileDownload(res, csvData, filename, 'text/csv', message);
    }

    /**
     * Send JSON download response
     * @param {Object} res - Express response object
     * @param {Object} jsonData - JSON content
     * @param {String} filename - Download filename
     * @param {String} message - Success message
     */
    sendJSONDownload(res, jsonData, filename, message = 'JSON exported successfully') {
        const jsonString = JSON.stringify(jsonData, null, 2);
        return this.sendFileDownload(res, jsonString, filename, 'application/json', message);
    }

    /**
     * Send export response (supports both inline and download)
     * @param {Object} res - Express response object
     * @param {Object|String} data - Export data
     * @param {String} format - Export format ('json' or 'csv')
     * @param {String} filename - Base filename (without extension)
     * @param {Boolean} download - Whether to force download
     * @param {Object} metadata - Additional metadata
     */
    sendExportResponse(res, data, format = 'json', filename = 'export', download = true, metadata = {}) {
        const timestamp = new Date().toISOString();
        const fullFilename = `${filename}.${format}`;

        if (format === 'csv') {
            if (download) {
                return this.sendCSVDownload(res, data, fullFilename);
            } else {
                res.setHeader('Content-Type', 'text/csv');
                return res.send(data);
            }
        } else {
            // JSON format
            const responseData = {
                success: true,
                message: 'Export completed successfully',
                timestamp,
                requestId: res.locals?.requestId || this.generateRequestId(),
                export: {
                    format,
                    filename: fullFilename,
                    generatedAt: timestamp,
                    ...metadata
                },
                data
            };

            if (download) {
                return this.sendJSONDownload(res, responseData, fullFilename);
            } else {
                return res.json(responseData);
            }
        }
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
            error: {
                message,
                code: this.getErrorCode(statusCode),
                statusCode
            },
            timestamp: new Date().toISOString(),
            requestId: res.locals?.requestId || this.generateRequestId()
        };

        if (details) {
            response.error.details = details;
        }

        console.error(`[${this.name}] Error: ${message}`, details);
        return res.status(statusCode).json(response);
    }

    /**
     * Get error code based on status code
     * @param {Number} statusCode - HTTP status code
     * @returns {String} Error code
     */
    getErrorCode(statusCode) {
        const errorCodes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED', 
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'VALIDATION_ERROR',
            429: 'RATE_LIMITED',
            500: 'INTERNAL_SERVER_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE'
        };
        return errorCodes[statusCode] || 'UNKNOWN_ERROR';
    }

    /**
     * Generate unique request ID
     * @returns {String} Request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
     * Validate request parameters with detailed validation
     * @param {Object} req - Express request object
     * @param {Array} requiredParams - Array of required parameter names
     * @param {Object} validationRules - Validation rules for parameters
     * @returns {Object|null} Validation error object or null if valid
     */
    validateRequiredParams(req, requiredParams, validationRules = {}) {
        const missing = [];
        const invalid = [];

        for (const param of requiredParams) {
            const value = req.body[param] || req.params[param] || req.query[param];
            
            if (value === undefined || value === null || value === '') {
                missing.push(param);
                continue;
            }

            // Apply validation rules if provided
            if (validationRules[param]) {
                const rule = validationRules[param];
                
                if (rule.type === 'email' && !this.isValidEmail(value)) {
                    invalid.push({ param, message: 'Invalid email format' });
                }
                
                if (rule.type === 'number' && isNaN(value)) {
                    invalid.push({ param, message: 'Must be a valid number' });
                }
                
                if (rule.minLength && value.length < rule.minLength) {
                    invalid.push({ param, message: `Must be at least ${rule.minLength} characters` });
                }
                
                if (rule.maxLength && value.length > rule.maxLength) {
                    invalid.push({ param, message: `Must be no more than ${rule.maxLength} characters` });
                }
                
                if (rule.pattern && !rule.pattern.test(value)) {
                    invalid.push({ param, message: rule.message || 'Invalid format' });
                }
            }
        }

        if (missing.length > 0 || invalid.length > 0) {
            return {
                message: 'Validation failed',
                missing,
                invalid
            };
        }

        return null;
    }

    /**
     * Validate email format
     * @param {String} email - Email to validate
     * @returns {Boolean} True if valid email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate ObjectId format (MongoDB)
     * @param {String} id - ID to validate
     * @returns {Boolean} True if valid ObjectId
     */
    isValidObjectId(id) {
        const objectIdRegex = /^[0-9a-fA-F]{24}$/;
        return objectIdRegex.test(id);
    }

    /**
     * Sanitize input to prevent XSS
     * @param {String} input - Input to sanitize
     * @returns {String} Sanitized input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    }

    /**
     * Parse pagination parameters
     * @param {Object} query - Query parameters
     * @returns {Object} Parsed pagination object
     */
    parsePagination(query) {
        const page = Math.max(1, parseInt(query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
        const skip = (page - 1) * limit;
        
        return { page, limit, skip };
    }

    /**
     * Validate request parameters
     * @param {Object} req - Express request object
     * @param {Array} requiredParams - Array of required parameter names
     * @returns {Object|null} Validation error object or null if valid
     */
    validateRequiredParamsOld(req, requiredParams) {
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
