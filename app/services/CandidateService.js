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
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'CandidateService',
            primaryRepository: 'candidate',
        });

        this.validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
        
        this.emailService = options.emailService || null;
        this.notificationService = options.notificationService || null;
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

            const result = await this.updateCandidateStatus(candidateId, 'rejected', rejecterId, reason);
            
            // Send rejection email
            if (this.emailService && result.success) {
                try {
                    const candidate = await this.repo('candidate').findById(candidateId);
                    const event = await this.repo('event').findById(candidate.eventId);
                    
                    if (candidate && candidate.email) {
                        await this.emailService.sendEmail({
                            to: candidate.email,
                            subject: 'Candidate Application Status',
                            template: 'candidate-rejected',
                            context: {
                                name: candidate.name,
                                eventName: event ? event.name : 'the event',
                                reason: reason,
                                supportEmail: 'support@itfy-evoting.com',
                            },
                        });
                    }
                } catch (emailError) {
                    this.log('warn', 'Failed to send rejection email', { 
                        error: emailError.message,
                        candidateId 
                    });
                }
            }
            
            // Send notification if candidate is also a user
            if (this.notificationService && result.success) {
                try {
                    const candidate = await this.repo('candidate').findById(candidateId);
                    // Try to find user by email to send notification
                    const user = await this.repo('user').findByEmail(candidate.email);
                    
                    if (user) {
                        await this.notificationService.createNotification({
                            userId: user._id,
                            type: 'candidate',
                            title: 'Candidate Application Rejected',
                            message: `Your application for ${candidate.name} has been rejected. Reason: ${reason}`,
                            priority: 'high',
                            metadata: { candidateId, status: 'rejected', reason },
                        });
                    }
                } catch (notifError) {
                    this.log('warn', 'Failed to send rejection notification', { 
                        error: notifError.message,
                        candidateId 
                    });
                }
            }

            return result;
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

            const result = await this.updateCandidateStatus(candidateId, 'suspended', suspenderId, reason);
            
            // Send suspension email
            if (this.emailService && result.success) {
                try {
                    const candidate = await this.repo('candidate').findById(candidateId);
                    const event = await this.repo('event').findById(candidate.eventId);
                    
                    if (candidate && candidate.email) {
                        await this.emailService.sendEmail({
                            to: candidate.email,
                            subject: 'Candidate Account Suspended',
                            template: 'candidate-suspended',
                            context: {
                                name: candidate.name,
                                eventName: event ? event.name : 'the event',
                                reason: reason,
                                supportEmail: 'support@itfy-evoting.com',
                            },
                        });
                    }
                } catch (emailError) {
                    this.log('warn', 'Failed to send suspension email', { 
                        error: emailError.message,
                        candidateId 
                    });
                }
            }
            
            // Send notification if candidate is also a user
            if (this.notificationService && result.success) {
                try {
                    const candidate = await this.repo('candidate').findById(candidateId);
                    const user = await this.repo('user').findByEmail(candidate.email);
                    
                    if (user) {
                        await this.notificationService.createNotification({
                            userId: user._id,
                            type: 'candidate',
                            title: 'Candidate Account Suspended',
                            message: `Your candidate profile ${candidate.name} has been suspended. Reason: ${reason}`,
                            priority: 'urgent',
                            metadata: { candidateId, status: 'suspended', reason },
                        });
                    }
                } catch (notifError) {
                    this.log('warn', 'Failed to send suspension notification', { 
                        error: notifError.message,
                        candidateId 
                    });
                }
            }

            return result;
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

    /**
     * Calculate and update profile completion percentage
     * @param {string} candidateId - Candidate ID
     * @returns {Promise<Object>} Profile completion data
     */
    async calculateAndUpdateProfileCompletion(candidateId) {
        return this.runInContext('calculateAndUpdateProfileCompletion', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Use model instance method
            const completionPercentage = candidate.calculateProfileCompletion();

            return this.handleSuccess({
                candidateId,
                profileCompletion: completionPercentage,
                status: candidate.status
            }, 'Profile completion calculated');
        });
    }

    /**
     * Get profile completion status
     * @param {string} candidateId - Candidate ID
     * @returns {Promise<Object>} Completion status with breakdown
     */
    async getProfileCompletionStatus(candidateId) {
        return this.runInContext('getProfileCompletionStatus', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            const completionPercentage = candidate.calculateProfileCompletion();

            // Build completion breakdown
            const breakdown = {
                basicInfo: {
                    complete: !!(candidate.name && candidate.email),
                    weight: 20
                },
                bio: {
                    complete: !!(candidate.bio && candidate.bio.length >= 100),
                    weight: 15,
                    current: candidate.bio?.length || 0,
                    required: 100
                },
                profileImage: {
                    complete: !!candidate.profileImage,
                    weight: 10
                },
                skills: {
                    complete: candidate.skills?.length >= 3,
                    weight: 20,
                    current: candidate.skills?.length || 0,
                    required: 3
                },
                projects: {
                    complete: candidate.projects?.length >= 1,
                    weight: 25,
                    current: candidate.projects?.length || 0,
                    required: 1
                },
                socialMedia: {
                    complete: !!(candidate.socialMedia?.linkedin || candidate.socialMedia?.twitter),
                    weight: 10
                }
            };

            const canBeActivated = completionPercentage >= 80;

            return this.handleSuccess({
                candidateId,
                profileCompletion: completionPercentage,
                status: candidate.status,
                canBeActivated,
                breakdown
            }, 'Profile completion status retrieved');
        });
    }

    /**
     * Activate candidate (change status from profile_complete to active)
     * @param {string} candidateId - Candidate ID
     * @param {string} adminId - Admin ID performing activation
     * @returns {Promise<Object>}
     */
    async activateCandidate(candidateId, adminId) {
        return this.runInContext('activateCandidate', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            // Check current status
            if (candidate.status === 'active') {
                return this.handleSuccess(
                    { candidate },
                    'Candidate is already active'
                );
            }

            // Verify profile completion
            const completionPercentage = candidate.calculateProfileCompletion();
            if (completionPercentage < 80) {
                throw new Error(`Profile completion must be at least 80% (current: ${completionPercentage}%)`);
            }

            // Only allow activation from certain statuses
            const allowedStatuses = ['verified', 'profile_complete', 'approved'];
            if (!allowedStatuses.includes(candidate.status)) {
                throw new Error(`Cannot activate candidate with status: ${candidate.status}`);
            }

            // Update status to active
            const updatedCandidate = await this.repo('candidate').updateById(candidateId, {
                status: 'active'
            });

            // Send notification if email service available
            if (this.emailService) {
                await this.emailService.sendEmail({
                    to: candidate.email,
                    subject: 'Your Profile Has Been Activated',
                    template: 'candidate-activated',
                    data: {
                        name: candidate.name,
                        eventId: candidate.eventId
                    }
                });
            }

            await this.logActivity(adminId, 'activate', 'candidate', {
                candidateId,
                candidateName: candidate.name,
                eventId: candidate.eventId,
                profileCompletion: completionPercentage
            });

            return this.handleSuccess(
                { candidate: updatedCandidate },
                'Candidate activated successfully'
            );
        });
    }

    /**
     * Get candidates by status
     * @param {string} eventId - Event ID
     * @param {string} status - Candidate status
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>}
     */
    async getCandidatesByStatus(eventId, status, options = {}) {
        return this.runInContext('getCandidatesByStatus', async () => {
            // Validate status
            const validStatuses = [
                'pending', 'approved', 'rejected', 'suspended',
                'awaiting_verification', 'verified', 'profile_complete', 'active'
            ];
            
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const { page = 1, limit = 20 } = options;

            const result = await this.repo('candidate').findPaginated(
                { eventId, status },
                { page, limit }
            );

            return this.handleSuccess({
                candidates: result.data,
                pagination: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    pages: result.pages
                }
            }, `Retrieved ${result.data.length} candidates with status: ${status}`);
        });
    }
}
