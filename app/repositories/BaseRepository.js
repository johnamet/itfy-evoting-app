#!/usr/bin/env node
/**
 * Base Repository
 * 
 * This abstract class provides common database operations that can be extended by specific repositories.
 * It includes CRUD operations, pagination, filtering, and transaction support.
 */

import mongoose from 'mongoose';

class BaseRepository {
    
    /**
     * Constructor for BaseRepository
     * @param {mongoose.Model} model - The Mongoose model to use for database operations
     */
    constructor(model) {
        if (new.target === BaseRepository) {
            throw new Error("BaseRepository is an abstract class and cannot be instantiated directly.");
        }
        if (!model) {
            throw new Error("Model is required for repository initialization.");
        }
        this.model = model;
    }

    /**
     * Create a new document
     * @param {Object} data - Data for the new document
     * @param {Object} options - Additional options (e.g., session for transactions)
     * @returns {Promise<Object>} Created document
     */
    async create(data, options = {}) {
        try {
            const document = new this.model(data);
            return await document.save(options);
        } catch (error) {
            throw this._handleError(error, 'create');
        }
    }

    /**
     * Create multiple documents
     * @param {Array} dataArray - Array of data objects
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Array of created documents
     */
    async createMany(dataArray, options = {}) {
        try {
            return await this.model.insertMany(dataArray, options);
        } catch (error) {
            throw this._handleError(error, 'createMany');
        }
    }

    /**
     * Find a document by ID
     * @param {String|ObjectId} id - Document ID
     * @param {Object} options - Query options (populate, select, etc.)
     * @returns {Promise<Object|null>} Found document or null
     */
    async findById(id, options = {}) {
        try {
            let query = this.model.findById(id);
            
            if (options.populate) {
                query = query.populate(options.populate);
            }
            if (options.select) {
                query = query.select(options.select);
            }
            
            return await query.exec();
        } catch (error) {
            throw this._handleError(error, 'findById');
        }
    }

    /**
     * Find one document by criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} Found document or null
     */
    async findOne(criteria = {}, options = {}) {
        try {
            let query = this.model.findOne(criteria);
            
            if (options.populate) {
                query = query.populate(options.populate);
            }
            if (options.select) {
                query = query.select(options.select);
            }
            if (options.sort) {
                query = query.sort(options.sort);
            }
            
            return await query.exec();
        } catch (error) {
            throw this._handleError(error, 'findOne');
        }
    }

    /**
     * Find multiple documents
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of found documents
     */
    async find(criteria = {}, options = {}) {
        try {
            let query = this.model.find(criteria);
            
            if (options.populate) {
                query = query.populate(options.populate);
            }
            if (options.select) {
                query = query.select(options.select);
            }
            if (options.sort) {
                query = query.sort(options.sort);
            }
            if (options.limit) {
                query = query.limit(options.limit);
            }
            if (options.skip) {
                query = query.skip(options.skip);
            }
            
            return await query.exec();
        } catch (error) {
            throw this._handleError(error, 'find');
        }
    }

    /**
     * Find documents with pagination
     * @param {Object} criteria - Search criteria
     * @param {Number} page - Page number (1-based)
     * @param {Number} limit - Number of documents per page
     * @param {Object} options - Additional query options
     * @returns {Promise<Object>} Paginated result with docs, total, page, limit, pages
     */
    async findWithPagination(criteria = {}, page = 1, limit = 10, options = {}) {
        try {
            const skip = (page - 1) * limit;
            const sort = options.sort || { createdAt: -1 };
            
            const [docs, total] = await Promise.all([
                this.find(criteria, { ...options, skip, limit, sort }),
                this.countDocuments(criteria)
            ]);
            
            return {
                docs,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            };
        } catch (error) {
            throw this._handleError(error, 'findWithPagination');
        }
    }

    /**
     * Update a document by ID
     * @param {String|ObjectId} id - Document ID
     * @param {Object} updateData - Data to update
     * @param {Object} options - Update options
     * @returns {Promise<Object|null>} Updated document or null
     */
    async updateById(id, updateData, options = {}) {
        try {
            const defaultOptions = {
                new: true, // Return updated document
                runValidators: true // Run schema validators
            };
            
            return await this.model.findByIdAndUpdate(
                id,
                { ...updateData, updatedAt: new Date() },
                { ...defaultOptions, ...options }
            );
        } catch (error) {
            throw this._handleError(error, 'updateById');
        }
    }

    /**
     * Update one document by criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} updateData - Data to update
     * @param {Object} options - Update options
     * @returns {Promise<Object|null>} Updated document or null
     */
    async updateOne(criteria, updateData, options = {}) {
        try {
            const defaultOptions = {
                new: true,
                runValidators: true
            };
            
            return await this.model.findOneAndUpdate(
                criteria,
                { ...updateData, updatedAt: new Date() },
                { ...defaultOptions, ...options }
            );
        } catch (error) {
            throw this._handleError(error, 'updateOne');
        }
    }

    /**
     * Update multiple documents
     * @param {Object} criteria - Search criteria
     * @param {Object} updateData - Data to update
     * @param {Object} options - Update options
     * @returns {Promise<Object>} Update result
     */
    async updateMany(criteria, updateData, options = {}) {
        try {
            return await this.model.updateMany(
                criteria,
                { ...updateData, updatedAt: new Date() },
                { runValidators: true, ...options }
            );
        } catch (error) {
            throw this._handleError(error, 'updateMany');
        }
    }

    /**
     * Delete a document by ID
     * @param {String|ObjectId} id - Document ID
     * @param {Object} options - Delete options
     * @returns {Promise<Object|null>} Deleted document or null
     */
    async deleteById(id, options = {}) {
        try {
            return await this.model.findByIdAndDelete(id, options);
        } catch (error) {
            throw this._handleError(error, 'deleteById');
        }
    }

    /**
     * Delete one document by criteria
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Delete options
     * @returns {Promise<Object|null>} Deleted document or null
     */
    async deleteOne(criteria, options = {}) {
        try {
            return await this.model.findOneAndDelete(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'deleteOne');
        }
    }

    /**
     * Delete multiple documents
     * @param {Object} criteria - Search criteria
     * @param {Object} options - Delete options
     * @returns {Promise<Object>} Delete result
     */
    async deleteMany(criteria = {}, options = {}) {
        try {
            return await this.model.deleteMany(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'deleteMany');
        }
    }

    /**
     * Count documents matching criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Number>} Count of documents
     */
    async countDocuments(criteria = {}) {
        try {
            return await this.model.countDocuments(criteria);
        } catch (error) {
            throw this._handleError(error, 'countDocuments');
        }
    }

    /**
     * Check if document exists
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Boolean>} True if document exists
     */
    async exists(criteria) {
        try {
            const doc = await this.model.exists(criteria);
            return !!doc;
        } catch (error) {
            throw this._handleError(error, 'exists');
        }
    }

    /**
     * Perform aggregation query
     * @param {Array} pipeline - Aggregation pipeline
     * @param {Object} options - Aggregation options
     * @returns {Promise<Array>} Aggregation result
     */
    async aggregate(pipeline = [], options = {}) {
        try {
            return await this.model.aggregate(pipeline, options);
        } catch (error) {
            throw this._handleError(error, 'aggregate');
        }
    }

    /**
     * Find distinct values for a field
     * @param {String} field - Field name
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} Array of distinct values
     */
    async distinct(field, criteria = {}) {
        try {
            return await this.model.distinct(field, criteria);
        } catch (error) {
            throw this._handleError(error, 'distinct');
        }
    }

    /**
     * Start a session for transactions
     * @returns {Promise<ClientSession>} Mongoose session
     */
    async startSession() {
        try {
            return await mongoose.startSession();
        } catch (error) {
            throw this._handleError(error, 'startSession');
        }
    }

    /**
     * Execute a function within a transaction
     * @param {Function} fn - Function to execute within transaction
     * @param {Object} options - Transaction options
     * @returns {Promise<any>} Result of the function
     */
    async withTransaction(fn, options = {}) {
        const session = await this.startSession();
        try {
            return await session.withTransaction(fn, options);
        } finally {
            await session.endSession();
        }
    }

    /**
     * Bulk operations
     * @param {Array} operations - Array of bulk operations
     * @param {Object} options - Bulk options
     * @returns {Promise<Object>} Bulk operation result
     */
    async bulkWrite(operations, options = {}) {
        try {
            return await this.model.bulkWrite(operations, options);
        } catch (error) {
            throw this._handleError(error, 'bulkWrite');
        }
    }

    /**
     * Search with text index
     * @param {String} searchText - Text to search
     * @param {Object} criteria - Additional search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Search results
     */
    async textSearch(searchText, criteria = {}, options = {}) {
        try {
            const searchCriteria = {
                ...criteria,
                $text: { $search: searchText }
            };
            
            return await this.find(searchCriteria, {
                ...options,
                sort: { score: { $meta: "textScore" } }
            });
        } catch (error) {
            throw this._handleError(error, 'textSearch');
        }
    }

    /**
     * Get model statistics
     * @returns {Promise<Object>} Model statistics
     */
    async getStats() {
        try {
            const total = await this.countDocuments();
            const recentCount = await this.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            });
            
            return {
                total,
                recentCount,
                modelName: this.model.modelName
            };
        } catch (error) {
            throw this._handleError(error, 'getStats');
        }
    }

    /**
     * Handle and format errors
     * @private
     * @param {Error} error - The error to handle
     * @param {String} operation - The operation that caused the error
     * @returns {Error} Formatted error
     */
    _handleError(error, operation) {
        const errorMessage = `${operation} operation failed in ${this.model.modelName} repository`;
        console.error(errorMessage, error);
        if (error.name === 'ValidationError') {
            const validationErrors = error.errors && typeof error.errors === 'object' 
                ? Object.values(error.errors).map(err => err.message)
                : ['Validation failed'];
            const customError = new Error(`${errorMessage}: ${validationErrors.join(', ')}`);
            customError.name = 'ValidationError';
            customError.details = validationErrors;
            return customError;
        }
        
        if (error.code === 11000) {
            const field = error.keyPattern && typeof error.keyPattern === 'object' 
                ? Object.keys(error.keyPattern)[0] 
                : 'unknown field';
            const customError = new Error(`${errorMessage}: Duplicate value for field '${field}'`);
            customError.name = 'DuplicateError';
            customError.field = field;
            return customError;
        }
        
        if (error.name === 'CastError') {
            const customError = new Error(`${errorMessage}: Invalid ${error.path} format`);
            customError.name = 'CastError';
            customError.path = error.path;
            return customError;
        }
        
        // For other errors, preserve the original error but add context
        error.message = `${errorMessage}: ${error.message}`;
        return error;
    }
}

export default BaseRepository;