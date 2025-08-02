#!/usr/bin/env node
/**
 * Voting Service
 * 
 * Core voting business logic including vote initiation, payment integration,
 * vote casting, and eligibility checks.
 */

import BaseService from './BaseService.js';
import VoteRepository from '../repositories/VoteRepository.js';
import VoteBundleRepository from '../repositories/VoteBundleRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import CandidateRepository from '../repositories/CandidateRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import EmailService from './EmailService.js';
import PaymentService from './PaymentService.js';

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
        this.paymentService = new PaymentService();
    }

    /**
     * Initiate a vote and trigger payment
     */
    async initiateVote(voteData) {
        return await this._withTransaction(async (session) => {
            try {
                this._log('initiate_vote', {
                    email: voteData.email,
                    eventId: voteData.eventId,
                    candidateId: voteData.candidateId
                });

                // Validate vote data
                await this._validateVoteData(voteData);

                // Check event status
                const eventStatus = await this.eventRepository.checkVotingStatus(voteData.eventId);
                if (!eventStatus.canVote) {
                    throw new Error(eventStatus.reason);
                }

                // Validate bundles
                const bundleCalculation = await this._calculateBundleCosts(
                    voteData.bundles,
                    voteData.eventId,
                    voteData.categoryId
                );

                // Prepare payment data
                const paymentData = {
                    email: voteData.email,
                    bundles: voteData.bundles,
                    coupons: voteData.coupons,
                    eventId: voteData.eventId,
                    categoryId: voteData.categoryId,
                    candidateId: voteData.candidateId,
                    callback_url: voteData.callback_url,
                    voterIp: voteData.voterIp
                };

                // Initialize payment
                const paymentResult = await this.paymentService.initializePayment(paymentData, { session });

                // Store vote intent
                const voteIntent = {
                    email: voteData.email,
                    candidateId: voteData.candidateId,
                    eventId: voteData.eventId,
                    categoryId: voteData.categoryId,
                    paymentReference: paymentResult.data.reference,
                    totalVotes: bundleCalculation.totalVotes,
                    createdAt: new Date()
                };

                // Log activity
                await this.activityRepository.logActivity({
                    user: null,
                    action: 'vote_intent',
                    targetType: 'candidate',
                    targetId: voteData.candidateId,
                    metadata: {
                        event: voteData.eventId,
                        category: voteData.categoryId,
                        paymentReference: paymentResult.data.reference
                    }
                }, { session });

                return {
                    success: true,
                    data: {
                        ...paymentResult.data,
                        voteIntent
                    }
                };

            } catch (error) {
                throw this._handleError(error, 'initiate_vote', voteData);
            }
        });
    }

    /**
     * Complete vote after payment verification
     */
    async completeVote(reference, candidateId, voterIp) {
        return await this._withTransaction(async (session) => {
            try {
                this._log('complete_vote', { reference, candidateId });

                // Verify payment
                const paymentResult = await this.paymentService.verifyPayment(reference);
                if (!paymentResult.verified) {
                    throw new Error('Payment not verified');
                }

                const payment = paymentResult.data.payment;

                // Cast vote
                const vote = await this.voteRepository.castVote({
                    voter: { email: payment.voter.email },
                    candidate: candidateId,
                    event: payment.event,
                    category: payment.category,
                    voteBundles: payment.voteBundles,
                    ipAddress: voterIp
                }, { session });

                // Update payment
                await this.paymentRepository.decrementVotes(payment._id, 1, { session });

                // Log activity
                await this.activityRepository.logActivity({
                    user: null,
                    action: 'vote_cast',
                    targetType: 'candidate',
                    targetId: candidateId,
                    metadata: {
                        event: payment.event,
                        category: payment.category,
                        paymentReference: reference
                    }
                }, { session });

                // Send vote confirmation email
                try {
                    const event = await this.eventRepository.findById(payment.event);
                    const candidate = await this.candidateRepository.findById(candidateId);

                    await this.emailService.sendVoteConfirmation(
                        {
                            email: payment.voter.email,
                            name: payment.voter.name || 'Voter'
                        },
                        {
                            id: vote._id,
                            createdAt: vote.votedAt,
                            categories: [payment.category],
                            votes: [{ candidate: candidate.name, category: payment.category }],
                            hash: vote._id.toString(),
                            verificationHash: vote._id.toString()
                        },
                        {
                            id: event._id,
                            name: event.name
                        }
                    );

                    this._log('vote_confirmation_email_sent', {
                        voteId: vote._id,
                        email: payment.voter.email
                    });
                } catch (emailError) {
                    this._logError('vote_confirmation_email_failed', emailError, { voteId: vote._id });
                }

                return {
                    success: true,
                    vote,
                    message: 'Vote cast successfully'
                };

            } catch (error) {
                throw this._handleError(error, 'complete_vote', { reference, candidateId });
            }
        });
    }

    /**
     * Calculate voting cost
     */
    async calculateVotingCost({ bundles, coupons, eventId, categoryId }) {
        try {
            if (!bundles || !Array.isArray(bundles) || bundles.length === 0) {
                throw new Error('Bundles array is required');
            }

            if (!eventId || !categoryId) {
                throw new Error('Event ID and Category ID are required');
            }

            const bundleCalculation = await this._calculateBundleCosts(bundles, eventId, categoryId);

            let result = {
                originalAmount: bundleCalculation.totalAmount,
                totalVotes: bundleCalculation.totalVotes,
                bundles: bundleCalculation.validatedBundles,
                appliedCoupons: [],
                finalAmount: bundleCalculation.totalAmount,
                totalDiscount: 0
            };

            if (coupons && coupons.length > 0) {
                try {
                    const couponResult = await this.paymentService._applyCoupons(
                        coupons,
                        bundleCalculation.validatedBundles,
                        eventId,
                        categoryId,
                        bundleCalculation.totalAmount
                    );

                    result.finalAmount = couponResult.discountedAmount;
                    result.appliedCoupons = couponResult.appliedCoupons;
                    result.totalDiscount = bundleCalculation.totalAmount - couponResult.discountedAmount;

                } catch (couponError) {
                    result.couponError = couponError.message;
                }
            }

            return result;

        } catch (error) {
            throw this._handleError(error, 'calculate_voting_cost');
        }
    }

    /**
     * Get election results for an event
     */
    async getEventResults(eventId, includeDetails) {
        try {
            this._log('get_event_results', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            const results = await this.voteRepository.getElectionResults(eventId);

            return {
                success: true,
                data: {
                    event: {
                        id: event._id,
                        name: event.name,
                        status: event.status
                    },
                    results: results.categoriesResults,
                    totalVotes: results.totalVotes,
                    uniqueVoters: results.uniqueVoters
                }
            };

        } catch (error) {
            throw this._handleError(error, 'get_event_results', { eventId });
        }
    }

    /**
     * Get voting results for a category
     */
    async getCategoryResults(categoryId, includeDetails) {
        try {
            this._log('get_category_results', { categoryId });

            this._validateObjectId(categoryId, 'Category ID');

            const category = await this.categoryRepository.findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            const votes = await this.voteRepository.getVotesByCategory(categoryId);
            return {
                success: true,
                data: votes
            };

        } catch (error) {
            throw this._handleError(error, 'get_category_results', { categoryId });
        }
    }

    /**
     * Get user's voting history
     */
    async getUserVotingHistory(userId, query) {
        try {
            this._log('get_user_voting_history', { userId });

            this._validateObjectId(userId, 'User ID');

            const votes = await this.voteRepository.getVotesByVoter(userId, {
                page: query.page,
                limit: query.limit
            });

            return {
                success: true,
                data: votes
            };

        } catch (error) {
            throw this._handleError(error, 'get_user_voting_history', { userId });
        }
    }

    /**
     * Check if user can vote in an event
     */
    async checkVotingEligibility(eventId, userId) {
        try {
            this._validateObjectId(userId, 'User ID');
            this._validateObjectId(eventId, 'Event ID');

            const user = await this.userRepository.findById(userId);
            if (!user) {
                return { canVote: false, reason: 'User not found' };
            }

            if (!user.isActive) {
                return { canVote: false, reason: 'User account is deactivated' };
            }

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
     * Get vote bundle details
     */
    async getVoteBundle(bundleId, includeVotes) {
        try {
            this._log('get_vote_bundle', { bundleId });

            this._validateObjectId(bundleId, 'Bundle ID');

            const bundle = await this.voteBundleRepository.findById(bundleId);
            if (!bundle) {
                return null;
            }

            return {
                success: true,
                data: bundle
            };

        } catch (error) {
            throw this._handleError(error, 'get_vote_bundle', { bundleId });
        }
    }

    /**
     * Create vote bundle
     */
    async createVoteBundle(bundleData) {
        try {
            this._log('create_vote_bundle', { createdBy: bundleData.createdBy });

            const bundle = await this.voteBundleRepository.createBundle(bundleData);
            return {
                success: true,
                data: bundle
            };

        } catch (error) {
            throw this._handleError(error, 'create_vote_bundle', bundleData);
        }
    }

    /**
     * Get voting statistics for an event
     */
    async getVotingStats(eventId) {
        try {
            this._log('get_voting_stats', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            const stats = await this.voteRepository.getVotingStats(eventId);
            return {
                success: true,
                data: stats
            };

        } catch (error) {
            throw this._handleError(error, 'get_voting_stats', { eventId });
        }
    }

    /**
     * Verify vote integrity
     */
    async verifyVote(voteId) {
        try {
            this._log('verify_vote', { voteId });

            this._validateObjectId(voteId, 'Vote ID');

            const vote = await this.voteRepository.findById(voteId);
            if (!vote) {
                return null;
            }

            return {
                success: true,
                data: {
                    voteId: vote._id,
                    verified: true,
                    details: {
                        candidate: vote.candidate,
                        event: vote.event,
                        category: vote.category,
                        votedAt: vote.votedAt
                    }
                }
            };

        } catch (error) {
            throw this._handleError(error, 'verify_vote', { voteId });
        }
    }

    /**
     * Get real-time voting updates
     */
    async getVotingUpdates(eventId, lastUpdate) {
        try {
            this._log('get_voting_updates', { eventId, lastUpdate });

            this._validateObjectId(eventId, 'Event ID');

            const votes = await this.voteRepository.findByTimeRange(
                eventId,
                new Date(lastUpdate || 0),
                new Date()
            );

            return {
                success: true,
                data: votes
            };

        } catch (error) {
            throw this._handleError(error, 'get_voting_updates', { eventId });
        }
    }

    /**
     * Export voting results
     */
    async exportResults(eventId, format) {
        try {
            this._log('export_results', { eventId, format });

            this._validateObjectId(eventId, 'Event ID');

            const results = await this.getEventResults(eventId, true);
            if (format === 'csv') {
                return this._convertToCSV(results.data.results);
            }
            return JSON.stringify(results.data.results, null, 2);

        } catch (error) {
            throw this._handleError(error, 'export_results', { eventId });
        }
    }

    /**
     * Audit voting activity
     */
    async auditVoting(eventId, query) {
        try {
            this._log('audit_voting', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            const auditLog = await this.activityRepository.find({
                targetType: { $in: ['vote_cast', 'vote_intent'] },
                'metadata.event': eventId
            });

            return {
                success: true,
                data: auditLog
            };

        } catch (error) {
            throw this._handleError(error, 'audit_voting', { eventId });
        }
    }

    /**
     * Validate vote data
     */
    async _validateVoteData(voteData) {
        this._validateRequiredFields(voteData, ['email', 'eventId', 'categoryId', 'candidateId', 'bundles']);
        this._validateObjectId(voteData.eventId, 'Event ID');
        this._validateObjectId(voteData.categoryId, 'Category ID');
        this._validateObjectId(voteData.candidateId, 'Candidate ID');

        const candidate = await this.candidateRepository.findById(voteData.candidateId);
        if (!candidate) {
            throw new Error('Candidate not found');
        }

        if (candidate.event.toString() !== voteData.eventId) {
            throw new Error('Candidate does not belong to this event');
        }

        if (!candidate.categories.map(cat => cat.toString()).includes(voteData.categoryId)) {
            throw new Error('Candidate does not belong to this category');
        }
    }

    /**
     * Calculate bundle costs
     */
    async _calculateBundleCosts(bundles, eventId, categoryId) {
        const validatedBundles = [];
        let totalAmount = 0;
        let totalVotes = 0;

        for (const bundle of bundles) {
            if (!bundle.bundleId || !bundle.quantity || bundle.quantity <= 0) {
                throw new Error('Each bundle must have bundleId and positive quantity');
            }

            const bundleDoc = await this.voteBundleRepository.findById(bundle.bundleId);
            if (!bundleDoc) {
                throw new Error(`Bundle ${bundle.bundleId} not found`);
            }

            if (!bundleDoc.isActive) {
                throw new Error(`Bundle ${bundle.bundleId} is not active`);
            }

            if (bundleDoc.applicableEvents.length > 0 && !bundleDoc.applicableEvents.some(id => id.toString() === eventId)) {
                throw new Error(`Bundle ${bundle.bundleId} not applicable to event`);
            }

            if (bundleDoc.applicableCategories.length > 0 && !bundleDoc.applicableCategories.some(id => id.toString() === categoryId)) {
                throw new Error(`Bundle ${bundle.bundleId} not applicable to category`);
            }

            validatedBundles.push({
                bundleId: bundle.bundleId,
                quantity: bundle.quantity,
                price: bundleDoc.price,
                votes: bundleDoc.votes
            });

            totalAmount += bundleDoc.price * bundle.quantity;
            totalVotes += bundleDoc.votes * bundle.quantity;
        }

        return {
            totalAmount,
            totalVotes,
            validatedBundles
        };
    }

    /**
     * Convert results to CSV
     */
    _convertToCSV(results) {
        const headers = ['Category', 'Candidate', 'VoteCount', 'Percentage', 'WinnerStatus'];
        const rows = results.flatMap(category =>
            category.candidates.map(c =>
                [
                    category.categoryName,
                    c.candidateName,
                    c.voteCount,
                    c.percentage,
                    c.winnerStatus
                ].join(',')
            )
        );
        return [headers.join(','), ...rows].join('\n');
    }
}

export default VotingService;