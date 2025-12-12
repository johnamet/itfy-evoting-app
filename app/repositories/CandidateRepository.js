#!/usr/bin/env node
/**
 * Enhanced Candidate Repository
 * 
 * Provides candidate-specific database operations with intelligent caching.
 * 
 * @module CandidateRepository
 * @version 2.0.0
 */

import BaseRepository from '../BaseRepository.js';
import Candidate from '../models/Candidate.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

class CandidateRepository extends BaseRepository {
    constructor() {
        super(Candidate, {
            enableCache: true,
            cacheManager: mainCacheManager,
        });
    }

    // ============================================
    // CANDIDATE MANAGEMENT
    // ============================================

    /**
     * Create a new candidate
     * @param {Object} candidateData - Candidate data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async createCandidate(candidateData, options = {}) {
        try {
            this.validateRequiredFields(candidateData, [
                'name',
                'event',
            ]);

            const candidate = await this.create(candidateData, options);

            this.log('createCandidate', { 
                candidateId: candidate._id,
                name: candidate.name,
            });

            return candidate;
        } catch (error) {
            throw this.handleError(error, 'createCandidate', { name: candidateData.name });
        }
    }

    /**
     * Update candidate by ID
     * @param {String} candidateId - Candidate ID
     * @param {Object} updateData - Data to update
     * @param {Object} options - Update options
     * @returns {Promise<Object>}
     */
    async updateCandidate(candidateId, updateData, options = {}) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            const candidate = await this.updateById(candidateId, updateData, {
                ...options,
                new: true,
                runValidators: true,
            });

            if (!candidate) {
                return null;
            }

            this.log('updateCandidate', { candidateId, success: true });

            return candidate;
        } catch (error) {
            throw this.handleError(error, 'updateCandidate', { candidateId });
        }
    }

    // ============================================
    // CANDIDATE QUERIES
    // ============================================

    /**
     * Find candidates by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByEvent(eventId, options = {}) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.find(
                { event: eventId, deleted: false },
                { ...options, sort: { position: 1, createdAt: 1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByEvent', { eventId });
        }
    }

    /**
     * Find candidates by category
     * @param {String} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByCategory(categoryId, options = {}) {
        try {
            this.validateObjectId(categoryId, 'Category ID');

            return await this.find(
                { category: categoryId, deleted: false },
                { ...options, sort: { position: 1, createdAt: 1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByCategory', { categoryId });
        }
    }

    /**
     * Find active candidates
     * @param {Object} filter - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findActiveCandidates(filter = {}, options = {}) {
        try {
            return await this.find(
                { ...filter, active: true, deleted: false },
                { ...options, sort: { position: 1, createdAt: 1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findActiveCandidates');
        }
    }

    /**
     * Search candidates by text
     * @param {String} searchText - Search query
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async searchCandidates(searchText, options = {}) {
        try {
            if (!searchText) {
                return [];
            }

            return await this.textSearch(searchText, { deleted: false }, options);
        } catch (error) {
            throw this.handleError(error, 'searchCandidates', { searchText });
        }
    }

    // ============================================
    // CANDIDATE STATISTICS
    // ============================================

    /**
     * Get candidate statistics
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>}
     */
    async getCandidateStats(candidateId) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            const candidate = await this.findById(candidateId);

            if (!candidate) {
                throw new Error('Candidate not found');
            }

            return {
                candidateId,
                name: candidate.name,
                voteCount: candidate.voteCount || 0,
                event: candidate.event,
                category: candidate.category,
                active: candidate.active,
                createdAt: candidate.createdAt,
            };
        } catch (error) {
            throw this.handleError(error, 'getCandidateStats', { candidateId });
        }
    }

    /**
     * Increment vote count for candidate
     * @param {String} candidateId - Candidate ID
     * @param {Number} count - Number to increment by (default: 1)
     * @returns {Promise<Object>}
     */
    async incrementVoteCount(candidateId, count = 1) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            return await this.updateById(candidateId, {
                $inc: { voteCount: count },
            });
        } catch (error) {
            throw this.handleError(error, 'incrementVoteCount', { candidateId });
        }
    }

    /**
     * Get total candidate count
     * @param {Object} filter - Optional filter
     * @returns {Promise<Number>}
     */
    async getCandidateCount(filter = {}) {
        try {
            return await this.count({ ...filter, deleted: false });
        } catch (error) {
            throw this.handleError(error, 'getCandidateCount');
        }
    }

    // ============================================
    // CANDIDATE STATUS MANAGEMENT
    // ============================================

    /**
     * Activate candidate
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>}
     */
    async activateCandidate(candidateId) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            return await this.updateById(candidateId, {
                active: true,
            });
        } catch (error) {
            throw this.handleError(error, 'activateCandidate', { candidateId });
        }
    }

    /**
     * Deactivate candidate
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>}
     */
    async deactivateCandidate(candidateId) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            return await this.updateById(candidateId, {
                active: false,
            });
        } catch (error) {
            throw this.handleError(error, 'deactivateCandidate', { candidateId });
        }
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    /**
     * Delete candidates by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Delete options
     * @returns {Promise<Object>}
     */
    async deleteByEvent(eventId, options = {}) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.deleteMany(
                { event: eventId },
                options
            );
        } catch (error) {
            throw this.handleError(error, 'deleteByEvent', { eventId });
        }
    }

    /**
     * Update candidates by event
     * @param {String} eventId - Event ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>}
     */
    async updateByEvent(eventId, updateData) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.updateMany(
                { event: eventId },
                updateData
            );
        } catch (error) {
            throw this.handleError(error, 'updateByEvent', { eventId });
        }
    }
}

export default CandidateRepository;
