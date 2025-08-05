#!/usr/bin/env node
/**
 * Candidate Repository
 * 
 * Extends BaseRepository to provide Candidate-specific database operations.
 * Includes candidate management, category association, and voting statistics.
 */

import BaseRepository from './BaseRepository.js';
import Candidate from '../models/Candidate.js';
import mongoose from 'mongoose';

class CandidateRepository extends BaseRepository {

    constructor() {
        // Get the Candidate model
        super(Candidate);
    }

    /**
     * Create a new candidate
     * @param {Object} candidateData - Candidate data
     * @returns {Promise<Object>} Created candidate
     */
    async createCandidate(candidateData) {
        try {
            // Validate candidate doesn't already exist in the same category for the event
            await this._validateUniqueCandidate(candidateData);

            return await this.create(candidateData);
        } catch (error) {
            throw this._handleError(error, 'createCandidate');
        }
    }

    /**
     * Find candidates by event
     * @param {String|ObjectId} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Candidates for the event
     */
    async findByEvent(eventId, options = {}) {
        try {
            const criteria = { event: eventId };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'categories', select: 'name description' },
                    { path: 'event', select: 'name status' }
                ],
                sort: { name: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByEvent');
        }
    }

    /**
     * Find candidates by category
     * @param {String|ObjectId} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Candidates in the category
     */
    async findByCategory(categoryId, options = {}) {
        try {
            const criteria = { categories: categoryId };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'event', select: 'name status' },
                    { path: 'categories', select: 'name description' }
                ],
                sort: { name: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByCategory');
        }
    }

    /**
     * Find candidates by event and category
     * @param {String|ObjectId} eventId - Event ID
     * @param {String|ObjectId} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Candidates in the event and category
     */
    async findByEventAndCategory(eventId, categoryId, options = {}) {
        try {
            const criteria = {
                event: eventId,
                categories: categoryId
            };
            return await this.find(criteria, {
                ...options,
                sort: { name: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByEventAndCategory');
        }
    }

    /**
     * Get candidate with vote statistics
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object|null>} Candidate with vote stats
     */
    async getCandidateWithStats(candidateId) {
        try {
            const pipeline = [
                { $match: { _id: new mongoose.Types.ObjectId(candidateId) } },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'candidate',
                        as: 'votes'
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'categories',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $lookup: {
                        from: 'events',
                        localField: 'event',
                        foreignField: '_id',
                        as: 'eventInfo'
                    }
                },
                {
                    $addFields: {
                        voteCount: { $size: '$votes' },
                        categories: '$categoryInfo',
                        event: { $arrayElemAt: ['$eventInfo', 0] }
                    }
                },
                {
                    $project: {
                        categoryInfo: 0,
                        eventInfo: 0,
                        votes: 0
                    }
                }
            ];

            const [candidate] = await this.aggregate(pipeline);
            console.log(candidate)
            return candidate || null;
        } catch (error) {
            throw this._handleError(error, 'getCandidateWithStats');
        }
    }

    /**
     * Get candidates with vote statistics for an event
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Array>} Candidates with vote statistics
     */
    async getCandidatesWithStatsForEvent(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'candidate',
                        as: 'votes'
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'categories',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $addFields: {
                        voteCount: { $size: '$votes' },
                        categories: '$categoryInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$categories',
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $group: {
                        _id: '$categories._id',
                        categoryName: { $first: '$categories.name' },
                        candidates: {
                            $push: {
                                _id: '$_id',
                                name: '$name',
                                description: '$description',
                                image: '$image',
                                voteCount: '$voteCount',
                                allCategories: '$categoryInfo'
                            }
                        },
                        totalVotes: { $sum: '$voteCount' }
                    }
                },
                {
                    $addFields: {
                        candidates: {
                            $map: {
                                input: '$candidates',
                                as: 'candidate',
                                in: {
                                    _id: '$$candidate._id',
                                    name: '$$candidate.name',
                                    description: '$$candidate.description',
                                    image: '$$candidate.image',
                                    voteCount: '$$candidate.voteCount',
                                    percentage: {
                                        $cond: [
                                            { $eq: ['$totalVotes', 0] },
                                            0,
                                            {
                                                $round: [
                                                    {
                                                        $multiply: [
                                                            { $divide: ['$$candidate.voteCount', '$totalVotes'] },
                                                            100
                                                        ]
                                                    },
                                                    2
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $sort: { categoryName: 1 }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getCandidatesWithStatsForEvent');
        }
    }

    /**
     * Update candidate information
     * @param {String|ObjectId} candidateId - Candidate ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} Updated candidate
     */
    async updateCandidate(candidateId, updateData) {
        try {
            // Remove fields that shouldn't be updated directly
            const { event, ...safeUpdateData } = updateData;

            return await this.updateById(candidateId, safeUpdateData, {
                populate: [
                    { path: 'categories', select: 'name' },
                    { path: 'event', select: 'name status' }
                ]
            });
        } catch (error) {
            throw this._handleError(error, 'updateCandidate');
        }
    }



    /**
     * Get top candidates by votes
     * @param {String|ObjectId} eventId - Event ID (optional)
     * @param {Number} limit - Number of top candidates to return
     * @returns {Promise<Array>} Top candidates
     */
    async getTopCandidates(eventId = null, limit = 10) {
        try {
            const matchStage = eventId
                ? { $match: { event: new mongoose.Types.ObjectId(eventId) } }
                : { $match: {} };

            const pipeline = [
                matchStage,
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'candidate',
                        as: 'votes'
                    }
                },
                {
                    $addFields: {
                        voteCount: {
                            $sum: {
                                $map: {
                                    input: '$votes',
                                    as: 'vote',
                                    in: { $size: { $ifNull: ['$$vote.voteBundle.votes', []] } }
                                }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'categories',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $lookup: {
                        from: 'events',
                        localField: 'event',
                        foreignField: '_id',
                        as: 'eventInfo'
                    }
                },
                {
                    $addFields: {
                        categories: '$categoryInfo',
                        event: { $arrayElemAt: ['$eventInfo', 0] }
                    }
                },
                {
                    $sort: { voteCount: -1, name: 1 }
                },
                {
                    $limit: limit
                },
                {
                    $project: {
                        categoryInfo: 0,
                        eventInfo: 0,
                        votes: 0
                    }
                }
            ];

            // Remove the empty match stage if no eventId
            if (!eventId) {
                pipeline.shift();
            }

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getTopCandidates');
        }
    }

    /**
     * Get candidate with detailed statistics
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object|null>} Candidate with detailed statistics
     */
    async getCandidateWithStatistics(candidateId) {
        try {
            const pipeline = [
                { $match: { _id: new mongoose.Types.ObjectId(candidateId) } },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'candidate',
                        as: 'votes'
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'categories',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $lookup: {
                        from: 'events',
                        localField: 'event',
                        foreignField: '_id',
                        as: 'eventInfo'
                    }
                },
                {
                    $addFields: {
                        voteCount: { $size: '$votes' },
                        categories: '$categoryInfo',
                        event: { $arrayElemAt: ['$eventInfo', 0] }
                    }
                },
                {
                    $project: {
                        categoryInfo: 0,
                        eventInfo: 0,
                        votes: 0
                    }
                }
            ];

            const [candidate] = await this.aggregate(pipeline);
            return candidate || null;
        } catch (error) {
            throw this._handleError(error, 'getCandidateWithStatistics');
        }
    }

    /**
     * Get candidates with statistics for an event
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Array>} Candidates with statistics grouped by category
     */
    async getCandidatesWithStatisticsForEvent(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'candidate',
                        as: 'votes'
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'categories',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $addFields: {
                        voteCount: { $size: '$votes' },
                        categories: '$categoryInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$categories',
                        preserveNullAndEmptyArrays: false
                    }
                },
                {
                    $group: {
                        _id: '$categories._id',
                        categoryName: { $first: '$categories.name' },
                        candidates: {
                            $push: {
                                _id: '$_id',
                                name: '$name',
                                description: '$description',
                                image: '$image',
                                voteCount: '$voteCount',
                                allCategories: '$categoryInfo'
                            }
                        }
                    }
                },
                {
                    $sort: { categoryName: 1 }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getCandidatesWithStatisticsForEvent');
        }
    }


    /**
     * Search candidates by name
     * @param {String} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching candidates
     */
    async searchCandidatesByName(searchTerm, options = {}) {
        try {
            return await this.searchByName(searchTerm, options.eventId, options);
        } catch (error) {
            throw this._handleError(error, 'searchCandidatesByName');
        }
    }

    /**
     * Search candidates by name within a specific event
     * @param {String} searchTerm - Search term
     * @param {String|ObjectId} eventId - Event ID
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Matching candidates
     */
    async searchByName(searchTerm, eventId, options = {}) {
        try {
            const criteria = {
                name: { $regex: new RegExp(searchTerm, 'i') },
                event: eventId
            };

            return await this.find(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'searchByName');
        }
    }
    /**
     * Get detailed candidate statistics
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object>} Detailed candidate statistics
     */
    async getCandidateStatistics(candidateId) {
        try {
            const pipeline = [
                { $match: { _id: new mongoose.Types.ObjectId(candidateId) } },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'candidate',
                        as: 'votes'
                    }
                },
                { $unwind: { path: '$votes', preserveNullAndEmptyArrays: true } }, // Unwind votes array
                {
                    $lookup: {
                        from: 'voteBundles',
                        localField: 'votes.voteBundles',
                        foreignField: '_id',
                        as: 'voteBundles'
                    }
                },
                { $unwind: { path: '$voteBundles', preserveNullAndEmptyArrays: true } }, // Unwind voteBundles array
                {
                    $group: {
                        _id: '$_id',
                        name: { $first: '$name' },
                        description: { $first: '$description' },
                        image: { $first: '$image' },
                        createdAt: { $first: '$createdAt' },
                        categories: { $first: '$categories' }, // Preserve the categories array
                        event: { $first: '$event' },
                        totalVotes: { $sum: '$voteBundles.votes' } // Sum votes from all voteBundles
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'categories',
                        foreignField: '_id',
                        as: 'categories'
                    }
                },
                {
                    $lookup: {
                        from: 'events',
                        localField: 'event',
                        foreignField: '_id',
                        as: 'event'
                    }
                },
                {
                    $project: {
                        name: 1,
                        description: { $ifNull: ['$description', 'No description available'] },
                        image: { $ifNull: ['$image', 'No image available'] },
                        totalVotes: 1,
                        categories: {
                            $map: {
                                input: '$categories',
                                as: 'cat',
                                in: { name: '$$cat.name', _id: '$$cat._id' }
                            }
                        },
                        event: {
                            $let: {
                                vars: { event: { $arrayElemAt: ['$event', 0] } },
                                in: { name: '$$event.name', _id: '$$event._id' }
                            }
                        },
                        createdAt: 1
                    }
                }
            ];

            const [statistics] = await this.aggregate(pipeline);
            return statistics || null;
        } catch (error) {
            throw this._handleError(error, 'getCandidateStatistics');
        }
    }
    /**
         * Bulk create candidates
         * @param {Array} candidatesData - Array of candidate data
         * @returns {Promise<Array>} Created candidates
         */
    async bulkCreateCandidates(candidatesData) {
        try {
            // Validate each candidate
            for (const candidateData of candidatesData) {
                await this._validateUniqueCandidate(candidateData);
            }

            return await this.createMany(candidatesData);
        } catch (error) {
            throw this._handleError(error, 'bulkCreateCandidates');
        }
    }

    /**
     * Update the candidate's categories (not used with new multiple categories approach)
     * @deprecated Use direct updateById method instead
     * @param {String|ObjectId} candidateId - Candidate ID
     * @param {Array} categoryIds - Category IDs array
     * @returns {Promise<Object|null>} Updated candidate
     */
    async updateCandidateCategories(candidateId, categoryIds) {
        try {
            if (!Array.isArray(categoryIds)) {
                categoryIds = [categoryIds];
            }

            // Validate each category ID
            for (const categoryId of categoryIds) {
                this._validateObjectId(categoryId, 'categoryId');
            }

            return await this.updateById(candidateId, {
                categories: categoryIds,
                updatedAt: new Date()
            });
        } catch (error) {
            throw this._handleError(error, 'updateCandidateCategories');
        }
    }

    /**
     * Delete candidate (only if no votes exist)
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object|null>} Deleted candidate
     */
    async deleteCandidate(candidateId) {
        try {
            // Check if candidate has votes
            const voteCount = await mongoose.model('Vote').countDocuments({ candidate: candidateId });

            if (voteCount > 0) {
                throw new Error('Cannot delete candidate with existing votes');
            }

            return await this.deleteById(candidateId);
        } catch (error) {
            throw this._handleError(error, 'deleteCandidate');
        }
    }

    /**
     * Validate unique candidate in categories for event
     * @private
     * @param {Object} candidateData - Candidate data
     */
    async _validateUniqueCandidate(candidateData) {
        const { name, event, categories } = candidateData;

        if (!name || !event || !categories) {
            throw new Error('Name, event, and categories are required');
        }

        if (!Array.isArray(categories) || categories.length === 0) {
            throw new Error('Categories must be a non-empty array');
        }

        // Check if candidate with same name exists in the same event
        // We'll allow candidates with same name in different categories of the same event
        // but prevent exact duplicates across all categories
        const existingCandidate = await this.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            event,
            categories: { $in: categories }
        });

        if (existingCandidate) {
            throw new Error(`Candidate "${name}" already exists with overlapping categories in this event`);
        }
    }
}

export default CandidateRepository;
