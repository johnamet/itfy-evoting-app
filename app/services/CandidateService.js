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
import FileService from './FileService.js';
import { populate } from 'dotenv';

class CandidateService extends BaseService {
    constructor() {
        super();
        this.candidateRepository = new CandidateRepository();
        this.eventRepository = new EventRepository();
        this.categoryRepository = new CategoryRepository();
        this.voteRepository = new VoteRepository();
        this.activityRepository = new ActivityRepository();
        this.fileService = new FileService();
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
            this._validateRequiredFields(candidateData, ['name', 'event', 'categories']);
            this._validateObjectId(candidateData.event, 'Event ID');
            this._validateObjectId(createdBy, 'Created By User ID');
            
            // Validate categories array
            if (!Array.isArray(candidateData.categories) || candidateData.categories.length === 0) {
                throw new Error('Categories must be a non-empty array');
            }
            
            // Validate each category ID
            for (const categoryId of candidateData.categories) {
                this._validateObjectId(categoryId, 'Category ID');
            }

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
                    categoryIds: candidate.categories
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
                    categories: candidate.categories,
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

            // Validate categories if being updated
            if (updateData.categories) {
                if (!Array.isArray(updateData.categories) || updateData.categories.length === 0) {
                    throw new Error('Categories must be a non-empty array');
                }
                
                // Validate each category ID
                for (const categoryId of updateData.categories) {
                    this._validateObjectId(categoryId, 'Category ID');
                }
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            
            // Remove fields that shouldn't be updated
            delete sanitizedData.event;
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
                    categoryIds: candidate.categories
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
     * Get all candidates with optional search and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} All candidates
     */
    async getCandidates(query = {}) {
        try {
            this._log('get_candidates', { query });

            // Validate pagination parameters
            const {page, limit } = this._generatePaginationOptions(
                query.page,
                query.limit,
                50
            );

            // Create filter based on query
            const filter = this._createSearchFilter(query);

            // Get all candidates with pagination
            const candidates = await this.candidateRepository.find(
                filter,
                {
                    page,
                    limit,
                    sort: query.sort || { createdAt: -1 },
                    populate: [
                        {
                            path: 'event',
                            select: 'name date location'
                        },
                        {
                            path: 'categories',
                            select: 'id name votingDeadline'
                        }
                    ]
                }
            );

            const total =  await this.candidateRepository.countDocuments(filter);

            return {
                success: true,
                data: this._formatPaginationResponse(candidates, total, page, limit),
            };
        } catch (error) {
            throw this._handleError(error, 'get_candidates', { query });
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
     * Get candidate statistics (alias for getCandidateStatistics)
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>} Candidate statistics
     */
    async getCandidateStats(candidateId) {
        try {
            this._log('get_candidate_stats', { candidateId });
            
            // Use the existing getCandidateStatistics method
            return await this.getCandidateStatistics(candidateId);
        } catch (error) {
            throw this._handleError(error, 'get_candidate_stats', { candidateId });
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
                this._validateRequiredFields(candidateData, ['name', 'event', 'categories']);
                this._validateObjectId(candidateData.event, 'Event ID');
                
                // Validate categories array
                if (!Array.isArray(candidateData.categories) || candidateData.categories.length === 0) {
                    throw new Error(`Categories must be a non-empty array for candidate: ${candidateData.name}`);
                }
                
                // Validate each category ID
                for (const categoryId of candidateData.categories) {
                    this._validateObjectId(categoryId, 'Category ID');
                }
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

    /**
     * Add category to candidate
     * @param {String} candidateId - Candidate ID
     * @param {String} categoryId - Category ID to add
     * @param {String} updatedBy - ID of user adding the category
     * @returns {Promise<Object>} Update result
     */
    async addCategoryToCandidate(candidateId, categoryId, updatedBy) {
        try {
            this._log('add_category_to_candidate', { 
                candidateId, 
                categoryId, 
                updatedBy 
            });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(categoryId, 'Category ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current candidate
            const candidate = await this.candidateRepository.findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Check if candidate already has the category
            if (candidate.categories.map(cat => cat.toString()).includes(categoryId)) {
                throw new Error('Candidate already has this category');
            }

            // Check if candidate has any votes
            const voteCount = await this.voteRepository.countVotesForCandidate(candidateId);
            if (voteCount > 0) {
                throw new Error('Cannot modify candidate categories as votes have already been cast for this candidate');
            }

            // Check if associated event allows category changes
            const event = await this.eventRepository.findById(candidate.event);
            if (!event) {
                throw new Error('Associated event not found');
            }

            if (event.status === 'active') {
                throw new Error('Cannot modify candidate categories in active event');
            }

            if (event.status === 'completed') {
                throw new Error('Cannot modify candidate categories in completed event');
            }

            // Verify category exists and belongs to the same event
            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            if (category.event.toString() !== candidate.event.toString()) {
                throw new Error('Category must belong to the same event');
            }

            // Add category to candidate
            const updatedCategories = [...candidate.categories, categoryId];
            const updatedCandidate = await this.candidateRepository.updateById(candidateId, {
                categories: updatedCategories,
                updatedAt: new Date()
            });

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'candidate_category_add',
                targetType: 'candidate',
                targetId: candidateId,
                metadata: { 
                    candidateName: candidate.name,
                    eventId: candidate.event,
                    addedCategoryId: categoryId,
                    addedCategoryName: category.name,
                    totalCategories: updatedCategories.length
                }
            });

            this._log('add_category_to_candidate_success', { 
                candidateId,
                categoryAdded: category.name,
                totalCategories: updatedCategories.length
            });

            return {
                success: true,
                message: 'Category added to candidate successfully',
                data: {
                    candidateId: updatedCandidate._id,
                    candidateName: updatedCandidate.name,
                    addedCategory: {
                        id: category._id,
                        name: category.name
                    },
                    totalCategories: updatedCategories.length,
                    updatedAt: updatedCandidate.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'add_category_to_candidate', { 
                candidateId, 
                categoryId 
            });
        }
    }

    /**
     * Remove category from candidate
     * @param {String} candidateId - Candidate ID
     * @param {String} categoryId - Category ID to remove
     * @param {String} updatedBy - ID of user removing the category
     * @returns {Promise<Object>} Update result
     */
    async removeCategoryFromCandidate(candidateId, categoryId, updatedBy) {
        try {
            this._log('remove_category_from_candidate', { 
                candidateId, 
                categoryId, 
                updatedBy 
            });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(categoryId, 'Category ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current candidate
            const candidate = await this.candidateRepository.findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Check if candidate has the category
            if (!candidate.categories.map(cat => cat.toString()).includes(categoryId)) {
                throw new Error('Candidate does not have this category');
            }

            // Check if removing this category would leave candidate with no categories
            if (candidate.categories.length <= 1) {
                throw new Error('Cannot remove category: candidate must have at least one category');
            }

            // Check if candidate has any votes
            const voteCount = await this.voteRepository.countVotesForCandidate(candidateId);
            if (voteCount > 0) {
                throw new Error('Cannot modify candidate categories as votes have already been cast for this candidate');
            }

            // Check if associated event allows category changes
            const event = await this.eventRepository.findById(candidate.event);
            if (!event) {
                throw new Error('Associated event not found');
            }

            if (event.status === 'active') {
                throw new Error('Cannot modify candidate categories in active event');
            }

            if (event.status === 'completed') {
                throw new Error('Cannot modify candidate categories in completed event');
            }

            // Get category for logging
            const category = await this.categoryRepository.findById(categoryId);

            // Remove category from candidate
            const updatedCategories = candidate.categories.filter(cat => cat.toString() !== categoryId);
            const updatedCandidate = await this.candidateRepository.updateById(candidateId, {
                categories: updatedCategories,
                updatedAt: new Date()
            });

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'candidate_category_remove',
                targetType: 'candidate',
                targetId: candidateId,
                metadata: { 
                    candidateName: candidate.name,
                    eventId: candidate.event,
                    removedCategoryId: categoryId,
                    removedCategoryName: category ? category.name : 'Unknown',
                    totalCategories: updatedCategories.length
                }
            });

            this._log('remove_category_from_candidate_success', { 
                candidateId,
                categoryRemoved: category ? category.name : 'Unknown',
                totalCategories: updatedCategories.length
            });

            return {
                success: true,
                message: 'Category removed from candidate successfully',
                data: {
                    candidateId: updatedCandidate._id,
                    candidateName: updatedCandidate.name,
                    removedCategory: {
                        id: categoryId,
                        name: category ? category.name : 'Unknown'
                    },
                    totalCategories: updatedCategories.length,
                    updatedAt: updatedCandidate.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'remove_category_from_candidate', { 
                candidateId, 
                categoryId 
            });
        }
    }

    /**
     * Update candidate photo
     * @param {String} candidateId - Candidate ID
     * @param {Object} imageData - Image file data
     * @param {String} updatedBy - ID of user updating the photo
     * @returns {Promise<Object>} Update result
     */
    async updateCandidatePhoto(candidateId, imageData, updatedBy) {
        try {
            this._log('update_candidate_photo', { candidateId, updatedBy });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current candidate
            const candidate = await this.candidateRepository.findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Check if associated event allows updates
            const event = await this.eventRepository.findById(candidate.event);
            if (!event) {
                throw new Error('Associated event not found');
            }

            if (event.status === 'completed') {
                throw new Error('Cannot update candidate photo in completed event');
            }

            // Backup old image if it exists
            let oldImageBackup = null;
            if (candidate.image) {
                try {
                    oldImageBackup = await this.fileService.createBackup(candidate.image);
                } catch (error) {
                    console.warn('Failed to backup old image:', error.message);
                }
            }

            // Upload new image
            const uploadResult = await this.fileService.uploadCandidateImage(
                imageData, 
                candidateId, 
                updatedBy
            );

            if (!uploadResult.success) {
                throw new Error('Failed to upload image');
            }

            // Update candidate with new image path
            const updateData = {
                image: uploadResult.image.relativePath,
                updatedAt: new Date()
            };

            const updatedCandidate = await this.candidateRepository.updateById(candidateId, updateData);

            // Delete old image file if it exists and upload was successful
            if (candidate.image && candidate.image !== uploadResult.image.relativePath) {
                try {
                    await this.fileService.deleteFile(candidate.image);
                    console.log(`Deleted old candidate image: ${candidate.image}`);
                } catch (error) {
                    console.warn('Failed to delete old image:', error.message);
                }
            }

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'candidate_photo_update',
                targetType: 'candidate',
                targetId: candidateId,
                metadata: { 
                    candidateName: candidate.name,
                    eventId: candidate.event,
                    oldImage: candidate.image,
                    newImage: uploadResult.image.relativePath,
                    imageSize: uploadResult.image.size,
                    imageMimetype: uploadResult.image.mimetype
                }
            });

            this._log('update_candidate_photo_success', { 
                candidateId,
                newImagePath: uploadResult.image.relativePath
            });

            return {
                success: true,
                message: 'Candidate photo updated successfully',
                data: {
                    candidateId: updatedCandidate._id,
                    candidateName: updatedCandidate.name,
                    image: {
                        path: uploadResult.image.relativePath,
                        filename: uploadResult.image.filename,
                        size: uploadResult.image.size,
                        mimetype: uploadResult.image.mimetype,
                        uploadedAt: uploadResult.image.uploadedAt
                    },
                    oldImageBackup: oldImageBackup ? oldImageBackup.backup : null,
                    updatedAt: updatedCandidate.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_candidate_photo', { candidateId });
        }
    }

    /**
     * Remove candidate photo
     * @param {String} candidateId - Candidate ID
     * @param {String} updatedBy - ID of user removing the photo
     * @returns {Promise<Object>} Removal result
     */
    async removeCandidatePhoto(candidateId, updatedBy) {
        try {
            this._log('remove_candidate_photo', { candidateId, updatedBy });

            this._validateObjectId(candidateId, 'Candidate ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current candidate
            const candidate = await this.candidateRepository.findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (!candidate.image) {
                throw new Error('Candidate has no photo to remove');
            }

            // Check if associated event allows updates
            const event = await this.eventRepository.findById(candidate.event);
            if (event.status === 'completed') {
                throw new Error('Cannot remove candidate photo in completed event');
            }

            // Create backup before removal
            let imageBackup = null;
            try {
                imageBackup = await this.fileService.createBackup(candidate.image);
            } catch (error) {
                console.warn('Failed to backup image before removal:', error.message);
            }

            // Update candidate to remove image
            const updateData = {
                image: null,
                updatedAt: new Date()
            };

            const updatedCandidate = await this.candidateRepository.updateById(candidateId, updateData);

            // Delete image file
            try {
                await this.fileService.deleteFile(candidate.image);
                console.log(`Deleted candidate image: ${candidate.image}`);
            } catch (error) {
                console.warn('Failed to delete image file:', error.message);
            }

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'candidate_photo_remove',
                targetType: 'candidate',
                targetId: candidateId,
                metadata: { 
                    candidateName: candidate.name,
                    eventId: candidate.event,
                    removedImage: candidate.image,
                    backupCreated: !!imageBackup
                }
            });

            this._log('remove_candidate_photo_success', { 
                candidateId,
                removedImagePath: candidate.image
            });

            return {
                success: true,
                message: 'Candidate photo removed successfully',
                data: {
                    candidateId: updatedCandidate._id,
                    candidateName: updatedCandidate.name,
                    removedImage: candidate.image,
                    imageBackup: imageBackup ? imageBackup.backup : null,
                    updatedAt: updatedCandidate.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'remove_candidate_photo', { candidateId });
        }
    }

    /**
     * Get candidate vote count across all categories
     * @param {String} candidateId - Candidate ID
     * @returns {Promise<Object>} Vote count with breakdown by category
     */
    async getCandidateVoteCount(candidateId) {
        try {
            this._log('get_candidate_vote_count', { candidateId });

            this._validateObjectId(candidateId, 'Candidate ID');

            // Verify candidate exists
            const candidate = await this.candidateRepository.findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Get votes grouped by category for this candidate
            const votesByCategory = await this.voteRepository.getVoteCountsForCandidate(candidateId);
            
            // Calculate total votes across all categories
            let totalVotes = 0;
            const categoryBreakdown = [];

            for (const categoryVote of votesByCategory) {
                totalVotes += categoryVote.voteCount;
                categoryBreakdown.push({
                    categoryId: categoryVote.categoryId,
                    categoryName: categoryVote.categoryName,
                    voteCount: categoryVote.voteCount
                });
            }

            return {
                success: true,
                data: {
                    candidateId: candidateId,
                    candidateName: candidate.name,
                    totalVotes: totalVotes,
                    categoryBreakdown: categoryBreakdown,
                    generatedAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_candidate_vote_count', { candidateId });
        }
    }

    /**
     * @private
     * Handle errors uniformly
     * @param {Error} error - Error object
     * @param {String} context - Context of the error (e.g., method name)
     * @param {Object} [data] - Additional data to log
     * @returns {Error} - Formatted error
     */
    _handleError(error, context, data) {
        this._log('error', { 
            message: error.message, 
            stack: error.stack, 
            context, 
            data 
        });

        return new Error(`Error in ${context}: ${error.message}`);
    }

    /**
     * @private
     * Sanitize data by removing sensitive fields
     * @param {Object} data - Data to sanitize
     * @returns {Object} - Sanitized data
     */
    _sanitizeData(data) {
        const { password, ...sanitizedData } = data;
        return sanitizedData;
    }

    /**
     * @private
     * Validate required fields in an object
     * @param {Object} obj - Object to validate
     * @param {Array<String>} fields - Array of field names
     * @throws {Error} - If a required field is missing
     */
    _validateRequiredFields(obj, fields) {
        for (const field of fields) {
            if (!obj[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
    }

    /**
     * @private
     * Validate if a string is a valid ObjectId
     * @param {String} id - ID to validate
     * @param {String} [name] - Optional name for the ID (for error messages)
     * @throws {Error} - If the ID is not valid
     */
    _validateObjectId(id, name) {
        if (!id || typeof id !== 'string' || !id.match(/^[0-9a-fA-F]{24}$/)) {
            throw new Error(`Invalid ${name || 'ID'}`);
        }
    }
}

export default CandidateService;
