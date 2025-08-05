#!/usr/bin/env node
/**
 * VoteBundle Service
 * 
 * Handles vote bundle operations including retrieval by event, category,
 * and combined filters.
 */

import BaseService from './BaseService.js';
import VoteBundleRepository from '../repositories/VoteBundleRepository.js';

export default class VoteBundleService extends BaseService {
    constructor() {
        super();
        this.voteBundleRepository = new VoteBundleRepository();
    }

    /**
     * Get all vote bundles with filtering and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote bundles with pagination
     */
    async getVoteBundles(query = {}) {
        try {
            this._log('get_vote_bundles', { query });

            const { page, limit } = this._generatePaginationOptions(query.page, query.limit);
            const filter = { isActive: true };

            // Add filters
            if (query.popular !== undefined) {
                filter.popular = query.popular === 'true';
            }

            if (query.minPrice && query.maxPrice) {
                filter.price = { 
                    $gte: parseFloat(query.minPrice), 
                    $lte: parseFloat(query.maxPrice) 
                };
            }

            if (query.currency) {
                filter.currency = query.currency;
            }

            if (query.minVotes) {
                filter.votes = { $gte: parseInt(query.minVotes) };
            }

            const options = {
                page,
                limit,
                populate: ['applicableEvents', 'applicableCategories'],
                sort: { popular: -1, votes: -1, price: 1 }
            };

            const bundles = await this.voteBundleRepository.find(filter, options);
            const total = await this.voteBundleRepository.countDocuments(filter);

            return {
                success: true,
                data: this._formatPaginationResponse(bundles, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_bundles', { query });
        }
    }

    /**
     * Get vote bundle by ID
     * @param {String} bundleId - Bundle ID
     * @param {Boolean} includeVotes - Include vote details
     * @returns {Promise<Object>} Vote bundle details
     */
    async getVoteBundleById(bundleId, includeVotes = false) {
        try {
            this._log('get_vote_bundle_by_id', { bundleId, includeVotes });

            this._validateObjectId(bundleId, 'Bundle ID');

            const options = {
                populate: ['applicableEvents', 'applicableCategories', 'createdBy']
            };

            const bundle = await this.voteBundleRepository.findById(bundleId, options);
            
            if (!bundle || !bundle.isActive) {
                return null;
            }

            return {
                success: true,
                data: bundle
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_bundle_by_id', { bundleId });
        }
    }

    /**
     * Get vote bundles by event
     * @param {String} eventId - Event ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote bundles with pagination
     */
    async getVoteBundlesByEvent(eventId, query = {}) {
        try {
            this._log('get_vote_bundles_by_event', { eventId, query });

            this._validateObjectId(eventId, 'Event ID');

            const { page, limit } = this._generatePaginationOptions(query.page, query.limit);
            
            const options = {
                page,
                limit,
                populate: ['applicableEvents', 'applicableCategories'],
                sort: { popular: -1, votes: -1, price: 1 }
            };

            // Add additional filters
            const additionalFilter = {};
            if (query.popular !== undefined) {
                additionalFilter.popular = query.popular === 'true';
            }

            if (query.minPrice && query.maxPrice) {
                additionalFilter.price = { 
                    $gte: parseFloat(query.minPrice), 
                    $lte: parseFloat(query.maxPrice) 
                };
            }

            const bundles = await this.voteBundleRepository.findByEvent(eventId, {
                ...options,
                filter: additionalFilter
            });

            const total = await this.voteBundleRepository.count({
                applicableEvents: eventId,
                isActive: true,
                ...additionalFilter
            });

            return {
                success: true,
                data: this._formatPaginationResponse(bundles, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_bundles_by_event', { eventId });
        }
    }

    /**
     * Get vote bundles by category
     * @param {String} categoryId - Category ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote bundles with pagination
     */
    async getVoteBundlesByCategory(categoryId, query = {}) {
        try {
            this._log('get_vote_bundles_by_category', { categoryId, query });

            this._validateObjectId(categoryId, 'Category ID');

            const { page, limit } = this._generatePaginationOptions(query.page, query.limit);
            
            const options = {
                page,
                limit,
                populate: ['applicableEvents', 'applicableCategories'],
                sort: { popular: -1, votes: -1, price: 1 }
            };

            // Add additional filters
            const additionalFilter = {};
            if (query.popular !== undefined) {
                additionalFilter.popular = query.popular === 'true';
            }

            if (query.minPrice && query.maxPrice) {
                additionalFilter.price = { 
                    $gte: parseFloat(query.minPrice), 
                    $lte: parseFloat(query.maxPrice) 
                };
            }

            const bundles = await this.voteBundleRepository.findByCategory(categoryId, {
                ...options,
                filter: additionalFilter
            });

            const total = await this.voteBundleRepository.count({
                applicableCategories: categoryId,
                isActive: true,
                ...additionalFilter
            });

            return {
                success: true,
                data: this._formatPaginationResponse(bundles, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_bundles_by_category', { categoryId });
        }
    }

    /**
     * Get vote bundles by event and category
     * @param {String} eventId - Event ID
     * @param {String} categoryId - Category ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Vote bundles with pagination
     */
    async getVoteBundlesByEventAndCategory(eventId, categoryId, query = {}) {
        try {
            this._log('get_vote_bundles_by_event_and_category', { eventId, categoryId, query });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(categoryId, 'Category ID');

            const { page, limit } = this._generatePaginationOptions(query.page, query.limit);
            
            const options = {
                page,
                limit,
                populate: ['applicableEvents', 'applicableCategories'],
                sort: { popular: -1, votes: -1, price: 1 }
            };

            // Add additional filters
            const additionalFilter = {};
            if (query.popular !== undefined) {
                additionalFilter.popular = query.popular === 'true';
            }

            if (query.minPrice && query.maxPrice) {
                additionalFilter.price = { 
                    $gte: parseFloat(query.minPrice), 
                    $lte: parseFloat(query.maxPrice) 
                };
            }

            const bundles = await this.voteBundleRepository.findByEventAndCategory(
                eventId, 
                categoryId, 
                {
                    ...options,
                    filter: additionalFilter
                }
            );

            const total = await this.voteBundleRepository.count({
                applicableEvents: eventId,
                applicableCategories: categoryId,
                isActive: true,
                ...additionalFilter
            });

            return {
                success: true,
                data: this._formatPaginationResponse(bundles, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_bundles_by_event_and_category', { eventId, categoryId });
        }
    }

    /**
     * Create vote bundle
     * @param {Object} bundleData - Bundle data
     * @returns {Promise<Object>} Created bundle
     */
    async createVoteBundle(bundleData) {
        try {
            this._log('create_vote_bundle', { createdBy: bundleData.createdBy });

            // Validate required fields
            if (!bundleData.name || !bundleData.votes || !bundleData.price) {
                throw new Error('Name, votes, and price are required fields');
            }

            const bundle = await this.voteBundleRepository.createBundle(bundleData);

            return {
                success: true,
                data: bundle
            };
        } catch (error) {
            throw this._handleError(error, 'create_vote_bundle', bundleData);
        }
    }

    /**
     * Update vote bundle
     * @param {String} bundleId - Bundle ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated bundle
     */
    async updateVoteBundle(bundleId, updateData) {
        try {
            this._log('update_vote_bundle', { bundleId });

            this._validateObjectId(bundleId, 'Bundle ID');

            const bundle = await this.voteBundleRepository.updateById(bundleId, {
                ...updateData,
                updatedAt: new Date()
            });

            if (!bundle) {
                return null;
            }

            return {
                success: true,
                data: bundle
            };
        } catch (error) {
            throw this._handleError(error, 'update_vote_bundle', { bundleId });
        }
    }

    /**
     * Delete vote bundle (soft delete)
     * @param {String} bundleId - Bundle ID
     * @param {String} deletedBy - User ID who deleted
     * @returns {Promise<Object>} Deletion result
     */
    async deleteVoteBundle(bundleId, deletedBy) {
        try {
            this._log('delete_vote_bundle', { bundleId, deletedBy });

            this._validateObjectId(bundleId, 'Bundle ID');

            const bundle = await this.voteBundleRepository.updateById(bundleId, {
                isActive: false,
                deletedBy,
                deletedAt: new Date(),
                updatedAt: new Date()
            });

            if (!bundle) {
                return null;
            }

            return {
                success: true,
                message: 'Vote bundle deleted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'delete_vote_bundle', { bundleId });
        }
    }

    /**
     * Get vote bundle statistics
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Statistics
     */
    async getVoteBundleStats(query = {}) {
        try {
            this._log('get_vote_bundle_stats', { query });

            const stats = {
                totalBundles: await this.voteBundleRepository.count({ isActive: true }),
                popularBundles: await this.voteBundleRepository.count({ isActive: true, popular: true }),
                totalRevenue: 0, // Would need aggregation
                averagePrice: 0, // Would need aggregation
                byEvent: {},
                byCategory: {}
            };

            // Add event-specific stats if eventId provided
            if (query.eventId) {
                this._validateObjectId(query.eventId, 'Event ID');
                stats.byEvent[query.eventId] = await this.voteBundleRepository.count({
                    applicableEvents: query.eventId,
                    isActive: true
                });
            }

            // Add category-specific stats if categoryId provided
            if (query.categoryId) {
                this._validateObjectId(query.categoryId, 'Category ID');
                stats.byCategory[query.categoryId] = await this.voteBundleRepository.count({
                    applicableCategories: query.categoryId,
                    isActive: true
                });
            }

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_bundle_stats', { query });
        }
    }
}
