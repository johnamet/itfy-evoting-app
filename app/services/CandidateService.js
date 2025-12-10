/**
 * CandidateService
 * 
 * Handles candidate profile management, approvals, document uploads,
 * category assignments, vote counting, and rankings.
 * 
 * @extends BaseService
 * @module services/CandidateService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class CandidateService extends BaseService {
    constructor(repositories) {
        super(repositories, {
            serviceName: 'CandidateService',
            primaryRepository: 'candidate',
        });

        this.validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    }

    /**
     * Create a new candidate
     */
    async createCandidate(candidateData, creatorId) {
        return this.runInContext('createCandidate', async () => {
            // Validate required fields
            this.validateRequiredFields(candidateData, [
                'name', 'email', 'eventId', 'categoryId'
            ]);

            this.validateEmail(candidateData.email);

            // Check if event exists and is accepting candidates
            const event = await this.repo('event').findById(candidateData.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status === 'closed' || event.status === 'archived') {
                throw new Error(`Cannot add candidates to ${event.status} event`);
            }

            // Check if category exists
            const category = await this.repo('category').findById(candidateData.categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            // Check for duplicate candidate
            const existingCandidate = await this.repo('candidate').findOne({
                email: candidateData.email,
                eventId: candidateData.eventId,
            });

            if (existingCandidate) {
                throw new Error('Candidate with this email already exists for this event');
            }

            // Create candidate with pending status
            const candidate = await this.repo('candidate').create({
                ...candidateData,
                status: 'pending',
                votes: 0,
                createdBy: creatorId,
            });

            await this.logActivity(creatorId, 'create', 'candidate', {
                candidateId: candidate._id,
                candidateName: candidate.name,
                eventId: candidateData.eventId,
            });

            return this.handleSuccess(
                { candidate },
                'Candidate created successfully'
            );
        });
    }

    /**
     * Update candidate profile
     */
    async updateCandidate(candidateId, updates, userId) {
        return this.runInContext('updateCandidate', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Prevent updating certain fields
            const restrictedFields = ['votes', 'rank', 'status', 'eventId'];
            for (const field of restrictedFields) {
                if (updates[field] !== undefined) {
                    delete updates[field];
                }
            }

            // Validate email if being updated
            if (updates.email) {
                this.validateEmail(updates.email);

                // Check for duplicate
                const existingCandidate = await this.repo('candidate').findOne({
                    email: updates.email,
                    eventId: candidate.eventId,
                    _id: { $ne: candidateId },
                });

                if (existingCandidate) {
                    throw new Error('Another candidate with this email exists for this event');
                }

                updates.emailVerified = false; // Require re-verification
            }

            const updatedCandidate = await this.repo('candidate').update(candidateId, updates);

            await this.logActivity(userId, 'update', 'candidate', {
                candidateId,
                fields: Object.keys(updates),
            });

            return this.handleSuccess(
                { candidate: updatedCandidate },
                'Candidate updated successfully'
            );
        });
    }

    /**
     * Update candidate status
     */
    async updateCandidateStatus(candidateId, newStatus, userId, reason = '') {
        return this.runInContext('updateCandidateStatus', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (!this.validStatuses.includes(newStatus)) {
                throw new Error(`Invalid status: ${newStatus}`);
            }

            const updatedCandidate = await this.repo('candidate').update(candidateId, {
                status: newStatus,
                [`${newStatus}At`]: new Date(),
                [`${newStatus}By`]: userId,
            });

            await this.logActivity(userId, 'update', 'candidate', {
                candidateId,
                action: 'status_change',
                previousStatus: candidate.status,
                newStatus,
                reason,
            });

            return this.handleSuccess(
                { candidate: updatedCandidate },
                `Candidate status updated to ${newStatus}`
            );
        });
    }

    /**
     * Approve candidate
     */
    async approveCandidate(candidateId, approverId) {
        return this.updateCandidateStatus(candidateId, 'approved', approverId, 'Approved by organizer');
    }

    /**
     * Reject candidate
     */
    async rejectCandidate(candidateId, rejecterId, reason) {
        return this.runInContext('rejectCandidate', async () => {
            if (!reason) {
                throw new Error('Rejection reason is required');
            }

            return this.updateCandidateStatus(candidateId, 'rejected', rejecterId, reason);
        });
    }

    /**
     * Suspend candidate
     */
    async suspendCandidate(candidateId, suspenderId, reason) {
        return this.runInContext('suspendCandidate', async () => {
            if (!reason) {
                throw new Error('Suspension reason is required');
            }

            return this.updateCandidateStatus(candidateId, 'suspended', suspenderId, reason);
        });
    }

    /**
     * Update candidate photo
     */
    async updateCandidatePhoto(candidateId, photoPath, userId) {
        return this.runInContext('updateCandidatePhoto', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            const updatedCandidate = await this.repo('candidate').update(candidateId, {
                photo: photoPath,
            });

            await this.logActivity(userId, 'update', 'candidate', {
                candidateId,
                action: 'photo_update',
                photoPath,
            });

            return this.handleSuccess(
                { candidate: updatedCandidate },
                'Photo updated successfully'
            );
        });
    }

    /**
     * Get candidate by ID with related data
     */
    async getCandidate(candidateId, includeRelated = false) {
        return this.runInContext('getCandidate', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            const response = { candidate };

            if (includeRelated) {
                // Get event
                response.event = await this.repo('event').findById(candidate.eventId);

                // Get category
                response.category = await this.repo('category').findById(candidate.categoryId);

                // Get vote count
                response.voteCount = await this.repo('vote').count({
                    candidateId,
                });

                // Get vote percentage
                const totalEventVotes = await this.repo('vote').count({
                    eventId: candidate.eventId,
                });

                response.votePercentage = totalEventVotes > 0
                    ? ((response.voteCount / totalEventVotes) * 100).toFixed(2)
                    : 0;
            }

            return this.handleSuccess(response, 'Candidate retrieved successfully');
        });
    }

    /**
     * List candidates with filters and pagination
     */
    async listCandidates(filters = {}, pagination = {}) {
        return this.runInContext('listCandidates', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = {};

            // Filter by event
            if (filters.eventId) {
                query.eventId = filters.eventId;
            }

            // Filter by category
            if (filters.categoryId) {
                query.categoryId = filters.categoryId;
            }

            // Filter by status
            if (filters.status) {
                query.status = filters.status;
            }

            // Search by name or email
            if (filters.search) {
                query.$or = [
                    { name: { $regex: filters.search, $options: 'i' } },
                    { email: { $regex: filters.search, $options: 'i' } },
                    { manifesto: { $regex: filters.search, $options: 'i' } },
                ];
            }

            // Filter by email verification
            if (filters.emailVerified !== undefined) {
                query.emailVerified = filters.emailVerified === 'true';
            }

            const candidates = await this.repo('candidate').findWithPagination(query, {
                page,
                limit,
                sort: filters.sort || { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(candidates.docs, candidates.total, page, limit),
                'Candidates retrieved successfully'
            );
        });
    }

    /**
     * Get approved candidates for an event
     */
    async getEventCandidates(eventId, pagination = {}) {
        return this.listCandidates({ eventId, status: 'approved' }, pagination);
    }

    /**
     * Get pending candidates for approval
     */
    async getPendingCandidates(eventId, pagination = {}) {
        return this.listCandidates({ eventId, status: 'pending' }, pagination);
    }

    /**
     * Get candidate rankings for an event
     */
    async getCandidateRankings(eventId) {
        return this.runInContext('getCandidateRankings', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Get vote counts per candidate
            const rankings = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        voteCount: { $sum: 1 },
                    },
                },
                { $sort: { voteCount: -1 } },
            ]);

            // Get candidate details
            const candidateIds = rankings.map(r => r._id);
            const candidates = await this.repo('candidate').find({
                _id: { $in: candidateIds },
            });

            // Create a map for quick lookup
            const candidateMap = new Map(
                candidates.map(c => [c._id.toString(), c])
            );

            // Combine rankings with candidate details
            const detailedRankings = rankings.map((r, index) => {
                const candidate = candidateMap.get(r._id.toString());
                return {
                    rank: index + 1,
                    candidateId: r._id,
                    name: candidate?.name,
                    photo: candidate?.photo,
                    categoryId: candidate?.categoryId,
                    votes: r.voteCount,
                    percentage: event.currentVotes > 0
                        ? ((r.voteCount / event.currentVotes) * 100).toFixed(2)
                        : 0,
                };
            });

            return this.handleSuccess({
                eventId,
                eventName: event.name,
                totalVotes: event.currentVotes,
                rankings: detailedRankings,
            }, 'Rankings retrieved successfully');
        });
    }

    /**
     * Get candidate statistics
     */
    async getCandidateStatistics(candidateId) {
        return this.runInContext('getCandidateStatistics', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Vote count
            const voteCount = await this.repo('vote').count({ candidateId });

            // Votes over time
            const votesOverTime = await this.repo('vote').aggregate([
                { $match: { candidateId } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Event total votes
            const eventTotalVotes = await this.repo('vote').count({
                eventId: candidate.eventId,
            });

            // Ranking
            const rankings = await this.repo('vote').aggregate([
                { $match: { eventId: candidate.eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        voteCount: { $sum: 1 },
                    },
                },
                { $sort: { voteCount: -1 } },
            ]);

            const rank = rankings.findIndex(
                r => r._id.toString() === candidateId.toString()
            ) + 1;

            return this.handleSuccess({
                candidate: {
                    id: candidate._id,
                    name: candidate.name,
                    status: candidate.status,
                },
                statistics: {
                    votes: voteCount,
                    percentage: eventTotalVotes > 0
                        ? ((voteCount / eventTotalVotes) * 100).toFixed(2)
                        : 0,
                    rank,
                    totalCandidates: rankings.length,
                    votesOverTime,
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Bulk approve candidates
     */
    async bulkApproveCandidates(candidateIds, approverId) {
        return this.runInContext('bulkApproveCandidates', async () => {
            const results = await this.processBatch(
                candidateIds,
                async (candidateId) => {
                    try {
                        await this.repo('candidate').update(candidateId, {
                            status: 'approved',
                            approvedAt: new Date(),
                            approvedBy: approverId,
                        });
                        return { candidateId, success: true };
                    } catch (error) {
                        return { candidateId, success: false, error: error.message };
                    }
                },
                10
            );

            await this.logActivity(approverId, 'bulk_approve', 'candidate', {
                candidateIds,
                results,
            });

            const successCount = results.filter(r => r.success).length;

            return this.handleSuccess({
                total: candidateIds.length,
                successful: successCount,
                failed: candidateIds.length - successCount,
                results,
            }, `Bulk approval completed: ${successCount}/${candidateIds.length} successful`);
        });
    }

    /**
     * Delete candidate (only pending candidates)
     */
    async deleteCandidate(candidateId, userId) {
        return this.runInContext('deleteCandidate', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (candidate.status !== 'pending') {
                throw new Error('Can only delete pending candidates');
            }

            await this.repo('candidate').delete(candidateId);

            await this.logActivity(userId, 'delete', 'candidate', {
                candidateId,
                candidateName: candidate.name,
                eventId: candidate.eventId,
            });

            return this.handleSuccess(null, 'Candidate deleted successfully');
        });
    }
}
