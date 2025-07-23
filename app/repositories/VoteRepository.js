#!/usr/bin/env node
/**
 * Vote Repository
 * 
 * Extends BaseRepository to provide Vote-specific database operations.
 * Includes vote validation, counting, and election management.
 */

import BaseRepository from './BaseRepository.js';
import Vote from '../models/Vote.js';
import mongoose from 'mongoose';

class VoteRepository extends BaseRepository {
    
    constructor() {
        // Get the Vote model
        const VoteModel = mongoose.model('Vote') || Vote;
        super(VoteModel);
    }

    /**
     * Cast a vote
     * @param {Object} voteData - Vote data
     * @returns {Promise<Object>} Cast vote
     */
    async castVote(voteData) {
        try {
            // Validate candidate belongs to the event and category
            await this._validateVoteData(voteData);

            return await this.create({
                ...voteData,
                votedAt: new Date(),
                ipAddress: voteData.ipAddress || null
            });
        } catch (error) {
            throw this._handleError(error, 'castVote');
        }
    }

    /**
     * Find existing vote for user in event/category
     * @param {String|ObjectId} userId - User ID
     * @param {String|ObjectId} eventId - Event ID
     * @param {String|ObjectId} categoryId - Category ID
     * @returns {Promise<Object|null>} Existing vote or null
     */
    async findExistingVote(userId, eventId, categoryId) {
        try {
            const criteria = {
                user: userId,
                event: eventId,
                category: categoryId
            };

            return await this.findOne(criteria);
        } catch (error) {
            throw this._handleError(error, 'findExistingVote');
        }
    }

    /**
     * Get votes for an event
     * @param {String|ObjectId} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Votes for the event
     */
    async getVotesByEvent(eventId, options = {}) {
        try {
            const criteria = { event: eventId };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' },
                    { path: 'candidate', select: 'name' },
                    { path: 'category', select: 'name' }
                ],
                sort: { votedAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getVotesByEvent');
        }
    }

    /**
     * Get votes for a candidate
     * @param {String|ObjectId} candidateId - Candidate ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Votes for the candidate
     */
    async getVotesByCandidate(candidateId, options = {}) {
        try {
            const criteria = { candidate: candidateId };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'user', select: 'name email' },
                    { path: 'event', select: 'name' },
                    { path: 'category', select: 'name' }
                ],
                sort: { votedAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getVotesByCandidate');
        }
    }



    /**
     * Count votes for a candidate
     * @param {String|ObjectId} candidateId - Candidate ID
     * @returns {Promise<Number>} Vote count
     */
    async countVotesForCandidate(candidateId) {
        try {
            return await this.countDocuments({ candidate: candidateId });
        } catch (error) {
            throw this._handleError(error, 'countVotesForCandidate');
        }
    }

    /**
     * Get vote count by category for an event
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Array>} Vote counts by category
     */
    async getVoteCountsByCategory(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $group: {
                        _id: {
                            category: '$category',
                            candidate: '$candidate'
                        },
                        voteCount: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: '_id.category',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $lookup: {
                        from: 'candidates',
                        localField: '_id.candidate',
                        foreignField: '_id',
                        as: 'candidateInfo'
                    }
                },
                {
                    $group: {
                        _id: '$_id.category',
                        categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
                        candidates: {
                            $push: {
                                candidateId: '$_id.candidate',
                                candidateName: { $arrayElemAt: ['$candidateInfo.name', 0] },
                                voteCount: '$voteCount'
                            }
                        },
                        totalVotes: { $sum: '$voteCount' }
                    }
                },
                {
                    $sort: { categoryName: 1 }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getVoteCountsByCategory');
        }
    }

    /**
     * Get election results for an event
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Object>} Election results
     */
    async getElectionResults(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $group: {
                        _id: {
                            category: '$category',
                            candidate: '$candidate'
                        },
                        voteCount: { $sum: 1 },
                        votes: { $push: '$$ROOT' }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: '_id.category',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $lookup: {
                        from: 'candidates',
                        localField: '_id.candidate',
                        foreignField: '_id',
                        as: 'candidateInfo'
                    }
                },
                {
                    $group: {
                        _id: '$_id.category',
                        categoryName: { $first: { $arrayElemAt: ['$categoryInfo.name', 0] } },
                        candidates: {
                            $push: {
                                candidateId: '$_id.candidate',
                                candidateName: { $arrayElemAt: ['$candidateInfo.name', 0] },
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
                                    candidateId: '$$candidate.candidateId',
                                    candidateName: '$$candidate.candidateName',
                                    voteCount: '$$candidate.voteCount',
                                    percentage: {
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
                                }
                            }
                        }
                    }
                },
                {
                    $addFields: {
                        winner: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: '$candidates',
                                        cond: {
                                            $eq: [
                                                '$$this.voteCount',
                                                { $max: '$candidates.voteCount' }
                                            ]
                                        }
                                    }
                                },
                                0
                            ]
                        }
                    }
                },
                {
                    $sort: { categoryName: 1 }
                }
            ];

            const results = await this.aggregate(pipeline);
            
            // Get overall statistics
            const totalVotes = await this.countDocuments({ event: eventId });
            const uniqueVoters = await this.distinct('user', { event: eventId });
            
            return {
                eventId,
                totalVotes,
                uniqueVoters: uniqueVoters.length,
                categoriesResults: results,
                generatedAt: new Date()
            };
        } catch (error) {
            throw this._handleError(error, 'getElectionResults');
        }
    }

    /**
     * Get voting statistics for an event
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Object>} Voting statistics
     */
    async getVotingStats(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $group: {
                        _id: null,
                        totalVotes: { $sum: 1 },
                        uniqueVoters: { $addToSet: '$user' },
                        votingTimeRange: {
                            $push: '$votedAt'
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalVotes: 1,
                        uniqueVotersCount: { $size: '$uniqueVoters' },
                        firstVote: { $min: '$votingTimeRange' },
                        lastVote: { $max: '$votingTimeRange' }
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            
            return stats || {
                totalVotes: 0,
                uniqueVotersCount: 0,
                firstVote: null,
                lastVote: null
            };
        } catch (error) {
            throw this._handleError(error, 'getVotingStats');
        }
    }

    /**
     * Validate vote data
     * @private
     * @param {Object} voteData - Vote data to validate
     */
    async _validateVoteData(voteData) {
        try {
            if (!voteData.voteBundle || !voteData.candidate || !voteData.event || !voteData.category 
            || !voteData.voter) {
                throw new Error('Missing required vote data');
            }
        } catch (error) {
            throw this._handleError(error, '_validateVoteData');
        }
    }
}

export default VoteRepository;
