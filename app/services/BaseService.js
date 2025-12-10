#!/usr/bin/env node
/**
 * BaseService
 * 
 * Foundation for all service classes with:
 * - Repository injection pattern
 * - Settings-aware operations
 * - Comprehensive error handling
 * - Transaction support
 * - Logging and audit trail
 * - Validation utilities
 * 
 * @module services/BaseService
 * @version 2.0.0
 */

import config from '../config/ConfigManager.js';

class BaseService {
    /**
     * @param {Object} repositories - Injected repositories { user: userRepository, event: eventRepository, ... }
     * @param {Object} [options={}] - Service configuration
     */
    constructor(repositories = {}, options = {}) {
        this.repositories = repositories;
        this.options = options;
        this.serviceName = this.constructor.name;
        this._settingsCache = new Map();
        this._settingsCacheTTL = 60000; // 1 minute
    }

    // ================================
    // REPOSITORY ACCESS
    // ================================

    /**
     * Get repository by name
     * @param {string} name - Repository name
     * @returns {Object} Repository instance
     */
    repo(name) {
        const repository = this.repositories[name];
        if (!repository) {
            throw new Error(`Repository '${name}' not found in ${this.serviceName}`);
        }
        return repository;
    }

    /**
     * Check if repository exists
     * @param {string} name - Repository name
     * @returns {boolean}
     */
    hasRepo(name) {
        return !!this.repositories[name];
    }

    // ================================
    // SETTINGS MANAGEMENT
    // ================================

    /**
     * Get setting value with caching
     * @param {string} key - Setting key
     * @param {*} [defaultValue] - Default value if not found
     * @returns {Promise<*>} Setting value
     */
    async getSetting(key, defaultValue = null) {
        try {
            // Check cache
            const cached = this._settingsCache.get(key);
            if (cached && (Date.now() - cached.timestamp) < this._settingsCacheTTL) {
                return cached.value;
            }

            // Fetch from settings repository
            if (!this.hasRepo('settings')) {
                this.log('warn', `Settings repository not available, using default for: ${key}`);
                return defaultValue;
            }

            const value = await this.repo('settings').getValue(key, defaultValue);
            
            // Cache the value
            this._settingsCache.set(key, {
                value,
                timestamp: Date.now()
            });

            return value;
        } catch (error) {
            this.log('error', `Failed to get setting ${key}: ${error.message}`);
            return defaultValue;
        }
    }

    /**
     * Get multiple settings at once
     * @param {Array<string>} keys - Setting keys
     * @returns {Promise<Object>} Settings object
     */
    async getSettings(keys) {
        const settings = {};
        for (const key of keys) {
            settings[key] = await this.getSetting(key);
        }
        return settings;
    }

    /**
     * Clear settings cache
     */
    clearSettingsCache() {
        this._settingsCache.clear();
    }

    // ================================
    // TRANSACTION SUPPORT
    // ================================

    /**
     * Execute operations within a database transaction
     * @param {Function} callback - Async function to execute
     * @param {Object} [options={}] - Transaction options
     * @returns {Promise<*>} Result from callback
     */
    async withTransaction(callback, options = {}) {
        const db = await import('mongoose').then(m => m.default);
        const session = await db.startSession();
        
        try {
            session.startTransaction();
            
            const result = await callback(session);
            
            await session.commitTransaction();
            
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // ================================
    // VALIDATION UTILITIES
    // ================================

    /**
     * Validate required fields
     * @param {Object} data - Data to validate
     * @param {Array<string>} fields - Required field names
     * @throws {Error} If validation fails
     */
    validateRequiredFields(data, fields) {
        const missing = [];
        
        for (const field of fields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean}
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean}
     */
    validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} { valid: boolean, errors: Array<string> }
     */
    validatePassword(password) {
        const errors = [];

        if (!password || password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize string input (prevent XSS)
     * @param {string} input - Input to sanitize
     * @returns {string} Sanitized input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '')
            .trim();
    }

    // ================================
    // ERROR HANDLING
    // ================================

    /**
     * Create standardized error response
     * @param {Error|string} error - Error object or message
     * @param {string} [context] - Error context
     * @returns {Object} Error response
     */
    handleError(error, context = '') {
        const errorMessage = error instanceof Error ? error.message : error;
        const errorStack = error instanceof Error ? error.stack : undefined;

        this.log('error', `${context ? context + ': ' : ''}${errorMessage}`, { stack: errorStack });

        return {
            success: false,
            error: errorMessage,
            context: context || undefined,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create standardized success response
     * @param {*} data - Response data
     * @param {string} [message] - Success message
     * @returns {Object} Success response
     */
    handleSuccess(data, message = 'Operation successful') {
        return {
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    // ================================
    // LOGGING
    // ================================

    /**
     * Log message with context
     * @param {string} level - Log level (info, warn, error, debug)
     * @param {string} message - Log message
     * @param {Object} [meta={}] - Additional metadata
     */
    log(level, message, meta = {}) {
        const logEntry = {
            service: this.serviceName,
            level,
            message,
            timestamp: new Date().toISOString(),
            ...meta
        };

        // Use appropriate console method
        switch (level) {
            case 'error':
                console.error(`[${this.serviceName}] ERROR:`, message, meta);
                break;
            case 'warn':
                console.warn(`[${this.serviceName}] WARN:`, message, meta);
                break;
            case 'debug':
                if (config.get('env') === 'development') {
                    console.debug(`[${this.serviceName}] DEBUG:`, message, meta);
                }
                break;
            default:
                console.log(`[${this.serviceName}] INFO:`, message, meta);
        }

        // Log to activity repository if available
        if (this.hasRepo('activity') && level === 'error') {
            this.repo('activity').logActivity({
                action: 'service_error',
                resource: this.serviceName,
                metadata: { message, ...meta }
            }).catch(err => {
                console.error('Failed to log to activity repository:', err);
            });
        }
    }

    /**
     * Log activity (user action tracking)
     * @param {string} userId - User ID
     * @param {string} action - Action performed
     * @param {string} resource - Resource affected
     * @param {Object} [metadata={}] - Additional data
     */
    async logActivity(userId, action, resource, metadata = {}) {
        if (!this.hasRepo('activity')) return;

        try {
            await this.repo('activity').logActivity({
                user: userId,
                action,
                resource,
                metadata,
                ip: metadata.ip,
                userAgent: metadata.userAgent
            });
        } catch (error) {
            this.log('error', `Failed to log activity: ${error.message}`);
        }
    }

    // ================================
    // PAGINATION HELPERS
    // ================================

    /**
     * Parse pagination parameters
     * @param {Object} query - Query parameters
     * @returns {Object} { page, limit, skip }
     */
    parsePagination(query) {
        const page = Math.max(1, parseInt(query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
        const skip = (page - 1) * limit;

        return { page, limit, skip };
    }

    /**
     * Create paginated response
     * @param {Array} data - Data items
     * @param {number} total - Total count
     * @param {number} page - Current page
     * @param {number} limit - Items per page
     * @returns {Object} Paginated response
     */
    createPaginatedResponse(data, total, page, limit) {
        const totalPages = Math.ceil(total / limit);

        return {
            success: true,
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    }

    // ================================
    // DATE/TIME UTILITIES
    // ================================

    /**
     * Check if date is in the past
     * @param {Date|string} date - Date to check
     * @returns {boolean}
     */
    isDatePast(date) {
        return new Date(date) < new Date();
    }

    /**
     * Check if date is in the future
     * @param {Date|string} date - Date to check
     * @returns {boolean}
     */
    isDateFuture(date) {
        return new Date(date) > new Date();
    }

    /**
     * Add days to date
     * @param {Date} date - Base date
     * @param {number} days - Days to add
     * @returns {Date}
     */
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Get date range for queries
     * @param {string} period - Period (today, week, month, year)
     * @returns {Object} { startDate, endDate }
     */
    getDateRange(period) {
        const now = new Date();
        const startDate = new Date(now);
        const endDate = new Date(now);

        switch (period) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                throw new Error(`Invalid period: ${period}`);
        }

        return { startDate, endDate };
    }

    // ================================
    // ASYNC UTILITIES
    // ================================

    /**
     * Run operation with context (error boundary)
     * @param {Object} context - Operation context
     * @param {Function} callback - Async operation
     * @returns {Promise<*>}
     */
    async runInContext(context, callback) {
        const startTime = Date.now();
        
        try {
            this.log('debug', `Starting operation: ${context.action || 'unknown'}`, context);
            
            const result = await callback();
            
            const duration = Date.now() - startTime;
            this.log('debug', `Completed operation: ${context.action || 'unknown'}`, { ...context, duration });
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.log('error', `Failed operation: ${context.action || 'unknown'}`, { 
                ...context, 
                duration,
                error: error.message 
            });
            
            throw error;
        }
    }

    /**
     * Retry operation with exponential backoff
     * @param {Function} operation - Async operation to retry
     * @param {Object} [options={}] - Retry options
     * @returns {Promise<*>}
     */
    async retry(operation, options = {}) {
        const {
            maxAttempts = 3,
            initialDelay = 1000,
            maxDelay = 10000,
            factor = 2
        } = options;

        let lastError;
        let delay = initialDelay;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    this.log('warn', `Retry attempt ${attempt} failed, retrying in ${delay}ms`, { error: error.message });
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay = Math.min(delay * factor, maxDelay);
                } else {
                    this.log('error', `All ${maxAttempts} retry attempts failed`, { error: error.message });
                }
            }
        }

        throw lastError;
    }

    // ================================
    // BATCH OPERATIONS
    // ================================

    /**
     * Process items in batches
     * @param {Array} items - Items to process
     * @param {Function} processor - Async function to process each item
     * @param {number} [batchSize=10] - Batch size
     * @returns {Promise<Array>} Results
     */
    async processBatch(items, processor, batchSize = 10) {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(item => processor(item).catch(error => ({ error: error.message })))
            );
            results.push(...batchResults);
        }

        return results;
    }
}

export default BaseService;
