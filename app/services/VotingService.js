/**
 * VotingService
 * 
 * Handles vote casting with duplicate prevention, validation, results aggregation,
 * analytics, and vote bundle management. Enforces voting rules and integrity.
 * 
 * @extends BaseService
 * @module services/VotingService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class VotingService extends BaseService {
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'VotingService',
            primaryRepository: 'vote',
        });
        
        this.emailService = options.emailService || null;
        this.notificationService = options.notificationService || null;
    }

    /**
     * Cast a vote with validation and duplicate prevention
     */
    async castVote(voteData, voterId, metadata = {}) {
        return this.runInContext('castVote', async () => {
            // Validate required fields
            this.validateRequiredFields(voteData, ['eventId', 'candidateId']);

            const { eventId, candidateId } = voteData;

            // Check if event exists and is active
            const event = await this.repo('event').findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status !== 'active') {
                throw new Error(`Voting is not allowed. Event status: ${event.status}`);
            }

            // Check if voting period is valid
            const now = new Date();
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);

            if (now < startDate) {
                throw new Error('Voting has not started yet');
            }

            if (now > endDate) {
                throw new Error('Voting period has ended');
            }

            // Check if candidate exists and is approved
            const candidate = await this.repo('candidate').findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (candidate.status !== 'approved') {
                throw new Error('Candidate is not approved for voting');
            }

            if (candidate.eventId.toString() !== eventId.toString()) {
                throw new Error('Candidate does not belong to this event');
            }

            // Check for duplicate vote
            const allowMultipleVotes = this.getSetting('voting.allowMultipleVotes', false);
            
            if (!allowMultipleVotes) {
                const existingVote = await this.repo('vote').findOne({
                    eventId,
                    voterId,
                });

                if (existingVote) {
                    throw new Error('You have already voted in this event');
                }
            } else {
                // Check for duplicate vote for same candidate
                const existingVoteForCandidate = await this.repo('vote').findOne({
                    eventId,
                    candidateId,
                    voterId,
                });

                if (existingVoteForCandidate) {
                    throw new Error('You have already voted for this candidate');
                }
            }

            // Check vote bundle if provided
            let voteBundleData = null;
            if (voteData.bundleId) {
                const bundle = await this.repo('voteBundle').findById(voteData.bundleId);
                if (!bundle) {
                    throw new Error('Vote bundle not found');
                }

                if (bundle.used) {
                    throw new Error('Vote bundle has already been used');
                }

                if (this.isDatePast(bundle.expiryDate)) {
                    throw new Error('Vote bundle has expired');
                }

                voteBundleData = bundle;
            }

            // Create vote
            const vote = await this.repo('vote').create({
                eventId,
                candidateId,
                voterId,
                bundleId: voteData.bundleId || null,
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
                location: metadata.location,
            });

            // Mark bundle as used if provided
            if (voteBundleData) {
                await this.repo('voteBundle').update(voteBundleData._id, {
                    used: true,
                    usedAt: new Date(),
                    usedBy: voterId,
                });
            }

            // Update event vote count
            await this.repo('event').update(eventId, {
                $inc: { currentVotes: 1 },
            });

            // Update candidate vote count
            await this.repo('candidate').update(candidateId, {
                $inc: { votes: 1 },
            });

            // Log activity
            await this.logActivity(voterId, 'create', 'vote', {
                voteId: vote._id,
                eventId,
                candidateId,
            });

            // Send vote confirmation email
            if (this.emailService) {
                try {
                    const voter = await this.repo('user').findById(voterId);
                    if (voter && voter.email) {
                        await this.emailService.sendVoteCastConfirmationEmail({
                            email: voter.email,
                            name: `${voter.firstName || ''} ${voter.lastName || ''}`.trim() || voter.email,
                            eventName: event.name,
                            candidateName: candidate.name,
                            voteDate: vote.createdAt,
                        });
                    }
                } catch (emailError) {
                    this.log('warn', 'Failed to send vote confirmation email', { 
                        error: emailError.message,
                        voteId: vote._id 
                    });
                }
            }

            // Send notification
            if (this.notificationService) {
                try {
                    await this.notificationService.createNotification({
                        userId: voterId,
                        type: 'vote',
                        title: 'Vote Cast Successfully',
                        message: `Your vote for ${candidate.name} in ${event.name} has been recorded.`,
                        priority: 'normal',
                        metadata: {
                            eventId: event._id,
                            candidateId: candidate._id,
                            voteId: vote._id,
                        },
                    });
                } catch (notifError) {
                    this.log('warn', 'Failed to send vote notification', { 
                        error: notifError.message,
                        voteId: vote._id 
                    });
                }
            }

            return this.handleSuccess(
                { vote },
                'Vote cast successfully'
            );
        });
    }

    /**
     * Get vote by ID
     */
    async getVote(voteId) {
        return this.runInContext('getVote', async () => {
            const vote = await this.repo('vote').findById(voteId);
            
            if (!vote) {
                throw new Error('Vote not found');
            }

            // Get related data
            const event = await this.repo('event').findById(vote.eventId);
            const candidate = await this.repo('candidate').findById(vote.candidateId);
            const voter = await this.repo('user').findById(vote.voterId);

            return this.handleSuccess({
                vote,
                event: event ? { id: event._id, name: event.name } : null,
                candidate: candidate ? { id: candidate._id, name: candidate.name } : null,
                voter: voter ? { id: voter._id, name: `${voter.firstName} ${voter.lastName}` } : null,
            }, 'Vote retrieved successfully');
        });
    }

    /**
     * Get user's votes
     */
    async getUserVotes(voterId, pagination = {}) {
        return this.runInContext('getUserVotes', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const votes = await this.repo('vote').findWithPagination(
                { voterId },
                { page, limit, sort: { createdAt: -1 } }
            );

            // Enrich with event and candidate data
            const enrichedVotes = await Promise.all(
                votes.docs.map(async (vote) => {
                    const event = await this.repo('event').findById(vote.eventId);
                    const candidate = await this.repo('candidate').findById(vote.candidateId);

                    return {
                        ...vote.toObject(),
                        event: event ? { id: event._id, name: event.name, status: event.status } : null,
                        candidate: candidate ? { id: candidate._id, name: candidate.name, photo: candidate.photo } : null,
                    };
                })
            );

            return this.handleSuccess(
                this.createPaginatedResponse(enrichedVotes, votes.total, page, limit),
                'Votes retrieved successfully'
            );
        });
    }

    /**
     * Get event votes with filters
     */
    async getEventVotes(eventId, filters = {}, pagination = {}) {
        return this.runInContext('getEventVotes', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = { eventId };

            // Filter by candidate
            if (filters.candidateId) {
                query.candidateId = filters.candidateId;
            }

            // Filter by date range
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            const votes = await this.repo('vote').findWithPagination(query, {
                page,
                limit,
                sort: { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(votes.docs, votes.total, page, limit),
                'Event votes retrieved successfully'
            );
        });
    }

    /**
     * Check if user has voted in event
     */
    async hasUserVoted(voterId, eventId) {
        return this.runInContext('hasUserVoted', async () => {
            const vote = await this.repo('vote').findOne({ voterId, eventId });

            return this.handleSuccess({
                hasVoted: !!vote,
                vote: vote || null,
            }, 'Vote status checked');
        });
    }

    /**
     * Get event voting statistics
     */
    async getEventVotingStatistics(eventId) {
        return this.runInContext('getEventVotingStatistics', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Total votes
            const totalVotes = await this.repo('vote').count({ eventId });

            // Unique voters
            const uniqueVoters = await this.repo('vote').distinct('voterId', { eventId });

            // Votes per candidate
            const votesPerCandidate = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { votes: -1 } },
            ]);

            // Get candidate details
            const candidateIds = votesPerCandidate.map(v => v._id);
            const candidates = await this.repo('candidate').find({
                _id: { $in: candidateIds },
            });

            const candidateMap = new Map(
                candidates.map(c => [c._id.toString(), c])
            );

            const detailedVotes = votesPerCandidate.map((v, index) => {
                const candidate = candidateMap.get(v._id.toString());
                return {
                    rank: index + 1,
                    candidateId: v._id,
                    candidateName: candidate?.name,
                    votes: v.votes,
                    percentage: totalVotes > 0 ? ((v.votes / totalVotes) * 100).toFixed(2) : 0,
                };
            });

            // Votes over time
            const votesOverTime = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d %H:00',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Voter participation rate
            const totalUsers = await this.repo('user').count({ status: 'active' });
            const participationRate = totalUsers > 0
                ? ((uniqueVoters.length / totalUsers) * 100).toFixed(2)
                : 0;

            return this.handleSuccess({
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                },
                statistics: {
                    totalVotes,
                    uniqueVoters: uniqueVoters.length,
                    participationRate,
                    votesPerCandidate: detailedVotes,
                    votesOverTime,
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Create vote bundle
     */
    async createVoteBundle(bundleData, creatorId) {
        return this.runInContext('createVoteBundle', async () => {
            this.validateRequiredFields(bundleData, ['eventId', 'quantity', 'price']);

            const event = await this.repo('event').findById(bundleData.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Generate unique code
            const code = this._generateBundleCode();

            const bundle = await this.repo('voteBundle').create({
                ...bundleData,
                code,
                used: false,
                createdBy: creatorId,
            });

            await this.logActivity(creatorId, 'create', 'voteBundle', {
                bundleId: bundle._id,
                eventId: bundleData.eventId,
                quantity: bundleData.quantity,
            });

            return this.handleSuccess({ bundle }, 'Vote bundle created successfully');
        });
    }

    /**
     * Verify vote bundle
     */
    async verifyVoteBundle(code) {
        return this.runInContext('verifyVoteBundle', async () => {
            const bundle = await this.repo('voteBundle').findOne({ code });

            if (!bundle) {
                throw new Error('Invalid vote bundle code');
            }

            if (bundle.used) {
                throw new Error('Vote bundle has already been used');
            }

            if (this.isDatePast(bundle.expiryDate)) {
                throw new Error('Vote bundle has expired');
            }

            return this.handleSuccess({
                bundle: {
                    id: bundle._id,
                    eventId: bundle.eventId,
                    quantity: bundle.quantity,
                    price: bundle.price,
                    expiryDate: bundle.expiryDate,
                },
            }, 'Vote bundle is valid');
        });
    }

    /**
     * Get voting analytics for event
     */
    async getVotingAnalytics(eventId, period = 'day') {
        return this.runInContext('getVotingAnalytics', async () => {
            const dateFormat = period === 'hour' ? '%Y-%m-%d %H:00' :
                               period === 'day' ? '%Y-%m-%d' :
                               '%Y-%m';

            const analytics = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: {
                            period: {
                                $dateToString: {
                                    format: dateFormat,
                                    date: '$createdAt',
                                },
                            },
                            candidateId: '$candidateId',
                        },
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { '_id.period': 1 } },
            ]);

            // Get candidate names
            const candidateIds = [...new Set(analytics.map(a => a._id.candidateId))];
            const candidates = await this.repo('candidate').find({
                _id: { $in: candidateIds },
            });

            const candidateMap = new Map(
                candidates.map(c => [c._id.toString(), c.name])
            );

            // Format analytics
            const formattedAnalytics = analytics.map(a => ({
                period: a._id.period,
                candidateId: a._id.candidateId,
                candidateName: candidateMap.get(a._id.candidateId.toString()),
                votes: a.votes,
            }));

            return this.handleSuccess({
                eventId,
                period,
                analytics: formattedAnalytics,
            }, 'Analytics retrieved successfully');
        });
    }

    /**
     * Generate unique bundle code
     */
    _generateBundleCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        
        for (let i = 0; i < 12; i++) {
            if (i > 0 && i % 4 === 0) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return code;
    }

    /**
     * Delete vote (admin only, rare operation)
     */
    async deleteVote(voteId, adminId, reason) {
        return this.runInContext('deleteVote', async () => {
            const vote = await this.repo('vote').findById(voteId);
            
            if (!vote) {
                throw new Error('Vote not found');
            }

            // Decrement counters
            await this.repo('event').update(vote.eventId, {
                $inc: { currentVotes: -1 },
            });

            await this.repo('candidate').update(vote.candidateId, {
                $inc: { votes: -1 },
            });

            await this.repo('vote').delete(voteId);

            await this.logActivity(adminId, 'delete', 'vote', {
                voteId,
                eventId: vote.eventId,
                candidateId: vote.candidateId,
                reason,
            });

            return this.handleSuccess(null, 'Vote deleted successfully');
        });
    }
}
