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
                    { path: 'category', select: 'name description' },
                    { path: 'event', select: 'name status' }
                ],
                sort: { category: 1, name: 1 }
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
            const criteria = { category: categoryId };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'event', select: 'name status' },
                    { path: 'category', select: 'name description' }
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
                category: categoryId 
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
                        localField: 'category',
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
                        category: { $arrayElemAt: ['$categoryInfo', 0] },
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
                        localField: 'category',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $addFields: {
                        voteCount: { $size: '$votes' },
                        category: { $arrayElemAt: ['$categoryInfo', 0] }
                    }
                },
                {
                    $group: {
                        _id: '$category._id',
                        categoryName: { $first: '$category.name' },
                        candidates: {
                            $push: {
                                _id: '$_id',
                                name: '$name',
                                description: '$description',
                                image: '$image',
                                voteCount: '$voteCount'
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
            const { event, category, ...safeUpdateData } = updateData;
            
            return await this.updateById(candidateId, safeUpdateData, {
                populate: [
                    { path: 'category', select: 'name' },
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
                        localField: 'category',
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
                        category: { $arrayElemAt: ['$categoryInfo', 0] },
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
     * Search candidates by name
     * @param {String} searchTerm - Search term
     * @param {String|ObjectId} eventId - Event ID (optional)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching candidates
     */
    async searchByName(searchTerm, eventId = null, options = {}) {
        try {
            const searchRegex = new RegExp(searchTerm, 'i');
            const criteria = {
                name: { $regex: searchRegex }
            };

            if (eventId) {
                criteria.event = eventId;
            }

            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'category', select: 'name' },
                    { path: 'event', select: 'name status' }
                ],
                sort: { name: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'searchByName');
        }
    }

    /**
     * Get candidate statistics
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Object>} Candidate statistics
     */
    async getCandidateStats(candidateId) {
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
                        from: 'votes',
                        let: { eventId: '$event', categoryId: '$category' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$event', '$$eventId'] },
                                            { $eq: ['$category', '$$categoryId'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'categoryVotes'
                    }
                },
                {
                    $addFields: {
                        voteCount: {
                            $sum: {
                                $map: {
                                    input: '$votes',
                                    as: 'vote',
                                    in: {
                                        $size: {
                                            $ifNull: ['$$vote.voteBundle.votes', []]
                                        }
                                    }
                                }
                            }
                        },
                        totalCategoryVotes: {
                            $sum: {
                                $map: {
                                    input: '$categoryVotes',
                                    as: 'vote',
                                    in: {
                                        $size: {
                                            $ifNull: ['$$vote.voteBundle.votes', []]
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        name: 1,
                        voteCount: 1,
                        totalCategoryVotes: 1,
                        percentage: {
                            $cond: [
                                { $eq: ['$totalCategoryVotes', 0] },
                                0,
                                {
                                    $round: [
                                        {
                                            $multiply: [
                                                { $divide: ['$voteCount', '$totalCategoryVotes'] },
                                                100
                                            ]
                                        },
                                        2
                                    ]
                                }
                            ]
                        },
                        ranking: 1 // Would need additional logic to calculate ranking
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            return stats || null;
        } catch (error) {
            throw this._handleError(error, 'getCandidateStats');
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
     * Validate unique candidate in category for event
     * @private
     * @param {Object} candidateData - Candidate data
     */
    async _validateUniqueCandidate(candidateData) {
        const { name, event, category } = candidateData;
        
        if (!name || !event || !category) {
            throw new Error('Name, event, and category are required');
        }

        const existingCandidate = await this.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            event,
            category
        });

        if (existingCandidate) {
            throw new Error(`Candidate "${name}" already exists in this category for this event`);
        }
    }
}

export default CandidateRepository;
