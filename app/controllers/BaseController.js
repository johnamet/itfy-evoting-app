#!/usr/bin/env node
/**
 * BaseController
 * 
 * Foundation for all controllers with:
 * - Standardized response formatting
 * - Request parsing utilities
 * - Input validation helpers
 * - Error handling
 * - Authentication/authorization helpers
 * - Pagination support
 * - File upload handling
 * 
 * @module controllers/BaseController
 * @version 2.0.0
 */

import config from '../config/ConfigManager.js';
import logger, { Logger } from '../utils/Logger.js';

class BaseController {
    constructor() {
        this.controllerName = this.constructor.name;
    }

    // ================================
    // SUCCESS RESPONSE METHODS
    // ================================

    sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    sendCreated(res, data, message = 'Resource created successfully') {
        return this.sendSuccess(res, data, message, 201);
    }

    sendNoContent(res) {
        return res.status(204).send();
    }

    sendPaginatedResponse(res, data, pagination, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination: {
                total: pagination.total,
                page: pagination.page,
                limit: pagination.limit,
                totalPages: Math.ceil(pagination.total / pagination.limit),
                hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
                hasPreviousPage: pagination.page > 1
            },
            timestamp: new Date().toISOString()
        });
    }

    // ================================
    // ERROR RESPONSE METHODS
    // ================================

    sendError(res, error, statusCode = 500) {
        const errorMessage = error instanceof Error ? error.message : error;
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Log error with context
        const req = res.req; // Express attaches req to res
        logger.error(errorMessage, {
            controller: this.controllerName,
            error,
            statusCode,
            correlationId: req?.correlationId || Logger.getCorrelationId(),
            path: req?.path,
            method: req?.method,
            userId: req?.user?.userId
        });

        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            ...(config.get('env') === 'development' && errorStack && { stack: errorStack }),
            timestamp: new Date().toISOString()
        });
    }

    sendBadRequest(res, message, errors = []) {
        return res.status(400).json({
            success: false,
            error: message,
            ...(errors.length > 0 && { errors }),
            timestamp: new Date().toISOString()
        });
    }

    sendUnauthorized(res, message = 'Unauthorized - Authentication required') {
        return res.status(401).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    sendForbidden(res, message = 'Forbidden - Insufficient permissions') {
        return res.status(403).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    sendNotFound(res, message = 'Resource not found') {
        return res.status(404).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    sendConflict(res, message) {
        return res.status(409).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    sendValidationError(res, errors) {
        return res.status(422).json({
            success: false,
            error: 'Validation failed',
            errors: errors.map(err => ({
                field: err.param || err.path || err.field,
                message: err.msg || err.message,
                value: err.value
            })),
            timestamp: new Date().toISOString()
        });
    }

    // ================================
    // REQUEST PARSING METHODS
    // ================================

    getRequestBody(req) {
        return req.body || {};
    }

    getRequestParams(req) {
        return req.params || {};
    }

    getRequestQuery(req) {
        return req.query || {};
    }

    getRequestHeaders(req) {
        return req.headers || {};
    }

    getRequestUser(req) {
        return req.user || null;
    }

    getUserId(req) {
        return req.user?.userId || req.user?._id || req.user?.id || null;
    }

    getRequestIP(req) {
        return req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0] || 
               req.connection?.remoteAddress || 
               'unknown';
    }

    getRequestUserAgent(req) {
        return req.headers['user-agent'] || 'unknown';
    }

    getRequestMetadata(req) {
        return {
            ip: this.getRequestIP(req),
            userAgent: this.getRequestUserAgent(req),
            userId: this.getUserId(req),
            timestamp: new Date()
        };
    }

    // ================================
    // PAGINATION METHODS
    // ================================

    getPagination(req, defaults = {}) {
        const page = Math.max(1, parseInt(req.query.page) || defaults.page || 1);
        const limit = Math.min(
            100, 
            Math.max(1, parseInt(req.query.limit) || defaults.limit || 10)
        );
        const skip = (page - 1) * limit;

        return { page, limit, skip };
    }

    getSortOptions(req, defaultSort = { createdAt: -1 }) {
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        if (!sortBy) {
            return defaultSort;
        }

        return { [sortBy]: sortOrder };
    }

    getFilterOptions(req, allowedFilters = []) {
        const filters = {};
        const query = this.getRequestQuery(req);

        for (const field of allowedFilters) {
            if (query[field] !== undefined) {
                filters[field] = query[field];
            }
        }

        return filters;
    }

    // ================================
    // VALIDATION METHODS
    // ================================

    validateRequiredFields(data, fields) {
        const missing = [];
        
        for (const field of fields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                missing.push(field);
            }
        }

        return missing;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateMongoId(id) {
        return /^[0-9a-fA-F]{24}$/.test(id);
    }

    validateDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return !isNaN(start.getTime()) && 
               !isNaN(end.getTime()) && 
               start < end;
    }

    validateFileUpload(file, options = {}) {
        const {
            maxSize = 5 * 1024 * 1024,
            allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'],
            required = true
        } = options;

        if (!file) {
            return {
                valid: !required,
                error: required ? 'File is required' : null
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File size must not exceed ${maxSize / (1024 * 1024)}MB`
            };
        }

        if (!allowedTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
            };
        }

        return { valid: true, error: null };
    }

    isValidInteger(value) {
        return Number.isInteger(Number(value));
    }

    isValidBoolean(value) {
        return value === true || value === false || 
               value === 'true' || value === 'false';
    }

    isValidDate(value) {
        const date = new Date(value);
        return !isNaN(date.getTime());
    }

    isValidEnum(value, allowedValues) {
        return allowedValues.includes(value);
    }

    // ================================
    // AUTHORIZATION METHODS
    // ================================

    requireRole(req, roles) {
        const user = this.getRequestUser(req);
        
        if (!user) {
            return false;
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        return allowedRoles.includes(user.role);
    }

    requireLevel(req, minLevel) {
        const user = this.getRequestUser(req);
        return user && user.level >= minLevel;
    }

    requireOwnership(req, resourceOwnerId) {
        const userId = this.getUserId(req);
        return userId && userId.toString() === resourceOwnerId.toString();
    }

    isAdmin(req) {
        return this.requireRole(req, ['admin', 'super-admin']);
    }

    isSuperAdmin(req) {
        return this.requireRole(req, 'super-admin');
    }

    canModifyResource(req, resourceOwnerId) {
        return this.isAdmin(req) || this.requireOwnership(req, resourceOwnerId);
    }

    // ================================
    // ASYNC HANDLER WRAPPER
    // ================================

    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    bindAsyncHandler(fn) {
        return this.asyncHandler(fn.bind(this));
    }

    // ================================
    // FILE UPLOAD HELPERS
    // ================================

    async handleFileUpload(req, res, uploadMiddleware, options = {}) {
        return new Promise((resolve, reject) => {
            uploadMiddleware(req, res, (error) => {
                if (error) {
                    this.sendBadRequest(res, error.message);
                    return resolve(false);
                }

                if (req.file) {
                    const validation = this.validateFileUpload(req.file, options);
                    if (!validation.valid) {
                        this.sendBadRequest(res, validation.error);
                        return resolve(false);
                    }
                }

                resolve(true);
            });
        });
    }

    async cleanupFailedUpload(filePath) {
        try {
            const fs = await import('fs/promises');
            await fs.unlink(filePath);
        } catch (error) {
            logger.error('Failed to cleanup file', {
                controller: this.controllerName,
                error,
                filePath
            });
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================

    sanitizeUser(user) {
        if (!user) return null;

        const sanitized = user.toObject ? user.toObject() : { ...user };
        delete sanitized.password;
        delete sanitized.__v;
        delete sanitized.loginAttempts;
        delete sanitized.lockedUntil;

        return sanitized;
    }

    log(level, message, metadata = {}) {
        logger.log(level, message, {
            controller: this.controllerName,
            ...metadata
        });
    }

    /**
     * Get child logger with controller context
     * @returns {Object} Child logger instance
     */
    getLogger() {
        return logger.child({ controller: this.controllerName });
    }

    generateRequestId() {
        return Logger.generateCorrelationId();
    }
}

export default BaseController;
