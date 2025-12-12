#!/usr/bin/env node
/**
 * Enhanced Base Repository for ITFY E-Voting System
 * 
 * Provides pure data access layer functionality including:
 * - CRUD operations with advanced options
 * - Transaction management
 * - Query building and optimization
 * - Batch operations
 * - Error handling and logging
 * - Validation helpers
 * - Intelligent caching with automatic invalidation
 * 
 * @module BaseRepository
 * @version 2.0.0
 */

import mongoose from 'mongoose';
import pRetry from 'p-retry';
import _ from 'lodash';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';
import logger from '../utils/Logger.js';

/**
 * Base Repository Class
 * All repositories should extend this class
 */
class BaseRepository {
    constructor(model, options = {}) {
        if (!model) {
            throw new Error('Model is required for repository initialization');
        }
        
        this.model = model;
        this.modelName = model.modelName;
        
        // Cache configuration
        const {
            enableCache = true,
            cacheManager = mainCacheManager,
            cacheTTL = null, // Use entity-specific TTL from CacheManager
        } = options;
        
        this.cacheEnabled = enableCache;
        this.cacheManager = enableCache ? cacheManager : null;
        this.cacheTTL = cacheTTL;
    }

    // ============================================
    // CORE CRUD OPERATIONS
    // ============================================

    /**
     * Create a single document
     * @param {Object} data - Document data
     * @param {Object} options - { session, lean, populate, select }
     * @returns {Promise<Document>}
     */
    async create(data, options = {}) {
        const startTime = logger.startTimer();
        
        try {
            this.validateRequiredFields(data, []);
            
            const { session, lean = false, populate = [], select = null } = options;
            
            const [document] = await this.model.create([data], { session });
            
            if (!document) {
                throw new Error(`Failed to create ${this.modelName}`);
            }

            let result = document;

            // Apply population if requested
            if (populate.length > 0 && !lean) {
                result = await this.model.populate(document, populate);
            }

            // Apply field selection
            if (select && !lean) {
                result = await this.model.findById(document._id)
                    .select(select)
                    .populate(populate)
                    .session(session);
            }

            // Convert to plain object if lean
            if (lean && typeof result.toObject === 'function') {
                result = result.toObject();
            }

            // Invalidate query-based caches for this entity type
            await this._invalidateCache('create', null, { entityId: document._id });

            const duration = logger.endTimer(startTime);
            this._logQuery('create', duration, { id: document._id });
            
            return result;
        } catch (error) {
            const duration = logger.endTimer(startTime);
            this.log('error', `Failed to create ${this.modelName}`, { error, duration });
            throw this.handleError(error, 'create', { data });
        }
    }

    /**
     * Create multiple documents (optimized bulk insert)
     * @param {Array} dataArray - Array of document data
     * @param {Object} options - { session, ordered, lean }
     * @returns {Promise<Array>}
     */
    async createMany(dataArray, options = {}) {
        try {
            if (!Array.isArray(dataArray) || dataArray.length === 0) {
                throw new Error('dataArray must be a non-empty array');
            }

            const { session, ordered = true, lean = false } = options;

            const documents = await this.model.create(dataArray, { 
                session,
                ordered 
            });

            this.log('createMany', { 
                count: documents.length, 
                success: true 
            });

            if (lean) {
                return documents.map(doc => 
                    typeof doc.toObject === 'function' ? doc.toObject() : doc
                );
            }

            return documents;
        } catch (error) {
            throw this.handleError(error, 'createMany', { 
                count: dataArray.length 
            });
        }
    }

    /**
     * Find document by ID
     * @param {String|ObjectId} id
     * @param {Object} options - { lean, populate, select, session, skipCache }
     * @returns {Promise<Document|null>}
     */
    async findById(id, options = {}) {
        const startTime = logger.startTimer();
        
        try {
            this.validateObjectId(id, `${this.modelName} ID`);

            const { 
                lean = false, 
                populate = [], 
                select = null, 
                session,
                skipCache = false,
            } = options;

            // Try cache first (if enabled and not skipped)
            if (!skipCache) {
                const cached = await this._getFromCache('findById', id);
                if (cached !== null) {
                    const duration = logger.endTimer(startTime);
                    this._logQuery('findById', duration, { id, cached: true });
                    return cached;
                }
            }

            let query = this.model.findById(id);

            if (select) query = query.select(select);
            if (populate.length > 0) query = query.populate(populate);
            if (session) query = query.session(session);
            if (lean) query = query.lean();

            const result = await query.exec();

            // Cache the result
            if (result && !skipCache) {
                await this._setCache('findById', id, result);
            }

            const duration = logger.endTimer(startTime);
            this._logQuery('findById', duration, { id, found: !!result });

            return result;
        } catch (error) {
            const duration = logger.endTimer(startTime);
            this.log('error', `Failed to find ${this.modelName} by ID`, { error, id, duration });
            throw this.handleError(error, 'findById', { id });
        }
    }

    /**
     * Find one document matching filter
     * @param {Object} filter
     * @param {Object} options - { lean, populate, select, sort, session, skipCache }
     * @returns {Promise<Document|null>}
     */
    async findOne(filter, options = {}) {
        try {
            const { 
                lean = false, 
                populate = [], 
                select = null, 
                sort = null,
                session,
                skipCache = false,
            } = options;

            // Try cache first
            if (!skipCache) {
                const cached = await this._getFromCache('findOne', filter);
                if (cached !== null) {
                    this.log('findOne', { filter, found: true, cached: true });
                    return cached;
                }
            }

            let query = this.model.findOne(filter);

            if (select) query = query.select(select);
            if (populate.length > 0) query = query.populate(populate);
            if (sort) query = query.sort(sort);
            if (session) query = query.session(session);
            if (lean) query = query.lean();

            const result = await query.exec();

            // Cache the result
            if (result && !skipCache) {
                await this._setCache('findOne', filter, result);
            }

            this.log('findOne', { filter, found: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'findOne', { filter });
        }
    }

    /**
     * Find multiple documents
     * @param {Object} filter
     * @param {Object} options - { lean, populate, select, sort, limit, skip, session, skipCache }
     * @returns {Promise<Array>}
     */
    async find(filter, options = {}) {
        try {
            const { 
                lean = false, 
                populate = [], 
                select = null, 
                sort = null,
                limit = null,
                skip = null,
                session,
                skipCache = false,
            } = options;

            // Try cache first (include pagination params in cache key)
            if (!skipCache) {
                const cacheKey = { filter, limit, skip, sort };
                const cached = await this._getFromCache('find', cacheKey);
                if (cached !== null) {
                    this.log('find', { filter, count: cached.length, cached: true });
                    return cached;
                }
            }

            let query = this.model.find(filter);

            if (select) query = query.select(select);
            if (populate.length > 0) query = query.populate(populate);
            if (sort) query = query.sort(sort);
            if (limit) query = query.limit(limit);
            if (skip) query = query.skip(skip);
            if (session) query = query.session(session);
            if (lean) query = query.lean();

            const results = await query.exec();

            // Cache the results
            if (!skipCache && results.length > 0) {
                const cacheKey = { filter, limit, skip, sort };
                await this._setCache('find', cacheKey, results);
            }

            this.log('find', { filter, count: results.length });

            return results;
        } catch (error) {
            throw this.handleError(error, 'find', { filter });
        }
    }

    /**
     * Find with pagination
     * @param {Object} filter
     * @param {Object} options - { page, limit, sort, lean, populate, select }
     * @returns {Promise<Object>} { docs, total, page, pages, hasNext, hasPrev }
     */
    async findPaginated(filter, options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                sort = { createdAt: -1 },
                lean = true,
                populate = [],
                select = null
            } = options;

            const paginationOptions = {
                page: Math.max(1, parseInt(page)),
                limit: Math.max(1, Math.min(100, parseInt(limit))),
                sort,
                lean,
                populate,
                select,
                customLabels: {
                    docs: 'docs',
                    totalDocs: 'total',
                    limit: 'limit',
                    page: 'page',
                    totalPages: 'pages',
                    hasNextPage: 'hasNext',
                    hasPrevPage: 'hasPrev',
                    nextPage: 'nextPage',
                    prevPage: 'prevPage',
                    pagingCounter: 'pagingCounter'
                }
            };

            const result = await this.model.paginate(filter, paginationOptions);

            this.log('findPaginated', { 
                filter, 
                page: result.page, 
                total: result.total 
            });

            return result;
        } catch (error) {
            throw this.handleError(error, 'findPaginated', { filter, options });
        }
    }

    /**
     * Update document by ID
     * @param {String|ObjectId} id
     * @param {Object} update
     * @param {Object} options - { new, runValidators, session, lean }
     * @returns {Promise<Document|null>}
     */
    async updateById(id, update, options = {}) {
        try {
            this.validateObjectId(id, `${this.modelName} ID`);

            const {
                new: returnNew = true,
                runValidators = true,
                session,
                lean = false,
                populate = [],
                select = null
            } = options;

            let query = this.model.findByIdAndUpdate(
                id,
                update,
                { new: returnNew, runValidators, session }
            );

            if (select) query = query.select(select);
            if (populate.length > 0) query = query.populate(populate);
            if (lean) query = query.lean();

            const result = await query.exec();

            // Invalidate caches for this entity
            if (result) {
                await this._invalidateCache('update', id, { entityId: id });
            }

            this.log('updateById', { id, updated: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'updateById', { id, update });
        }
    }

    /**
     * Update one document
     * @param {Object} filter
     * @param {Object} update
     * @param {Object} options - { new, runValidators, session, upsert }
     * @returns {Promise<Document|null>}
     */
    async updateOne(filter, update, options = {}) {
        try {
            const {
                new: returnNew = true,
                runValidators = true,
                session,
                upsert = false,
                lean = false,
                populate = [],
                select = null
            } = options;

            let query = this.model.findOneAndUpdate(
                filter,
                update,
                { new: returnNew, runValidators, session, upsert }
            );

            if (select) query = query.select(select);
            if (populate.length > 0) query = query.populate(populate);
            if (lean) query = query.lean();

            const result = await query.exec();

            this.log('updateOne', { filter, updated: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'updateOne', { filter, update });
        }
    }

    /**
     * Update multiple documents
     * @param {Object} filter
     * @param {Object} update
     * @param {Object} options - { session }
     * @returns {Promise<Object>} { matchedCount, modifiedCount }
     */
    async updateMany(filter, update, options = {}) {
        try {
            const { session } = options;

            const result = await this.model.updateMany(
                filter,
                update,
                { session }
            );

            // Invalidate all query-based caches for this entity type
            if (result.modifiedCount > 0) {
                await this._invalidateCache('updateMany', null);
            }

            this.log('updateMany', { 
                filter, 
                matched: result.matchedCount,
                modified: result.modifiedCount 
            });

            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                acknowledged: result.acknowledged
            };
        } catch (error) {
            throw this.handleError(error, 'updateMany', { filter, update });
        }
    }

    /**
     * Delete document by ID (hard delete)
     * @param {String|ObjectId} id
     * @param {Object} options - { session }
     * @returns {Promise<Document|null>}
     */
    async deleteById(id, options = {}) {
        try {
            this.validateObjectId(id, `${this.modelName} ID`);

            const { session } = options;

            const result = await this.model.findByIdAndDelete(id, { session });

            this.log('deleteById', { id, deleted: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'deleteById', { id });
        }
    }

    /**
     * Delete one document
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Document|null>}
     */
    async deleteOne(filter, options = {}) {
        try {
            const { session } = options;

            const result = await this.model.findOneAndDelete(filter, { session });

            // Invalidate caches
            if (result && result._id) {
                await this._invalidateCache('delete', result._id, { entityId: result._id });
            }

            this.log('deleteOne', { filter, deleted: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'deleteOne', { filter });
        }
    }

    /**
     * Delete multiple documents
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Object>} { deletedCount }
     */
    async deleteMany(filter, options = {}) {
        try {
            const { session } = options;

            const result = await this.model.deleteMany(filter, { session });

            // Invalidate all query-based caches for this entity type
            if (result.deletedCount > 0) {
                await this._invalidateCache('deleteMany', null);
            }

            this.log('deleteMany', { 
                filter, 
                deleted: result.deletedCount 
            });

            return {
                deletedCount: result.deletedCount,
                acknowledged: result.acknowledged
            };
        } catch (error) {
            throw this.handleError(error, 'deleteMany', { filter });
        }
    }

    // ============================================
    // SOFT DELETE OPERATIONS
    // ============================================

    /**
     * Soft delete document by ID
     * @param {String|ObjectId} id
     * @param {String|ObjectId} deletedBy
     * @param {Object} options - { session }
     * @returns {Promise<Document>}
     */
    async softDeleteById(id, deletedBy = null, options = {}) {
        try {
            this.validateObjectId(id, `${this.modelName} ID`);

            const { session } = options;

            const update = {
                deleted: true,
                deletedAt: new Date()
            };

            if (deletedBy) {
                this.validateObjectId(deletedBy, 'deletedBy');
                update.deletedBy = deletedBy;
            }

            const result = await this.model.findByIdAndUpdate(
                id,
                update,
                { new: true, session }
            );

            this.log('softDeleteById', { id, deleted: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'softDeleteById', { id, deletedBy });
        }
    }

    /**
     * Soft delete one document
     * @param {Object} filter
     * @param {String|ObjectId} deletedBy
     * @param {Object} options - { session }
     * @returns {Promise<Document>}
     */
    async softDeleteOne(filter, deletedBy = null, options = {}) {
        try {
            const { session } = options;

            const update = {
                deleted: true,
                deletedAt: new Date()
            };

            if (deletedBy) {
                this.validateObjectId(deletedBy, 'deletedBy');
                update.deletedBy = deletedBy;
            }

            const result = await this.model.findOneAndUpdate(
                filter,
                update,
                { new: true, session }
            );

            this.log('softDeleteOne', { filter, deleted: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'softDeleteOne', { filter, deletedBy });
        }
    }

    /**
     * Soft delete multiple documents
     * @param {Object} filter
     * @param {String|ObjectId} deletedBy
     * @param {Object} options - { session }
     * @returns {Promise<Object>}
     */
    async softDeleteMany(filter, deletedBy = null, options = {}) {
        try {
            const { session } = options;

            const update = {
                deleted: true,
                deletedAt: new Date()
            };

            if (deletedBy) {
                this.validateObjectId(deletedBy, 'deletedBy');
                update.deletedBy = deletedBy;
            }

            const result = await this.model.updateMany(
                filter,
                update,
                { session }
            );

            this.log('softDeleteMany', { 
                filter, 
                modified: result.modifiedCount 
            });

            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                acknowledged: result.acknowledged
            };
        } catch (error) {
            throw this.handleError(error, 'softDeleteMany', { filter, deletedBy });
        }
    }

    /**
     * Restore soft-deleted document by ID
     * @param {String|ObjectId} id
     * @param {Object} options - { session }
     * @returns {Promise<Document>}
     */
    async restoreById(id, options = {}) {
        try {
            this.validateObjectId(id, `${this.modelName} ID`);

            const { session } = options;

            const result = await this.model.findByIdAndUpdate(
                id,
                {
                    deleted: false,
                    $unset: { deletedAt: 1, deletedBy: 1 }
                },
                { new: true, session }
            );

            this.log('restoreById', { id, restored: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'restoreById', { id });
        }
    }

    /**
     * Restore one soft-deleted document
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Document>}
     */
    async restoreOne(filter, options = {}) {
        try {
            const { session } = options;

            const result = await this.model.findOneAndUpdate(
                { ...filter, deleted: true },
                {
                    deleted: false,
                    $unset: { deletedAt: 1, deletedBy: 1 }
                },
                { new: true, session }
            );

            this.log('restoreOne', { filter, restored: !!result });

            return result;
        } catch (error) {
            throw this.handleError(error, 'restoreOne', { filter });
        }
    }

    /**
     * Restore multiple soft-deleted documents
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Object>}
     */
    async restoreMany(filter, options = {}) {
        try {
            const { session } = options;

            const result = await this.model.updateMany(
                { ...filter, deleted: true },
                {
                    deleted: false,
                    $unset: { deletedAt: 1, deletedBy: 1 }
                },
                { session }
            );

            this.log('restoreMany', { 
                filter, 
                modified: result.modifiedCount 
            });

            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                acknowledged: result.acknowledged
            };
        } catch (error) {
            throw this.handleError(error, 'restoreMany', { filter });
        }
    }

    // ============================================
    // COUNT & EXISTS OPERATIONS
    // ============================================

    /**
     * Count documents matching filter
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Number>}
     */
    async count(filter, options = {}) {
        try {
            const { session } = options;

            const count = await this.model.countDocuments(filter, { session });

            this.log('count', { filter, count });

            return count;
        } catch (error) {
            throw this.handleError(error, 'count', { filter });
        }
    }

    /**
     * Count active (non-deleted) documents
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Number>}
     */
    async countActive(filter = {}, options = {}) {
        try {
            const { session } = options;

            const count = await this.model.countDocuments(
                { ...filter, deleted: false },
                { session }
            );

            this.log('countActive', { filter, count });

            return count;
        } catch (error) {
            throw this.handleError(error, 'countActive', { filter });
        }
    }

    /**
     * Count deleted documents
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Number>}
     */
    async countDeleted(filter = {}, options = {}) {
        try {
            const { session } = options;

            const count = await this.model.countDocuments(
                { ...filter, deleted: true },
                { session }
            );

            this.log('countDeleted', { filter, count });

            return count;
        } catch (error) {
            throw this.handleError(error, 'countDeleted', { filter });
        }
    }

    /**
     * Check if document exists
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Boolean>}
     */
    async exists(filter, options = {}) {
        try {
            const { session } = options;

            const exists = await this.model.exists(filter).session(session);

            this.log('exists', { filter, exists: !!exists });

            return !!exists;
        } catch (error) {
            throw this.handleError(error, 'exists', { filter });
        }
    }

    /**
     * Check if document exists by ID
     * @param {String|ObjectId} id
     * @param {Object} options - { session }
     * @returns {Promise<Boolean>}
     */
    async existsById(id, options = {}) {
        try {
            this.validateObjectId(id, `${this.modelName} ID`);

            const { session } = options;

            const exists = await this.model.exists({ _id: id }).session(session);

            this.log('existsById', { id, exists: !!exists });

            return !!exists;
        } catch (error) {
            throw this.handleError(error, 'existsById', { id });
        }
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    /**
     * Bulk write operations
     * @param {Array} operations - Array of write operations
     * @param {Object} options - { session, ordered }
     * @returns {Promise<Object>}
     */
    async bulkWrite(operations, options = {}) {
        try {
            if (!Array.isArray(operations) || operations.length === 0) {
                throw new Error('operations must be a non-empty array');
            }

            const { session, ordered = true } = options;

            const result = await this.model.bulkWrite(operations, {
                session,
                ordered
            });

            this.log('bulkWrite', {
                operationsCount: operations.length,
                inserted: result.insertedCount,
                modified: result.modifiedCount,
                deleted: result.deletedCount
            });

            return result;
        } catch (error) {
            throw this.handleError(error, 'bulkWrite', { 
                operationsCount: operations.length 
            });
        }
    }

    /**
     * Update many documents by IDs
     * @param {Array} ids
     * @param {Object} update
     * @param {Object} options - { session }
     * @returns {Promise<Object>}
     */
    async updateManyByIds(ids, update, options = {}) {
        try {
            this.validateObjectIds(ids, `${this.modelName} IDs`);

            const { session } = options;

            const result = await this.model.updateMany(
                { _id: { $in: ids } },
                update,
                { session }
            );

            this.log('updateManyByIds', {
                idsCount: ids.length,
                modified: result.modifiedCount
            });

            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                acknowledged: result.acknowledged
            };
        } catch (error) {
            throw this.handleError(error, 'updateManyByIds', { 
                idsCount: ids.length 
            });
        }
    }

    /**
     * Delete many documents by IDs
     * @param {Array} ids
     * @param {Object} options - { session }
     * @returns {Promise<Object>}
     */
    async deleteManyByIds(ids, options = {}) {
        try {
            this.validateObjectIds(ids, `${this.modelName} IDs`);

            const { session } = options;

            const result = await this.model.deleteMany(
                { _id: { $in: ids } },
                { session }
            );

            this.log('deleteManyByIds', {
                idsCount: ids.length,
                deleted: result.deletedCount
            });

            return {
                deletedCount: result.deletedCount,
                acknowledged: result.acknowledged
            };
        } catch (error) {
            throw this.handleError(error, 'deleteManyByIds', { 
                idsCount: ids.length 
            });
        }
    }

    // ============================================
    // AGGREGATION OPERATIONS
    // ============================================

    /**
     * Execute aggregation pipeline
     * @param {Array} pipeline
     * @param {Object} options - { session }
     * @returns {Promise<Array>}
     */
    async aggregate(pipeline, options = {}) {
        try {
            if (!Array.isArray(pipeline)) {
                throw new Error('pipeline must be an array');
            }

            const { session } = options;

            let query = this.model.aggregate(pipeline);

            if (session) {
                query = query.session(session);
            }

            const results = await query.exec();

            this.log('aggregate', { 
                stagesCount: pipeline.length, 
                resultsCount: results.length 
            });

            return results;
        } catch (error) {
            throw this.handleError(error, 'aggregate', { pipeline });
        }
    }

    /**
     * Aggregate with pagination
     * @param {Array} pipeline
     * @param {Object} options - { page, limit }
     * @returns {Promise<Object>}
     */
    async aggregatePaginate(pipeline, options = {}) {
        try {
            if (!Array.isArray(pipeline)) {
                throw new Error('pipeline must be an array');
            }

            const {
                page = 1,
                limit = 10
            } = options;

            const aggregateQuery = this.model.aggregate(pipeline);

            const result = await this.model.aggregatePaginate(
                aggregateQuery,
                {
                    page: Math.max(1, parseInt(page)),
                    limit: Math.max(1, Math.min(100, parseInt(limit)))
                }
            );

            this.log('aggregatePaginate', {
                stagesCount: pipeline.length,
                page: result.page,
                total: result.totalDocs
            });

            return result;
        } catch (error) {
            throw this.handleError(error, 'aggregatePaginate', { 
                pipeline, 
                options 
            });
        }
    }

    /**
     * Get distinct values for a field
     * @param {String} field
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Array>}
     */
    async distinct(field, filter = {}, options = {}) {
        try {
            if (!field) {
                throw new Error('field is required');
            }

            const { session } = options;

            const values = await this.model
                .distinct(field, filter)
                .session(session);

            this.log('distinct', { 
                field, 
                filter, 
                valuesCount: values.length 
            });

            return values;
        } catch (error) {
            throw this.handleError(error, 'distinct', { field, filter });
        }
    }

    // ============================================
    // TRANSACTION HELPERS
    // ============================================

    /**
     * Start a new session
     * @returns {Promise<ClientSession>}
     */
    async startSession() {
        try {
            const session = await this.model.db.startSession();
            
            this.log('startSession', { sessionId: session.id });
            
            return session;
        } catch (error) {
            throw this.handleError(error, 'startSession');
        }
    }

    /**
     * Execute function within transaction
     * @param {Function} fn - Async function to execute
     * @param {Object} options - Transaction options
     * @returns {Promise<any>}
     */
    async withTransaction(fn, options = {}) {
        const session = await this.startSession();
        
        try {
            session.startTransaction(options);
            
            const result = await fn(session);
            
            await session.commitTransaction();
            
            this.log('withTransaction', { 
                sessionId: session.id, 
                status: 'committed' 
            });
            
            return result;
        } catch (error) {
            await session.abortTransaction();
            
            this.log('withTransaction', { 
                sessionId: session.id, 
                status: 'aborted' 
            });
            
            throw this.handleError(error, 'withTransaction');
        } finally {
            await session.endSession();
        }
    }

    /**
     * Execute with retry logic
     * @param {Function} fn - Async function to execute
     * @param {Object} options - { retries, minTimeout, maxTimeout }
     * @returns {Promise<any>}
     */
    async withRetry(fn, options = {}) {
        const {
            retries = 3,
            minTimeout = 1000,
            maxTimeout = 3000
        } = options;

        try {
            const result = await pRetry(fn, {
                retries,
                minTimeout,
                maxTimeout,
                onFailedAttempt: (error) => {
                    this.log('retryAttempt', {
                        attemptNumber: error.attemptNumber,
                        retriesLeft: error.retriesLeft,
                        error: error.message
                    });
                }
            });

            return result;
        } catch (error) {
            throw this.handleError(error, 'withRetry', { retries });
        }
    }

    // ============================================
    // QUERY BUILDERS
    // ============================================

    /**
     * Build query filter
     * @param {Object} filters
     * @returns {Object}
     */
    buildFilter(filters) {
        const query = {};

        // Handle common filter patterns
        Object.keys(filters).forEach(key => {
            const value = filters[key];

            if (value === null || value === undefined) {
                return;
            }

            // Handle ObjectId fields
            if (mongoose.Types.ObjectId.isValid(value)) {
                query[key] = value;
                return;
            }

            // Handle arrays (use $in)
            if (Array.isArray(value)) {
                query[key] = { $in: value };
                return;
            }

            // Handle range queries
            if (typeof value === 'object' && !Array.isArray(value)) {
                query[key] = value;
                return;
            }

            // Default: exact match
            query[key] = value;
        });

        return query;
    }

    /**
     * Build sort object
     * @param {Object|String} sort
     * @returns {Object}
     */
    buildSort(sort) {
        if (!sort) {
            return { createdAt: -1 };
        }

        if (typeof sort === 'string') {
            const sortObj = {};
            const parts = sort.split(',');
            
            parts.forEach(part => {
                const trimmed = part.trim();
                if (trimmed.startsWith('-')) {
                    sortObj[trimmed.substring(1)] = -1;
                } else {
                    sortObj[trimmed] = 1;
                }
            });
            
            return sortObj;
        }

        return sort;
    }

    /**
     * Build projection
     * @param {String|Array|Object} fields
     * @returns {Object}
     */
    buildProjection(fields) {
        if (!fields) {
            return null;
        }

        if (typeof fields === 'string') {
            const projection = {};
            const parts = fields.split(' ');
            
            parts.forEach(part => {
                const trimmed = part.trim();
                if (trimmed.startsWith('-')) {
                    projection[trimmed.substring(1)] = 0;
                } else {
                    projection[trimmed] = 1;
                }
            });
            
            return projection;
        }

        if (Array.isArray(fields)) {
            const projection = {};
            fields.forEach(field => {
                projection[field] = 1;
            });
            return projection;
        }

        return fields;
    }

    // ============================================
    // SEARCH OPERATIONS
    // ============================================

    /**
     * Text search
     * @param {String} searchText
     * @param {Object} filter
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async textSearch(searchText, filter = {}, options = {}) {
        try {
            if (!searchText) {
                throw new Error('searchText is required');
            }

            const {
                limit = 10,
                skip = 0,
                sort = { score: { $meta: 'textScore' } },
                lean = true,
                populate = []
            } = options;

            let query = this.model.find(
                {
                    $text: { $search: searchText },
                    ...filter
                },
                { score: { $meta: 'textScore' } }
            );

            query = query.sort(sort).limit(limit).skip(skip);

            if (populate.length > 0) query = query.populate(populate);
            if (lean) query = query.lean();

            const results = await query.exec();

            this.log('textSearch', { 
                searchText, 
                resultsCount: results.length 
            });

            return results;
        } catch (error) {
            throw this.handleError(error, 'textSearch', { searchText, filter });
        }
    }

    /**
     * Search by multiple fields
     * @param {String} query
     * @param {Array} fields
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async searchByFields(query, fields, options = {}) {
        try {
            if (!query) {
                throw new Error('query is required');
            }

            if (!Array.isArray(fields) || fields.length === 0) {
                throw new Error('fields must be a non-empty array');
            }

            const {
                limit = 10,
                skip = 0,
                sort = { createdAt: -1 },
                lean = true,
                populate = []
            } = options;

            const searchRegex = new RegExp(query, 'i');
            const orConditions = fields.map(field => ({
                [field]: { $regex: searchRegex }
            }));

            let dbQuery = this.model.find({ $or: orConditions });

            dbQuery = dbQuery.sort(sort).limit(limit).skip(skip);

            if (populate.length > 0) dbQuery = dbQuery.populate(populate);
            if (lean) dbQuery = dbQuery.lean();

            const results = await dbQuery.exec();

            this.log('searchByFields', { 
                query, 
                fields, 
                resultsCount: results.length 
            });

            return results;
        } catch (error) {
            throw this.handleError(error, 'searchByFields', { query, fields });
        }
    }

    // ============================================
    // DATE RANGE OPERATIONS
    // ============================================

    /**
     * Find documents in date range
     * @param {String} field - Date field name
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async findInDateRange(field, startDate, endDate, options = {}) {
        try {
            if (!field) {
                throw new Error('field is required');
            }

            const filter = {
                [field]: {
                    $gte: startDate,
                    $lte: endDate
                }
            };

            return await this.find(filter, options);
        } catch (error) {
            throw this.handleError(error, 'findInDateRange', { 
                field, 
                startDate, 
                endDate 
            });
        }
    }

    /**
     * Find recent documents
     * @param {Number} limit
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async findRecent(limit = 10, options = {}) {
        try {
            return await this.find(
                { deleted: false },
                {
                    ...options,
                    sort: { createdAt: -1 },
                    limit
                }
            );
        } catch (error) {
            throw this.handleError(error, 'findRecent', { limit });
        }
    }

    /**
     * Find documents older than date
     * @param {String} field - Date field name
     * @param {Date} date
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async findOlderThan(field, date, options = {}) {
        try {
            if (!field) {
                throw new Error('field is required');
            }

            const filter = {
                [field]: { $lt: date }
            };

            return await this.find(filter, options);
        } catch (error) {
            throw this.handleError(error, 'findOlderThan', { field, date });
        }
    }

    // ============================================
    // STATISTICS OPERATIONS
    // ============================================

    /**
     * Get collection statistics
     * @param {Object} filter
     * @returns {Promise<Object>}
     */
    async getStats(filter = {}) {
        try {
            const [total, active, deleted] = await Promise.all([
                this.count(filter),
                this.countActive(filter),
                this.countDeleted(filter)
            ]);

            const stats = {
                total,
                active,
                deleted,
                deletedPercentage: total > 0 ? ((deleted / total) * 100).toFixed(2) : 0
            };

            this.log('getStats', stats);

            return stats;
        } catch (error) {
            throw this.handleError(error, 'getStats', { filter });
        }
    }

    /**
     * Group and count by field
     * @param {String} field
     * @param {Object} filter
     * @returns {Promise<Array>}
     */
    async groupByAndCount(field, filter = {}) {
        try {
            if (!field) {
                throw new Error('field is required');
            }

            const pipeline = [
                { $match: filter },
                {
                    $group: {
                        _id: `${field}`,
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ];

            const results = await this.aggregate(pipeline);

            this.log('groupByAndCount', { 
                field, 
                groupsCount: results.length 
            });

            return results;
        } catch (error) {
            throw this.handleError(error, 'groupByAndCount', { field, filter });
        }
    }

    // ============================================
    // VALIDATION HELPERS
    // ============================================

    /**
     * Validate ObjectId
     * @param {String} id
     * @param {String} fieldName
     * @throws {Error}
     */
    validateObjectId(id, fieldName = 'ID') {
        if (!id) {
            throw new Error(`${fieldName} is required`);
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error(`Invalid ${fieldName} format`);
        }
    }

    /**
     * Validate ObjectIds array
     * @param {Array} ids
     * @param {String} fieldName
     * @throws {Error}
     */
    validateObjectIds(ids, fieldName = 'IDs') {
        if (!Array.isArray(ids)) {
            throw new Error(`${fieldName} must be an array`);
        }

        if (ids.length === 0) {
            throw new Error(`${fieldName} cannot be empty`);
        }

        ids.forEach((id, index) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error(
                    `Invalid ${fieldName} format at index ${index}`
                );
            }
        });
    }

    /**
     * Validate required fields
     * @param {Object} data
     * @param {Array} requiredFields
     * @throws {Error}
     */
    validateRequiredFields(data, requiredFields) {
        if (!data || typeof data !== 'object') {
            throw new Error('data must be an object');
        }

        const missingFields = requiredFields.filter(
            field => !data[field] && data[field] !== 0 && data[field] !== false
        );

        if (missingFields.length > 0) {
            throw new Error(
                `Missing required fields: ${missingFields.join(', ')}`
            );
        }
    }

    // ============================================
    // ERROR HANDLING
    // ============================================

    /**
     * Handle and format errors
     * @param {Error} error
     * @param {String} operation
     * @param {Object} context
     * @returns {Error}
     */
    handleError(error, operation, context = {}) {
        const errorMessage = `${this.modelName}Repository.${operation} failed`;
        
        // Log error with structured logging
        this.log('error', errorMessage, {
            error,
            operation,
            ...context
        });

        // Mongoose validation error
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors || {})
                .map(err => err.message);
            
            const formattedError = new Error(
                `Validation failed: ${messages.join(', ')}`
            );
            formattedError.name = 'ValidationError';
            formattedError.details = messages;
            formattedError.operation = operation;
            formattedError.context = context;
            return formattedError;
        }

        // Mongoose duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || 'unknown';
            const formattedError = new Error(
                `Duplicate value for field '${field}'`
            );
            formattedError.name = 'DuplicateError';
            formattedError.field = field;
            formattedError.operation = operation;
            formattedError.context = context;
            return formattedError;
        }

        // Mongoose cast error
        if (error.name === 'CastError') {
            const formattedError = new Error(
                `Invalid ${error.path} format: ${error.value}`
            );
            formattedError.name = 'CastError';
            formattedError.path = error.path;
            formattedError.value = error.value;
            formattedError.operation = operation;
            formattedError.context = context;
            return formattedError;
        }

        // Wrap original error with context
        error.message = `${errorMessage}: ${error.message}`;
        error.operation = operation;
        error.context = context;
        return error;
    }

    /**
     * Log operation
     * @param {String} operation
     * @param {Object} data
     */
    log(level, message, data = {}) {
        logger.log(level, message, {
            repository: `${this.modelName}Repository`,
            ...data
        });
    }

    /**
     * Get child logger with repository context
     * @returns {Object} Child logger instance
     */
    getLogger() {
        return logger.child({ repository: `${this.modelName}Repository` });
    }

    /**
     * Log query performance
     * @private
     */
    _logQuery(operation, duration, filter = {}) {
        logger.query(operation, this.modelName, duration, { filter });
    }

    // ============================================
    // INTELLIGENT CACHE OPERATIONS
    // ============================================

    /**
     * Get value from cache
     * @private
     * @param {String} operation - Operation name (findById, findOne, etc.)
     * @param {String|Object} identifier - Entity ID or query filter
     * @returns {Promise<any|null>}
     */
    async _getFromCache(operation, identifier) {
        if (!this.cacheEnabled || !this.cacheManager) {
            return null;
        }

        try {
            return await this.cacheManager.get(
                this.modelName,
                operation,
                identifier
            );
        } catch (error) {
            console.error(`Cache get error for ${this.modelName}:`, error.message);
            return null;
        }
    }

    /**
     * Set value in cache
     * @private
     * @param {String} operation - Operation name
     * @param {String|Object} identifier - Entity ID or query filter
     * @param {any} value - Value to cache
     * @returns {Promise<void>}
     */
    async _setCache(operation, identifier, value) {
        if (!this.cacheEnabled || !this.cacheManager) {
            return;
        }

        try {
            await this.cacheManager.set(
                this.modelName,
                operation,
                identifier,
                value,
                this.cacheTTL
            );
        } catch (error) {
            console.error(`Cache set error for ${this.modelName}:`, error.message);
        }
    }

    /**
     * Invalidate caches for this entity
     * @private
     * @param {String} operation - Operation that triggered invalidation
     * @param {String} entityId - Optional specific entity ID
     * @param {Object} context - Additional context
     * @returns {Promise<void>}
     */
    async _invalidateCache(operation, entityId = null, context = {}) {
        if (!this.cacheEnabled || !this.cacheManager) {
            return;
        }

        try {
            // If specific entity ID provided, invalidate its caches
            if (entityId) {
                await this.cacheManager.invalidateEntity(this.modelName, entityId);
            }

            // Always invalidate query-based caches for operations that modify data
            if (['create', 'update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
                await this.cacheManager.invalidateEntityQueries(this.modelName);
            }
        } catch (error) {
            console.error(`Cache invalidation error for ${this.modelName}:`, error.message);
        }
    }

    /**
     * Get cached value (legacy method for backward compatibility)
     * @param {String} key
     * @param {Number} ttl - Time to live in seconds
     * @returns {Promise<any>}
     * @deprecated Use _getFromCache instead
     */
    async getCached(key, ttl = 300) {
        console.warn('getCached is deprecated. Use _getFromCache instead.');
        if (!this.cacheEnabled || !this.cacheManager) {
            return null;
        }

        try {
            return await this.cacheManager.redis.get(key);
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Set cached value (legacy method for backward compatibility)
     * @param {String} key
     * @param {any} value
     * @param {Number} ttl - Time to live in seconds
     * @returns {Promise<void>}
     * @deprecated Use _setCache instead
     */
    async setCached(key, value, ttl = 300) {
        console.warn('setCached is deprecated. Use _setCache instead.');
        if (!this.cacheEnabled || !this.cacheManager) {
            return;
        }

        try {
            await this.cacheManager.redis.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    /**
     * Delete cached value (legacy method)
     * @param {String} key
     * @returns {Promise<void>}
     * @deprecated Use _invalidateCache instead
     */
    async deleteCached(key) {
        console.warn('deleteCached is deprecated. Use _invalidateCache instead.');
        if (!this.cacheEnabled || !this.cacheManager) {
            return;
        }

        try {
            await this.cacheManager.redis.del(key);
        } catch (error) {
            console.error('Cache delete error:', error);
        }
    }

    /**
     * Clear all cache for this entity type
     * @returns {Promise<void>}
     */
    async clearCache() {
        if (!this.cacheEnabled || !this.cacheManager) {
            return;
        }

        try {
            await this.cacheManager.clearEntityCache(this.modelName);
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }

    /**
     * Get cache statistics
     * @returns {Object}
     */
    getCacheStats() {
        if (!this.cacheEnabled || !this.cacheManager) {
            return null;
        }

        return this.cacheManager.getStats();
    }
}

export default BaseRepository;