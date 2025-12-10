#!/usr/bin/env node
/**
 * Enhanced Vote Repository
 * 
 * Provides vote-specific database operations with intelligent caching.
 * Vote data is automatically cached and invalidated when updated.
 * 
 * @module VoteRepository
 * @version 2.0.0
 */

import BaseRepository from '../BaseRepository.js';
import Vote from '../../models/Vote.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

class VoteRepository extends BaseRepository {
    constructor() {
        super(Vote, {
            enableCache: true,
            cacheManager: mainCacheManager,
        });
    }

    // ============================================
    // VOTE MANAGEMENT
    // ============================================

    /**
     * Cast a vote
     * @param {Object} voteData - Vote data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async castVote(voteData, options = {}) {
        try {
            this.validateRequiredFields(voteData, [
                'event',
                'candidate',
                'voter',
            ]);

            // Check for duplicate vote
            const existingVote = await this.findOne({
                event: voteData.event,
                voter: voteData.voter,
                category: voteData.category,
            }, { skipCache: true });

            if (existingVote) {
                throw new Error('User has already voted in this category');
            }

            const vote = await this.create(voteData, options);

            this.log('castVote', { 
                voteId: vote._id,
                eventId: voteData.event,
                candidateId: voteData.candidate,
            });

            return vote;
        } catch (error) {
            throw this.handleError(error, 'castVote', { 
                eventId: voteData.event,
                candidateId: voteData.candidate,
            });
        }
    }

    // ============================================
    // VOTE QUERIES
    // ============================================

    /**
     * Find votes by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByEvent(eventId, options = {}) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.find(
                { event: eventId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByEvent', { eventId });
        }
    }

    /**
     * Find votes by candidate
     * @param {String} candidateId - Candidate ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByCandidate(candidateId, options = {}) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            return await this.find(
                { candidate: candidateId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByCandidate', { candidateId });
        }
    }

    /**
     * Find votes by voter
     * @param {String} voterId - Voter ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByVoter(voterId, options = {}) {
        try {
            this.validateObjectId(voterId, 'Voter ID');

            return await this.find(
                { voter: voterId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByVoter', { voterId });
        }
    }

    /**
     * Find votes by category
     * @param {String} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByCategory(categoryId, options = {}) {
        try {
            this.validateObjectId(categoryId, 'Category ID');

            return await this.find(
                { category: categoryId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByCategory', { categoryId });
        }
    }

    /**
     * Check if user has voted in event/category
     * @param {String} eventId - Event ID
     * @param {String} voterId - Voter ID
     * @param {String} categoryId - Category ID (optional)
     * @returns {Promise<Boolean>}
     */
    async hasVoted(eventId, voterId, categoryId = null) {
        try {
            this.validateObjectId(eventId, 'Event ID');
            this.validateObjectId(voterId, 'Voter ID');

            const filter = {
                event: eventId,
                voter: voterId,
                deleted: false,
            };

            if (categoryId) {
                this.validateObjectId(categoryId, 'Category ID');
                filter.category = categoryId;
            }

            const vote = await this.findOne(filter, { skipCache: true });

            return !!vote;
        } catch (error) {
            throw this.handleError(error, 'hasVoted', { eventId, voterId, categoryId });
        }
    }

    // ============================================
    // VOTE STATISTICS
    // ============================================

    /**
     * Count votes by event
     * @param {String} eventId - Event ID
     * @returns {Promise<Number>}
     */
    async countByEvent(eventId) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.count({
                event: eventId,
                deleted: false,
            });
        } catch (error) {
            throw this.handleError(error, 'countByEvent', { eventId });
        }
    }

    /**
     * Count votes by candidate
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Number>}
     */
    async countByCandidate(candidateId) {
        try {
            this.validateObjectId(candidateId, 'Candidate ID');

            return await this.count({
                candidate: candidateId,
                deleted: false,
            });
        } catch (error) {
            throw this.handleError(error, 'countByCandidate', { candidateId });
        }
    }

    /**
     * Get vote results for event
     * @param {String} eventId - Event ID
     * @returns {Promise<Array>}
     */
    async getEventResults(eventId) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            const results = await this.aggregate([
                { $match: { event: this.toObjectId(eventId), deleted: false } },
                {
                    $group: {
                        _id: '$candidate',
                        voteCount: { $sum: 1 },
                    },
                },
                {
                    $lookup: {
                        from: 'candidates',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'candidateInfo',
                    },
                },
                { $unwind: '$candidateInfo' },
                { $sort: { voteCount: -1 } },
            ]);

            return results;
        } catch (error) {
            throw this.handleError(error, 'getEventResults', { eventId });
        }
    }

    /**
     * Get vote results by category
     * @param {String} categoryId - Category ID
     * @returns {Promise<Array>}
     */
    async getCategoryResults(categoryId) {
        try {
            this.validateObjectId(categoryId, 'Category ID');

            const results = await this.aggregate([
                { $match: { category: this.toObjectId(categoryId), deleted: false } },
                {
                    $group: {
                        _id: '$candidate',
                        voteCount: { $sum: 1 },
                    },
                },
                {
                    $lookup: {
                        from: 'candidates',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'candidateInfo',
                    },
                },
                { $unwind: '$candidateInfo' },
                { $sort: { voteCount: -1 } },
            ]);

            return results;
        } catch (error) {
            throw this.handleError(error, 'getCategoryResults', { categoryId });
        }
    }

    /**
     * Get total vote count
     * @param {Object} filter - Optional filter
     * @returns {Promise<Number>}
     */
    async getVoteCount(filter = {}) {
        try {
            return await this.count({ ...filter, deleted: false });
        } catch (error) {
            throw this.handleError(error, 'getVoteCount');
        }
    }

    // ============================================
    // VOTE VALIDATION
    // ============================================

    /**
     * Validate vote
     * @param {String} voteId - Vote ID
     * @returns {Promise<Object>}
     */
    async validateVote(voteId) {
        try {
            this.validateObjectId(voteId, 'Vote ID');

            return await this.updateById(voteId, {
                validated: true,
                validatedAt: new Date(),
            });
        } catch (error) {
            throw this.handleError(error, 'validateVote', { voteId });
        }
    }

    /**
     * Invalidate vote
     * @param {String} voteId - Vote ID
     * @param {String} reason - Invalidation reason
     * @returns {Promise<Object>}
     */
    async invalidateVote(voteId, reason = null) {
        try {
            this.validateObjectId(voteId, 'Vote ID');

            return await this.updateById(voteId, {
                validated: false,
                invalidated: true,
                invalidatedAt: new Date(),
                invalidationReason: reason,
            });
        } catch (error) {
            throw this.handleError(error, 'invalidateVote', { voteId });
        }
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    /**
     * Delete votes by event
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
}

export default VoteRepository;
