#!/usr/bin/env node
/**
 * Voting Service
 * 
 * Core voting business logic including vote casting, validation,
 * vote bundle management, and voting eligibility checks.
 */

import BaseService from './BaseService.js';
import VoteRepository from '../repositories/VoteRepository.js';
import VoteBundleRepository from '../repositories/VoteBundleRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import CandidateRepository from '../repositories/CandidateRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import EmailService from './EmailService.js';

class VotingService extends BaseService {
    constructor() {
        super();
        this.voteRepository = new VoteRepository();
        this.voteBundleRepository = new VoteBundleRepository();
        this.eventRepository = new EventRepository();
        this.candidateRepository = new CandidateRepository();
        this.userRepository = new UserRepository();
        this.activityRepository = new ActivityRepository();
        this.emailService = new EmailService();
    }

    /**
     * Cast a vote for a candidate
     * @param {Object} voteData - Vote data
     * @returns {Promise<Object>} Vote result
     */
    async castVote(voteData) {
        return await this._withTransaction(async (session) => {
            try {
                this._log('cast_vote', { 
                    voter: voteData.voter?.id, 
                    candidate: voteData.candidate,
                    event: voteData.event 
                });

                // Validate vote data
                await this._validateVoteData(voteData);

                // Check voting eligibility
                await this._checkVotingEligibility(voteData);

                // Check if user already voted in this category
                const existingVote = await this.voteRepository.findExistingVote(
                    voteData.voter.id,
                    voteData.event,
                    voteData.category
                );

                if (existingVote) {
                    throw new Error('You have already voted in this category');
                }

                // Validate vote bundle usage
                await this._validateVoteBundleUsage(voteData);

                // Cast the vote
                const vote = await this.voteRepository.castVote({
                    ...voteData,
                    votedAt: new Date(),
                    ipAddress: voteData.ipAddress || 'unknown'
                });

                // Log activity
                await this.activityRepository.logActivity({
                    user: voteData.voter.id,
                    action: 'vote_cast',
                    targetType: 'candidate',
                    targetId: voteData.candidate,
                    metadata: {
                        event: voteData.event,
                        category: voteData.category,
                        voteBundle: voteData.voteBundle
                    }
                });

                // Send vote confirmation email
                try {
                    const voter = typeof voteData.voter === 'object' ? voteData.voter : 
                        await this.userRepository.findById(voteData.voter.id || voteData.voter);
                    const event = await this.eventRepository.findById(voteData.event);
                    const candidate = await this.candidateRepository.findById(voteData.candidate);

                    await this.emailService.sendVoteConfirmation(
                        {
                            name: voter.name,
                            fullName: voter.name,
                            email: voter.email
                        },
                        {
                            id: vote._id,
                            _id: vote._id,
                            createdAt: vote.votedAt,
                            categories: [voteData.category],
                            votes: [{ candidate: candidate.name, category: voteData.category }],
                            hash: vote.verificationHash || vote._id.toString(),
                            verificationHash: vote.verificationHash || vote._id.toString()
                        },
                        {
                            id: event._id,
                            _id: event._id,
                            name: event.name,
                            title: event.name
                        }
                    );
                    
                    this._log('vote_confirmation_email_sent', { 
                        voteId: vote._id,
                        userId: voter._id, 
                        email: voter.email 
                    });
                } catch (emailError) {
                    this._logError('vote_confirmation_email_failed', emailError, { voteId: vote._id });
                    // Don't fail the vote if email fails
                }

                this._log('cast_vote_success', { 
                    voteId: vote._id,
                    voter: voteData.voter.id,
                    candidate: voteData.candidate 
                });

                return {
                    success: true,
                    vote: {
                        id: vote._id,
                        candidate: vote.candidate,
                        event: vote.event,
                        category: vote.category,
                        votedAt: vote.votedAt
                    },
                    message: 'Vote cast successfully'
                };
            } catch (error) {
                throw this._handleError(error, 'cast_vote', voteData);
            }
        });
    }

    /**
     * Get election results for an event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Election results
     */
    async getElectionResults(eventId, options = {}) {
        try {
            this._log('get_election_results', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            // Check if event exists
            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get comprehensive election results
            const results = await this.voteRepository.getElectionResults(eventId);

            // Get voting statistics
            const statistics = await this.voteRepository.getVotingStatistics(eventId);

            // Format results with additional metadata
            const formattedResults = {
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    startDate: event.startDate,
                    endDate: event.endDate
                },
                results: results.map(category => ({
                    ...category,
                    candidates: category.candidates.map(candidate => ({
                        ...candidate,
                        winnerStatus: candidate.rank === 1 ? 'winner' : 
                                    candidate.rank <= 3 ? 'runner-up' : 'participant'
                    }))
                })),
                statistics: {
                    ...statistics,
                    resultsGeneratedAt: new Date()
                }
            };

            this._log('get_election_results_success', { 
                eventId, 
                categoriesCount: results.length,
                totalVotes: statistics.totalVotes 
            });

            return {
                success: true,
                data: formattedResults
            };
        } catch (error) {
            throw this._handleError(error, 'get_election_results', { eventId });
        }
    }

    /**
     * Get voting status for a user in an event
     * @param {String} userId - User ID
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>} Voting status
     */
    async getVotingStatus(userId, eventId) {
        try {
            this._log('get_voting_status', { userId, eventId });

            this._validateObjectId(userId, 'User ID');
            this._validateObjectId(eventId, 'Event ID');

            // Check voting eligibility
            const eligibility = await this.checkVotingEligibility(userId, eventId);

            // Get user's votes in this event
            const userVotes = await this.voteRepository.getVotesByEvent(eventId, {
                filter: { 'voter.id': userId }
            });

            // Get event categories and check completion
            const event = await this.eventRepository.findById(eventId);
            const candidates = await this.candidateRepository.findByEvent(eventId);
            
            const categoriesInEvent = [...new Set(candidates.map(c => c.category.toString()))];
            const votedCategories = userVotes.map(vote => vote.category.toString());
            const remainingCategories = categoriesInEvent.filter(
                catId => !votedCategories.includes(catId)
            );

            const status = {
                canVote: eligibility.canVote,
                reason: eligibility.reason,
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    startDate: event.startDate,
                    endDate: event.endDate
                },
                votingProgress: {
                    totalCategories: categoriesInEvent.length,
                    votedCategories: votedCategories.length,
                    remainingCategories: remainingCategories.length,
                    isComplete: remainingCategories.length === 0
                },
                votes: userVotes.map(vote => ({
                    id: vote._id,
                    candidate: vote.candidate,
                    category: vote.category,
                    votedAt: vote.votedAt
                }))
            };

            return {
                success: true,
                data: status
            };
        } catch (error) {
            throw this._handleError(error, 'get_voting_status', { userId, eventId });
        }
    }

    /**
     * Check if user is eligible to vote
     * @param {String} userId - User ID
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>} Eligibility status
     */
    async checkVotingEligibility(userId, eventId) {
        try {
            this._validateObjectId(userId, 'User ID');
            this._validateObjectId(eventId, 'Event ID');

            // Check user exists and is active
            const user = await this.userRepository.findById(userId);
            if (!user) {
                return { canVote: false, reason: 'User not found' };
            }

            if (!user.isActive) {
                return { canVote: false, reason: 'User account is deactivated' };
            }

            // Check event voting status
            const eventStatus = await this.eventRepository.checkVotingStatus(eventId);
            if (!eventStatus.canVote) {
                return { canVote: false, reason: eventStatus.reason };
            }

            return { canVote: true, reason: 'Eligible to vote' };
        } catch (error) {
            return { canVote: false, reason: 'Error checking eligibility' };
        }
    }

    /**
     * Get vote statistics for an event
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>} Vote statistics
     */
    async getVoteStatistics(eventId) {
        try {
            this._log('get_vote_statistics', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            const statistics = await this.voteRepository.getVotingStatistics(eventId);
            const voteCounts = await this.voteRepository.getVoteCountsByCategory(eventId);

            return {
                success: true,
                data: {
                    ...statistics,
                    categoryBreakdown: voteCounts,
                    generatedAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_vote_statistics', { eventId });
        }
    }

    /**
     * Validate vote data
     * @param {Object} voteData - Vote data to validate
     * @private
     */
    async _validateVoteData(voteData) {
        // Check required fields
        this._validateRequiredFields(voteData, [
            'voter', 'candidate', 'event', 'category', 'voteBundle'
        ]);

        // Validate ObjectIds
        this._validateObjectId(voteData.candidate, 'Candidate ID');
        this._validateObjectId(voteData.event, 'Event ID');
        this._validateObjectId(voteData.category, 'Category ID');
        this._validateObjectId(voteData.voteBundle, 'Vote Bundle ID');

        if (voteData.voter?.id) {
            this._validateObjectId(voteData.voter.id, 'Voter ID');
        }

        // Check if candidate exists
        const candidate = await this.candidateRepository.findById(voteData.candidate);
        if (!candidate) {
            throw new Error('Candidate not found');
        }

        // Verify candidate belongs to the event and category
        if (candidate.event.toString() !== voteData.event) {
            throw new Error('Candidate does not belong to this event');
        }

        if (!candidate.categories.map(cat => cat.toString()).includes(voteData.category)) {
            throw new Error('Candidate does not belong to this category');
        }
    }

    /**
     * Check voting eligibility for the vote
     * @param {Object} voteData - Vote data
     * @private
     */
    async _checkVotingEligibility(voteData) {
        if (voteData.voter?.id) {
            const eligibility = await this.checkVotingEligibility(
                voteData.voter.id, 
                voteData.event
            );

            if (!eligibility.canVote) {
                throw new Error(eligibility.reason);
            }
        }
    }

    /**
     * Validate vote bundle usage
     * @param {Object} voteData - Vote data
     * @private
     */
    async _validateVoteBundleUsage(voteData) {
        const voteBundle = await this.voteBundleRepository.findById(voteData.voteBundle);
        if (!voteBundle) {
            throw new Error('Vote bundle not found');
        }

        if (!voteBundle.isActive) {
            throw new Error('Vote bundle is not active');
        }

        // Check if bundle is applicable to this event
        if (voteBundle.applicableEvents.length > 0 && 
            !voteBundle.applicableEvents.includes(voteData.event)) {
            throw new Error('Vote bundle is not applicable to this event');
        }

        // Check if bundle is applicable to this category
        if (voteBundle.applicableCategories.length > 0 && 
            !voteBundle.applicableCategories.includes(voteData.category)) {
            throw new Error('Vote bundle is not applicable to this category');
        }
    }
}

export default VotingService;
