#!/usr/bin/env node
/**
 * Vote Repository
 * 
 * Extends BaseRepository to provide Vote-specific database operations.
 * Handles vote casting, validation, counting, and election management.
 * 
 * @module VoteRepository
 */

import mongoose from 'mongoose';
import BaseRepository from './BaseRepository.js';
import Vote from '../models/Vote.js';
import validator from 'validator'; // For IP address validation

/**
 * Repository class for managing Vote operations.
 * @extends BaseRepository
 */
class VoteRepository extends BaseRepository {
    /**
     * Initializes the repository with the Vote model.
     */
    constructor() {
        super(Vote);
    }

    /**
     * Casts a single vote with validation.
     * @param {Object} voteData - The vote data.
     * @param {mongoose.Types.ObjectId|string} voteData.candidate - The candidate ID.
     * @param {mongoose.Types.ObjectId|string|Object} voteData.voter - The voter ID or data.
     * @param {mongoose.Types.ObjectId|string} voteData.event - The event ID.
     * @param {mongoose.Types.ObjectId|string} voteData.category - The category ID.
     * @param {mongoose.Types.ObjectId|string|string[]|mongoose.Types.ObjectId[]} voteData.voteBundles - The vote bundle ID(s).
     * @param {string} [voteData.ipAddress] - The voter's IP address.
     * @param {Object} [options={}] - Additional Mongoose options (e.g., session).
     * @returns {Promise<Object>} The created vote document.
     * @throws {Error} If validation fails or the operation encounters an error.
     */
    async castVote(voteData, options = {}) {
        try {
            await this._validateVoteData(voteData);

            const voteBundles = Array.isArray(voteData.voteBundles)
                ? voteData.voteBundles.map(id => new mongoose.Types.ObjectId(id))
                : [new mongoose.Types.ObjectId(voteData.voteBundles)];

            return await this.create(
                {
                    ...voteData,
                    voteBundles,
                    votedAt: new Date(),
                    ipAddress: voteData.ipAddress || null
                },
                options
            );
        } catch (error) {
            throw this._handleError(error, 'castVote');
        }
    }

    /**
     * Casts multiple votes in a single transaction.
     * @param {Object[]} votesData - Array of vote data objects.
     * @param {Object} [options={}] - Additional Mongoose options.
     * @returns {Promise<Object[]>} Array of created vote documents.
     * @throws {Error} If validation fails or the operation encounters an error.
     */
    async bulkCastVotes(votesData, options = {}) {
        try {
            await Promise.all(votesData.map(vote => this._validateVoteData(vote)));

            const formattedVotes = votesData.map(vote => ({
                ...vote,
                voteBundles: Array.isArray(vote.voteBundles)
                    ? vote.voteBundles.map(id => new mongoose.Types.ObjectId(id))
                    : [new mongoose.Types.ObjectId(vote.voteBundles)],
                votedAt: new Date(),
                ipAddress: vote.ipAddress || null
            }));

            return await this.createMany(formattedVotes, options);
        } catch (error) {
            throw this._handleError(error, 'bulkCastVotes');
        }
    }

    /**
     * Revokes a vote if allowed (e.g., within a time window or by admin).
     * @param {mongoose.Types.ObjectId|string} voteId - The vote ID.
     * @param {Object} [options={}] - Delete options.
     * @returns {Promise<Object|null>} The deleted vote document.
     * @throws {Error} If the vote cannot be revoked or the operation encounters an error.
     */
    async revokeVote(voteId, options = {}) {
        try {
            const vote = await this.findById(voteId);
            if (!vote) throw new Error('Vote not found');
            // Example restriction: Only allow revocation within 24 hours
            const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (vote.votedAt < timeLimit) throw new Error('Vote revocation period has expired');

            return await this.deleteById(voteId, options);
        } catch (error) {
            throw this._handleError(error, 'revokeVote');
        }
    }

    /**
     * Finds an existing vote for a user in an event and category.
     * @param {mongoose.Types.ObjectId|string} userId - The user ID.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @param {mongoose.Types.ObjectId|string} categoryId - The category ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object|null>} The existing vote or null.
     * @throws {Error} If the operation encounters an error.
     */
    async findExistingVote(userId, eventId, categoryId, options = {}) {
        try {
            const criteria = {
                voter: new mongoose.Types.ObjectId(userId),
                event: new mongoose.Types.ObjectId(eventId),
                category: new mongoose.Types.ObjectId(categoryId)
            };
            return await this.findOne(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findExistingVote');
        }
    }

    /**
     * Retrieves votes for a specific event.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object>} Paginated vote results.
     * @throws {Error} If the operation encounters an error.
     */
    async getVotesByEvent(eventId, options = {}) {
        try {
            const criteria = { event: new mongoose.Types.ObjectId(eventId) };
            return await this.findWithPagination(criteria, options.page || 1, options.limit || 10, {
                ...options,
                populate: [
                    { path: 'voter', select: 'name email' },
                    { path: 'candidate', select: 'name' },
                    { path: 'category', select: 'name' },
                    { path: 'voteBundles', select: 'name votes price' }
                ],
                sort: { votedAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getVotesByEvent');
        }
    }

    /**
     * Retrieves votes for a specific candidate.
     * @param {mongoose.Types.ObjectId|string} candidateId - The candidate ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object>} Paginated vote results.
     * @throws {Error} If the operation encounters an error.
     */
    async getVotesByCandidate(candidateId, options = {}) {
        try {
            const criteria = { candidate: new mongoose.Types.ObjectId(candidateId) };
            return await this.findWithPagination(criteria, options.page || 1, options.limit || 10, {
                ...options,
                populate: [
                    { path: 'voter', select: 'name email' },
                    { path: 'event', select: 'name' },
                    { path: 'category', select: 'name' },
                    { path: 'voteBundles', select: 'name votes price' }
                ],
                sort: { votedAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getVotesByCandidate');
        }
    }

    /**
     * Counts votes for a specific candidate.
     * @param {mongoose.Types.ObjectId|string} candidateId - The candidate ID.
     * @returns {Promise<number>} The vote count.
     * @throws {Error} If the operation encounters an error.
     */
    async countVotesForCandidate(candidateId) {
        try {
            return await this.countDocuments({ candidate: new mongoose.Types.ObjectId(candidateId) });
        } catch (error) {
            throw this._handleError(error, 'countVotesForCandidate');
        }
    }

    /**
     * Retrieves vote counts for a specific candidate across all categories
     * @param {mongoose.Types.ObjectId|string} candidateId - The candidate ID.
     * @returns {Promise<Array>} Vote counts grouped by category for the candidate.
     * @throws {Error} If the operation encounters an error.
     */
    async getVoteCountsForCandidate(candidateId) {
        try {
            const pipeline = [
                { $match: { candidate: new mongoose.Types.ObjectId(candidateId) } },
                {
                    $group: {
                        _id: '$category',
                        voteCount: { $sum: 1 }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $project: {
                        categoryId: '$_id',
                        categoryName: { $arrayElemAt: ['$categoryInfo.name', 0] },
                        voteCount: 1,
                        _id: 0
                    }
                },
                { $sort: { categoryName: 1 } }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getVoteCountsForCandidate');
        }
    }

    /**
     * Retrieves vote counts by category for an event.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @returns {Promise<Array>} Vote counts grouped by category and candidate.
     * @throws {Error} If the operation encounters an error.
     */
    async getVoteCountsByCategory(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $group: {
                        _id: { category: '$category', candidate: '$candidate' },
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
                { $sort: { categoryName: 1 } }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getVoteCountsByCategory');
        }
    }

    /**
     * Retrieves election results for an event, including winner and vote percentages.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @returns {Promise<Object>} Election results with category-wise winners and statistics.
     * @throws {Error} If the operation encounters an error.
     */
    async getElectionResults(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $group: {
                        _id: { category: '$category', candidate: '$candidate' },
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
                                            { $multiply: [{ $divide: ['$$candidate.voteCount', '$totalVotes'] }, 100] },
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
                                        cond: { $eq: ['$$this.voteCount', { $max: '$candidates.voteCount' }] }
                                    }
                                },
                                0
                            ]
                        }
                    }
                },
                { $sort: { categoryName: 1 } }
            ];

            const results = await this.aggregate(pipeline);
            const totalVotes = await this.countDocuments({ event: eventId });
            const uniqueVoters = await this.distinct('voter', { event: eventId });

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
     * Retrieves voting statistics for an event.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @returns {Promise<Object>} Voting statistics including total votes and time range.
     * @throws {Error} If the operation encounters an error.
     */
    async getVotingStats(eventId) {
        try {
            const pipeline = [
                { $match: { event: new mongoose.Types.ObjectId(eventId) } },
                {
                    $group: {
                        _id: null,
                        totalVotes: { $sum: 1 },
                        uniqueVoters: { $addToSet: '$voter' },
                        votingTimeRange: { $push: '$votedAt' },
                        votesByCategory: {
                            $push: {
                                category: '$category',
                                voteCount: { $sum: 1 }
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'votesByCategory.category',
                        foreignField: '_id',
                        as: 'categoryInfo'
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalVotes: 1,
                        uniqueVotersCount: { $size: '$uniqueVoters' },
                        firstVote: { $min: '$votingTimeRange' },
                        lastVote: { $max: '$votingTimeRange' },
                        categoryStats: {
                            $map: {
                                input: '$votesByCategory',
                                as: 'vote',
                                in: {
                                    categoryId: '$$vote.category',
                                    categoryName: {
                                        $arrayElemAt: [
                                            '$categoryInfo.name',
                                            { $indexOfArray: ['$categoryInfo._id', '$$vote.category'] }
                                        ]
                                    },
                                    voteCount: '$$vote.voteCount'
                                }
                            }
                        }
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            return stats || {
                totalVotes: 0,
                uniqueVotersCount: 0,
                firstVote: null,
                lastVote: null,
                categoryStats: []
            };
        } catch (error) {
            throw this._handleError(error, 'getVotingStats');
        }
    }

    /**
     * Finds votes within a specific time range.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @param {Date} startTime - The start of the time range.
     * @param {Date} endTime - The end of the time range.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object>} Paginated vote results.
     * @throws {Error} If the operation encounters an error.
     */
    async findByTimeRange(eventId, startTime, endTime, options = {}) {
        try {
            if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
                throw new Error('startTime and endTime must be valid Date objects');
            }
            const criteria = {
                event: new mongoose.Types.ObjectId(eventId),
                votedAt: { $gte: startTime, $lte: endTime }
            };
            return await this.findWithPagination(criteria, options.page || 1, options.limit || 10, {
                ...options,
                populate: [
                    { path: 'voter', select: 'name email' },
                    { path: 'candidate', select: 'name' },
                    { path: 'category', select: 'name' },
                    { path: 'voteBundles', select: 'name votes price' }
                ],
                sort: { votedAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByTimeRange');
        }
    }

    /**
     * Searches votes by candidate name or voter information.
     * @param {string} searchTerm - The search term.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object>} Paginated search results.
     * @throws {Error} If the operation encounters an error.
     */
    async searchVotes(searchTerm, options = {}) {
        try {
            const searchRegex = new RegExp(searchTerm, 'i');
            const criteria = {
                $or: [
                    { 'candidateInfo.name': { $regex: searchRegex } },
                    { 'voter.name': { $regex: searchRegex } },
                    { 'voter.email': { $regex: searchRegex } }
                ]
            };
            return await this.textSearch(searchTerm, criteria, {
                ...options,
                populate: [
                    { path: 'voter', select: 'name email' },
                    { path: 'candidate', select: 'name' },
                    { path: 'category', select: 'name' },
                    { path: 'voteBundles', select: 'name votes price' }
                ],
                sort: { score: { $meta: 'textScore' }, votedAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'searchVotes');
        }
    }

    /**
     * Checks if a user has exceeded vote limits for an event and category.
     * @param {mongoose.Types.ObjectId|string} userId - The user ID.
     * @param {mongoose.Types.ObjectId|string} eventId - The event ID.
     * @param {mongoose.Types.ObjectId|string} categoryId - The category ID.
     * @param {number} [maxVotes=1] - Maximum allowed votes.
     * @returns {Promise<boolean>} True if the limit is exceeded.
     * @throws {Error} If the operation encounters an error.
     */
    async hasExceededVoteLimit(userId, eventId, categoryId, maxVotes = 1) {
        try {
            const voteCount = await this.countDocuments({
                voter: new mongoose.Types.ObjectId(userId),
                event: new mongoose.Types.ObjectId(eventId),
                category: new mongoose.Types.ObjectId(categoryId)
            });
            return voteCount >= maxVotes;
        } catch (error) {
            throw this._handleError(error, 'hasExceededVoteLimit');
        }
    }

    /**
     * Validates vote data, including references and voting rules.
     * @private
     * @param {Object} voteData - The vote data to validate.
     * @throws {Error} If validation fails.
     */
    async _validateVoteData(voteData) {
        try {
            const { candidate, voter, event, category, voteBundles, ipAddress } = voteData;

            // Check required fields
            if (!candidate || !voter || !event || !category || !voteBundles) {
                throw new Error('Missing required vote data: candidate, voter, event, category, voteBundles');
            }

            // Validate ObjectIds
            const idsToValidate = [
                { id: candidate, model: 'Candidate', name: 'candidate' },
                { id: event, model: 'Event', name: 'event' },
                { id: category, model: 'Category', name: 'category' }
            ];

            const voteBundleIds = Array.isArray(voteBundles) ? voteBundles : [voteBundles];
            voteBundleIds.forEach(id => {
                idsToValidate.push({ id, model: 'VoteBundle', name: 'voteBundle' });
            });

            await Promise.all(
                idsToValidate.map(async ({ id, model, name }) => {
                    if (!mongoose.Types.ObjectId.isValid(id)) {
                        throw new Error(`Invalid ${name} ID format`);
                    }
                    const exists = await mongoose.model(model).exists({ _id: id });
                    if (!exists) throw new Error(`${name} not found`);
                })
            );

            // Validate candidate belongs to event and category
            const candidateDoc = await mongoose.model('Candidate').findById(candidate);
            if (!candidateDoc.event.equals(event) || !candidateDoc.category.equals(category)) {
                throw new Error('Candidate does not belong to the specified event or category');
            }

            // Validate vote bundles are active
            const bundles = await mongoose.model('VoteBundle').find({
                _id: { $in: voteBundleIds },
                isActive: true
            });
            if (bundles.length !== voteBundleIds.length) {
                throw new Error('One or more vote bundles are invalid or inactive');
            }

            // Validate IP address format if provided
            if (ipAddress && !validator.isIP(ipAddress)) {
                throw new Error('Invalid IP address format');
            }
        } catch (error) {
            throw this._handleError(error, '_validateVoteData');
        }
    }
}

export default VoteRepository;