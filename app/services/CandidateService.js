#!/usr/bin/env node
/**
 * Candidate Service
 * 
 * Handles candidate management including creation, updates,
 * candidate statistics, and candidate-related business logic.
 */

import BaseService from './BaseService.js';
import CandidateRepository from '../repositories/CandidateRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import CategoryRepository from '../repositories/CategoryRepository.js';
import VoteRepository from '../repositories/VoteRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';

class CandidateService extends BaseService {
    constructor() {
        super();
        this.candidateRepository = new CandidateRepository();
        this.eventRepository = new EventRepository();
        this.categoryRepository = new CategoryRepository();
        this.voteRepository = new VoteRepository();
        this.activityRepository = new ActivityRepository();
    }

    /**
     * Create a new candidate
     * @param {Object} candidateData - Candidate data
     * @param {String} createdBy - ID of user creating the candidate
     * @returns {Promise<Object>} Created candidate
     */
    async createCandidate(candidateData, createdBy) {
        try {
            this._log('create_candidate', { 
                name: candidateData.name, 
                event: candidateData.event,
                createdBy 
            });

            // Validate required fields
            this._validateRequiredFields(candidateData, ['name', 'event', 'category']);
            this._validateObjectId(candidateData.event, 'Event ID');
            this._validateObjectId(candidateData.category, 'Category ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Check if event exists and is not completed
            const event = await this.eventRepository.findById(candidateData.event);
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status === 'completed') {
                throw new Error('Cannot add candidates to completed event');
            }

            if (event.status === 'active') {
                throw new Error('Cannot add candidates to active event');
            }

            // Validate candidate name length and format
            if (candidateData.name.trim().length < 2) {
                throw new Error('Candidate name must be at least 2 characters long');
            }

            if (candidateData.name.trim().length > 100) {
                throw new Error('Candidate name must be less than 100 characters');
            }

            // Create candidate
            const candidateToCreate = {
                ...this._sanitizeData(candidateData),
                name: candidateData.name.trim(),
                createdBy,
                createdAt: new Date()
            };

            const candidate = await this.candidateRepository.createCandidate(candidateToCreate);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'candidate_create',
                targetType: 'candidate',
                targetId: candidate._id,
                metadata: { 
                    candidateName: candidate.name,
                    eventId: candidate.event,
                    categoryId: candidate.category
                }
            });

            this._log('create_candidate_success', { 
                candidateId: candidate._id, 
                name: candidate.name 
            });

            return {
                success: true,
                candidate: {
                    id: candidate._id,
                    name: candidate.name,
                    bio: candidate.bio,
                    image: candidate.image,
                    event: candidate.event,
                    category: candidate.category,
                    createdAt: candidate.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_candidate', { 
                name: candidateData.name,
                event: candidateData.event 
            });
        }
    }

    /**
     * Update candidate information
     * @param {String} candidateId - Candidate ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user updating the candidate
     * @returns {Promise<Object>} Updated candidate
     */
    async updateCandidate(candidateId, updateData, updatedBy) {
        try {
            this._log('update_candidate', { candidateId, updatedBy });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current candidate
            const currentCandidate = await this.candidateRepository.findById(candidateId);
            if (!currentCandidate) {
                throw new Error('Candidate not found');
            }

            // Check if associated event allows updates
            const event = await this.eventRepository.findById(currentCandidate.event);
            if (event.status === 'completed') {
                throw new Error('Cannot update candidate in completed event');
            }

            // Validate name if being updated
            if (updateData.name) {
                if (updateData.name.trim().length < 2) {
                    throw new Error('Candidate name must be at least 2 characters long');
                }
                if (updateData.name.trim().length > 100) {
                    throw new Error('Candidate name must be less than 100 characters');
                }
                updateData.name = updateData.name.trim();
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            
            // Remove fields that shouldn't be updated
            delete sanitizedData.event;
            delete sanitizedData.category;
            delete sanitizedData._id;
            delete sanitizedData.createdAt;
            delete sanitizedData.createdBy;
            
            sanitizedData.updatedAt = new Date();

            // Update candidate
            const updatedCandidate = await this.candidateRepository.updateById(candidateId, sanitizedData);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'candidate_update',
                targetType: 'candidate',
                targetId: candidateId,
                metadata: { 
                    candidateName: updatedCandidate.name,
                    updatedFields: Object.keys(sanitizedData)
                }
            });

            this._log('update_candidate_success', { candidateId });

            return {
                success: true,
                candidate: {
                    id: updatedCandidate._id,
                    name: updatedCandidate.name,
                    bio: updatedCandidate.bio,
                    image: updatedCandidate.image,
                    updatedAt: updatedCandidate.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_candidate', { candidateId });
        }
    }

    /**
     * Delete a candidate
     * @param {String} candidateId - Candidate ID
     * @param {String} deletedBy - ID of user deleting the candidate
     * @returns {Promise<Object>} Deletion result
     */
    async deleteCandidate(candidateId, deletedBy) {
        try {
            this._log('delete_candidate', { candidateId, deletedBy });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(deletedBy, 'Deleted By User ID');

            // Get candidate
            const candidate = await this.candidateRepository.findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Check if candidate has votes
            const voteCount = await this.voteRepository.countVotesForCandidate(candidateId);
            if (voteCount > 0) {
                throw new Error('Cannot delete candidate with existing votes');
            }

            // Check if associated event allows deletions
            const event = await this.eventRepository.findById(candidate.event);
            if (event.status === 'active' || event.status === 'completed') {
                throw new Error('Cannot delete candidate from active or completed event');
            }

            // Delete candidate
            await this.candidateRepository.deleteCandidate(candidateId);

            // Log activity
            await this.activityRepository.logActivity({
                user: deletedBy,
                action: 'candidate_delete',
                targetType: 'candidate',
                targetId: candidateId,
                metadata: { 
                    candidateName: candidate.name,
                    eventId: candidate.event,
                    categoryId: candidate.category
                }
            });

            this._log('delete_candidate_success', { candidateId });

            return {
                success: true,
                message: 'Candidate deleted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'delete_candidate', { candidateId });
        }
    }

    /**
     * Get candidate by ID with statistics
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>} Candidate with statistics
     */
    async getCandidateById(candidateId) {
        try {
            this._log('get_candidate_by_id', { candidateId });

            this._validateObjectId(candidateId, 'Candidate ID');

            const candidate = await this.candidateRepository.getCandidateWithStatistics(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            return {
                success: true,
                candidate
            };
        } catch (error) {
            throw this._handleError(error, 'get_candidate_by_id', { candidateId });
        }
    }

    /**
     * Get candidates by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Event candidates
     */
    async getCandidatesByEvent(eventId, options = {}) {
        try {
            this._log('get_candidates_by_event', { eventId, options });

            this._validateObjectId(eventId, 'Event ID');

            // Check if event exists
            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get candidates with statistics
            const candidates = await this.candidateRepository.getCandidatesWithStatisticsForEvent(eventId);

            return {
                success: true,
                data: {
                    event: {
                        id: event._id,
                        name: event.name,
                        status: event.status
                    },
                    candidates
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_candidates_by_event', { eventId });
        }
    }

    /**
     * Get candidates by category
     * @param {String} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Category candidates
     */
    async getCandidatesByCategory(categoryId, options = {}) {
        try {
            this._log('get_candidates_by_category', { categoryId, options });

            this._validateObjectId(categoryId, 'Category ID');

            const candidates = await this.candidateRepository.findByCategory(categoryId, options);

            return {
                success: true,
                data: candidates
            };
        } catch (error) {
            throw this._handleError(error, 'get_candidates_by_category', { categoryId });
        }
    }

    /**
     * Search candidates by name
     * @param {String} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async searchCandidates(searchTerm, options = {}) {
        try {
            this._log('search_candidates', { searchTerm, options });

            if (!searchTerm || searchTerm.trim().length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            const candidates = await this.candidateRepository.searchCandidatesByName(
                searchTerm, 
                options
            );

            return {
                success: true,
                data: candidates
            };
        } catch (error) {
            throw this._handleError(error, 'search_candidates', { searchTerm });
        }
    }

    /**
     * Get top candidates by votes
     * @param {String} eventId - Event ID (optional)
     * @param {Number} limit - Number of top candidates to return
     * @returns {Promise<Object>} Top candidates
     */
    async getTopCandidates(eventId = null, limit = 10) {
        try {
            this._log('get_top_candidates', { eventId, limit });

            if (eventId) {
                this._validateObjectId(eventId, 'Event ID');
            }

            const topCandidates = await this.candidateRepository.getTopCandidates(eventId, limit);

            return {
                success: true,
                data: topCandidates
            };
        } catch (error) {
            throw this._handleError(error, 'get_top_candidates', { eventId, limit });
        }
    }

    /**
     * Get detailed statistics for a candidate
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>} Candidate statistics
     */
    async getCandidateStatistics(candidateId) {
        try {
            this._log('get_candidate_statistics', { candidateId });

            this._validateObjectId(candidateId, 'Candidate ID');

            const statistics = await this.candidateRepository.getCandidateStatistics(candidateId);

            return {
                success: true,
                data: {
                    ...statistics,
                    generatedAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_candidate_statistics', { candidateId });
        }
    }

    /**
     * Bulk create candidates
     * @param {Array} candidatesData - Array of candidate data
     * @param {String} createdBy - ID of user creating candidates
     * @returns {Promise<Object>} Bulk creation result
     */
    async bulkCreateCandidates(candidatesData, createdBy) {
        try {
            this._log('bulk_create_candidates', { 
                count: candidatesData.length, 
                createdBy 
            });

            this._validateObjectId(createdBy, 'Created By User ID');

            if (!Array.isArray(candidatesData) || candidatesData.length === 0) {
                throw new Error('Candidates data must be a non-empty array');
            }

            // Validate each candidate data
            for (const candidateData of candidatesData) {
                this._validateRequiredFields(candidateData, ['name', 'event', 'category']);
                this._validateObjectId(candidateData.event, 'Event ID');
                this._validateObjectId(candidateData.category, 'Category ID');
            }

            // Add creation metadata to each candidate
            const candidatesToCreate = candidatesData.map(candidate => ({
                ...this._sanitizeData(candidate),
                name: candidate.name.trim(),
                createdBy,
                createdAt: new Date()
            }));

            // Bulk create
            const result = await this.candidateRepository.bulkCreateCandidates(candidatesToCreate);

            // Log activity for successful creations
            for (const candidate of result.success) {
                await this.activityRepository.logActivity({
                    user: createdBy,
                    action: 'candidate_bulk_create',
                    targetType: 'candidate',
                    targetId: candidate._id,
                    metadata: { 
                        candidateName: candidate.name,
                        batchSize: candidatesData.length
                    }
                });
            }

            this._log('bulk_create_candidates_success', { 
                successCount: result.successCount,
                errorCount: result.errorCount 
            });

            return {
                success: true,
                data: result
            };
        } catch (error) {
            throw this._handleError(error, 'bulk_create_candidates', { 
                count: candidatesData.length 
            });
        }
    }
}

export default CandidateService;
