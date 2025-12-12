#!/usr/bin/env node
/**
 * NominationRepository - Data access layer for Nomination model
 * 
 * Handles CRUD operations and queries for candidate nominations
 * 
 * @module NominationRepository
 * @version 1.0.0
 */

import BaseRepository from './BaseRepository.js';
import Nomination from '../models/Nomination.js';

/**
 * Repository for managing Nomination documents
 * 
 * @class NominationRepository
 * @extends BaseRepository
 */
class NominationRepository extends BaseRepository {
    /**
     * Create NominationRepository instance
     */
    constructor() {
        super(Nomination);
    }

    /**
     * Create a new nomination
     * 
     * @param {Object} nominationData - Nomination data
     * @returns {Promise<Object>} Created nomination
     */
    async createNomination(nominationData) {
        return await this.create(nominationData);
    }

    /**
     * Find nominations by event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options (pagination, populate)
     * @returns {Promise<Array>} Nominations
     */
    async findByEvent(eventId, filters = {}, options = {}) {
        const query = { event: eventId, ...filters };
        
        let queryBuilder = this.model.find(query);
        
        // Apply population
        if (options.populate !== false) {
            queryBuilder = queryBuilder
                .populate('category', 'name description')
                .populate('candidate', 'name email status')
                .populate('review.reviewedBy', 'firstName lastName email');
        }
        
        // Apply sorting
        queryBuilder = queryBuilder.sort(options.sort || { 'submission.submittedAt': -1 });
        
        // Apply pagination
        if (options.page && options.limit) {
            const skip = (options.page - 1) * options.limit;
            queryBuilder = queryBuilder.skip(skip).limit(options.limit);
        }
        
        return await queryBuilder;
    }

    /**
     * Find pending nominations for an event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Pending nominations
     */
    async findPendingByEvent(eventId, options = {}) {
        return await this.findByEvent(eventId, { status: 'pending' }, options);
    }

    /**
     * Find nominations by category
     * 
     * @param {string} categoryId - Category ID
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Nominations
     */
    async findByCategory(categoryId, filters = {}, options = {}) {
        const query = { category: categoryId, ...filters };
        
        let queryBuilder = this.model.find(query);
        
        if (options.populate !== false) {
            queryBuilder = queryBuilder
                .populate('event', 'name startDate endDate')
                .populate('candidate', 'name email status')
                .populate('review.reviewedBy', 'firstName lastName email');
        }
        
        queryBuilder = queryBuilder.sort(options.sort || { 'submission.submittedAt': -1 });
        
        if (options.page && options.limit) {
            const skip = (options.page - 1) * options.limit;
            queryBuilder = queryBuilder.skip(skip).limit(options.limit);
        }
        
        return await queryBuilder;
    }

    /**
     * Check for duplicate nomination
     * 
     * @param {string} eventId - Event ID
     * @param {string} categoryId - Category ID
     * @param {string} nomineeEmail - Nominee email
     * @returns {Promise<Object|null>} Existing nomination or null
     */
    async checkDuplicate(eventId, categoryId, nomineeEmail) {
        return await this.model.findOne({
            event: eventId,
            category: categoryId,
            'nominee.email': nomineeEmail.toLowerCase(),
            status: { $in: ['pending', 'approved'] }
        }).populate('candidate', 'name status');
    }

    /**
     * Approve a nomination
     * 
     * @param {string} nominationId - Nomination ID
     * @param {string} adminId - Admin user ID
     * @param {string} candidateId - Created candidate ID
     * @returns {Promise<Object>} Updated nomination
     */
    async approve(nominationId, adminId, candidateId) {
        const nomination = await this.findById(nominationId);
        if (!nomination) {
            throw new Error('Nomination not found');
        }
        
        return await nomination.approve(adminId, candidateId);
    }

    /**
     * Reject a nomination
     * 
     * @param {string} nominationId - Nomination ID
     * @param {string} adminId - Admin user ID
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated nomination
     */
    async reject(nominationId, adminId, reason) {
        const nomination = await this.findById(nominationId);
        if (!nomination) {
            throw new Error('Nomination not found');
        }
        
        return await nomination.reject(adminId, reason);
    }

    /**
     * Mark nomination as duplicate
     * 
     * @param {string} nominationId - Nomination ID
     * @param {string} adminId - Admin user ID
     * @param {string} existingCandidateId - Existing candidate ID
     * @returns {Promise<Object>} Updated nomination
     */
    async markAsDuplicate(nominationId, adminId, existingCandidateId) {
        const nomination = await this.findById(nominationId);
        if (!nomination) {
            throw new Error('Nomination not found');
        }
        
        return await nomination.markAsDuplicate(adminId, existingCandidateId);
    }

    /**
     * Get nomination statistics by status
     * 
     * @param {string} eventId - Event ID
     * @param {string} [categoryId] - Optional category ID
     * @returns {Promise<Array>} Status counts
     */
    async getStatusCounts(eventId, categoryId = null) {
        return await this.model.countByStatus(eventId, categoryId);
    }

    /**
     * Get comprehensive nomination statistics
     * 
     * @param {string} eventId - Event ID
     * @returns {Promise<Array>} Category-wise statistics
     */
    async getNominationStats(eventId) {
        return await this.model.getNominationStats(eventId);
    }

    /**
     * Find nominations with pagination
     * 
     * @param {Object} filters - Query filters
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Paginated results
     */
    async findWithPagination(filters = {}, page = 1, limit = 10, options = {}) {
        const query = { ...filters };
        
        const total = await this.model.countDocuments(query);
        
        let queryBuilder = this.model.find(query);
        
        if (options.populate !== false) {
            queryBuilder = queryBuilder
                .populate('event', 'name startDate endDate')
                .populate('category', 'name description')
                .populate('candidate', 'name email status')
                .populate('review.reviewedBy', 'firstName lastName email');
        }
        
        queryBuilder = queryBuilder
            .sort(options.sort || { 'submission.submittedAt': -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        
        const nominations = await queryBuilder;
        
        return {
            nominations,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Search nominations by text
     * 
     * @param {string} searchText - Search query
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching nominations
     */
    async searchNominations(searchText, filters = {}, options = {}) {
        const query = {
            $text: { $search: searchText },
            ...filters
        };
        
        let queryBuilder = this.model.find(query)
            .select({ score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } });
        
        if (options.populate !== false) {
            queryBuilder = queryBuilder
                .populate('event', 'name')
                .populate('category', 'name')
                .populate('candidate', 'name status');
        }
        
        if (options.limit) {
            queryBuilder = queryBuilder.limit(options.limit);
        }
        
        return await queryBuilder;
    }

    /**
     * Count nominations by nominee email
     * 
     * @param {string} nomineeEmail - Nominee email
     * @param {string} [eventId] - Optional event ID
     * @returns {Promise<number>} Count of nominations
     */
    async countByNominee(nomineeEmail, eventId = null) {
        const query = { 'nominee.email': nomineeEmail.toLowerCase() };
        if (eventId) query.event = eventId;
        
        return await this.model.countDocuments(query);
    }

    /**
     * Find nominations by nominee email
     * 
     * @param {string} nomineeEmail - Nominee email
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Nominations
     */
    async findByNominee(nomineeEmail, options = {}) {
        const query = { 'nominee.email': nomineeEmail.toLowerCase() };
        
        let queryBuilder = this.model.find(query);
        
        if (options.populate !== false) {
            queryBuilder = queryBuilder
                .populate('event', 'name startDate endDate')
                .populate('category', 'name')
                .populate('candidate', 'name status');
        }
        
        queryBuilder = queryBuilder.sort({ 'submission.submittedAt': -1 });
        
        return await queryBuilder;
    }

    /**
     * Bulk update nomination status
     * 
     * @param {Array<string>} nominationIds - Array of nomination IDs
     * @param {string} status - New status
     * @param {Object} updateData - Additional update data
     * @returns {Promise<Object>} Update result
     */
    async bulkUpdateStatus(nominationIds, status, updateData = {}) {
        return await this.model.updateMany(
            { _id: { $in: nominationIds } },
            {
                $set: {
                    status,
                    ...updateData
                }
            }
        );
    }
}

export default NominationRepository;
