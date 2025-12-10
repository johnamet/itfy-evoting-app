/**
 * EventService
 * 
 * Handles event lifecycle management including CRUD operations, status transitions,
 * date validation, participant management, and results publication.
 * Status flow: draft → published → active → closed → archived
 * 
 * @extends BaseService
 * @module services/EventService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class EventService extends BaseService {
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'EventService',
            primaryRepository: 'event',
        });

        this.validStatuses = ['draft', 'published', 'active', 'closed', 'archived', 'cancelled'];
        this.statusTransitions = {
            draft: ['published', 'cancelled'],
            published: ['active', 'cancelled'],
            active: ['closed', 'cancelled'],
            closed: ['archived'],
            archived: [],
            cancelled: [],
        };
        
        this.emailService = options.emailService || null;
        this.notificationService = options.notificationService || null;
    }

    /**
     * Create a new event
     */
    async createEvent(eventData, creatorId) {
        return this.runInContext('createEvent', async () => {
            // Validate required fields
            this.validateRequiredFields(eventData, [
                'name', 'description', 'startDate', 'endDate', 'categoryId'
            ]);

            // Validate dates
            const startDate = new Date(eventData.startDate);
            const endDate = new Date(eventData.endDate);

            if (this.isDatePast(startDate)) {
                throw new Error('Start date cannot be in the past');
            }

            if (endDate <= startDate) {
                throw new Error('End date must be after start date');
            }

            // Check minimum event duration from settings
            const minDurationHours = this.getSetting('events.minDurationHours', 1);
            const durationHours = (endDate - startDate) / (1000 * 60 * 60);
            
            if (durationHours < minDurationHours) {
                throw new Error(`Event must be at least ${minDurationHours} hours long`);
            }

            // Validate category exists
            const category = await this.repo('category').findById(eventData.categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            // Create event with default status
            const event = await this.repo('event').create({
                ...eventData,
                createdBy: creatorId,
                status: 'draft',
                currentVotes: 0,
                totalRevenue: 0,
            });

            await this.logActivity(creatorId, 'create', 'event', {
                eventId: event._id,
                eventName: event.name,
            });

            return this.handleSuccess(
                { event },
                'Event created successfully'
            );
        });
    }

    /**
     * Update event
     */
    async updateEvent(eventId, updates, userId) {
        return this.runInContext('updateEvent', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Check if event can be updated
            if (['closed', 'archived'].includes(event.status)) {
                throw new Error(`Cannot update ${event.status} event`);
            }

            // Prevent updating certain fields if event is active
            if (event.status === 'active') {
                const restrictedFields = ['startDate', 'endDate', 'categoryId'];
                for (const field of restrictedFields) {
                    if (updates[field] !== undefined) {
                        throw new Error(`Cannot update ${field} while event is active`);
                    }
                }
            }

            // Validate dates if being updated
            if (updates.startDate || updates.endDate) {
                const startDate = new Date(updates.startDate || event.startDate);
                const endDate = new Date(updates.endDate || event.endDate);

                if (this.isDatePast(startDate) && updates.startDate) {
                    throw new Error('Start date cannot be in the past');
                }

                if (endDate <= startDate) {
                    throw new Error('End date must be after start date');
                }
            }

            const updatedEvent = await this.repo('event').update(eventId, updates);

            await this.logActivity(userId, 'update', 'event', {
                eventId,
                fields: Object.keys(updates),
            });

            return this.handleSuccess(
                { event: updatedEvent },
                'Event updated successfully'
            );
        });
    }

    /**
     * Update event status with transition validation
     */
    async updateEventStatus(eventId, newStatus, userId, reason = '') {
        return this.runInContext('updateEventStatus', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Validate status
            if (!this.validStatuses.includes(newStatus)) {
                throw new Error(`Invalid status: ${newStatus}`);
            }

            // Check if transition is allowed
            const allowedTransitions = this.statusTransitions[event.status] || [];
            if (!allowedTransitions.includes(newStatus)) {
                throw new Error(
                    `Cannot transition from ${event.status} to ${newStatus}. ` +
                    `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
                );
            }

            // Additional validation for 'active' status
            if (newStatus === 'active') {
                // Check if event has candidates
                const candidateCount = await this.repo('candidate').count({
                    eventId,
                    status: 'approved',
                });

                const minCandidates = this.getSetting('events.minCandidates', 2);
                if (candidateCount < minCandidates) {
                    throw new Error(`Event must have at least ${minCandidates} approved candidates`);
                }

                // Check if start date is near
                const now = new Date();
                const startDate = new Date(event.startDate);
                const hoursUntilStart = (startDate - now) / (1000 * 60 * 60);

                if (hoursUntilStart < 0) {
                    throw new Error('Cannot activate event that has already started');
                }
            }

            const updatedEvent = await this.repo('event').update(eventId, {
                status: newStatus,
                [`${newStatus}At`]: new Date(), // e.g., publishedAt, activeAt, closedAt
            });

            await this.logActivity(userId, 'update', 'event', {
                eventId,
                action: 'status_change',
                previousStatus: event.status,
                newStatus,
                reason,
            });

            return this.handleSuccess(
                { event: updatedEvent },
                `Event status updated to ${newStatus}`
            );
        });
    }

    /**
     * Publish event (draft → published)
     */
    async publishEvent(eventId, userId) {
        return this.updateEventStatus(eventId, 'published', userId, 'Published by organizer');
    }

    /**
     * Activate event (published → active)
     */
    async activateEvent(eventId, userId) {
        const result = await this.updateEventStatus(eventId, 'active', userId, 'Activated for voting');
        
        // Send notifications to interested users (event creator and followers)
        if (this.notificationService && result.success) {
            try {
                const event = await this.repo('event').findById(eventId);
                
                // Notify event creator
                if (event && event.createdBy) {
                    await this.notificationService.createNotification({
                        userId: event.createdBy,
                        type: 'event',
                        title: 'Event Now Active',
                        message: `${event.name} is now active and accepting votes!`,
                        priority: 'high',
                        metadata: { eventId: event._id, status: 'active' },
                    });
                }
            } catch (notifError) {
                this.log('warn', 'Failed to send event activation notification', { 
                    error: notifError.message,
                    eventId 
                });
            }
        }
        
        return result;
    }

    /**
     * Close event (active → closed)
     */
    async closeEvent(eventId, userId) {
        return this.runInContext('closeEvent', async () => {
            const result = await this.updateEventStatus(eventId, 'closed', userId, 'Voting period ended');

            // Trigger results calculation
            const resultsData = await this.calculateEventResults(eventId);
            
            // Get event details and top candidates
            const event = await this.repo('event').findById(eventId);
            const topCandidates = await this.repo('candidate').find(
                { eventId },
                { sort: { rank: 1 }, limit: 3 }
            );
            
            // Send results email to event creator
            if (this.emailService && event && event.createdBy) {
                try {
                    const creator = await this.repo('user').findById(event.createdBy);
                    if (creator && creator.email) {
                        await this.emailService.sendEventResultsEmail({
                            email: creator.email,
                            name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
                            eventName: event.name,
                            totalVotes: resultsData.data?.totalVotes || 0,
                            topCandidates: topCandidates.map(c => ({
                                name: c.name,
                                votes: c.votes,
                                rank: c.rank,
                            })),
                        });
                    }
                } catch (emailError) {
                    this.log('warn', 'Failed to send event results email', { 
                        error: emailError.message,
                        eventId 
                    });
                }
            }
            
            // Send notification to event creator
            if (this.notificationService && event && event.createdBy) {
                try {
                    await this.notificationService.createNotification({
                        userId: event.createdBy,
                        type: 'event',
                        title: 'Event Closed - Results Available',
                        message: `${event.name} has ended. Total votes: ${resultsData.data?.totalVotes || 0}. Check the results now!`,
                        priority: 'high',
                        metadata: { 
                            eventId: event._id, 
                            status: 'closed',
                            totalVotes: resultsData.data?.totalVotes || 0 
                        },
                    });
                } catch (notifError) {
                    this.log('warn', 'Failed to send event closed notification', { 
                        error: notifError.message,
                        eventId 
                    });
                }
            }

            return result;
        });
    }

    /**
     * Archive event (closed → archived)
     */
    async archiveEvent(eventId, userId) {
        return this.updateEventStatus(eventId, 'archived', userId, 'Event archived');
    }

    /**
     * Cancel event (any → cancelled)
     */
    async cancelEvent(eventId, userId, reason) {
        return this.runInContext('cancelEvent', async () => {
            if (!reason) {
                throw new Error('Cancellation reason is required');
            }

            return this.updateEventStatus(eventId, 'cancelled', userId, reason);
        });
    }

    /**
     * Get event by ID with related data
     */
    async getEvent(eventId, includeRelated = false) {
        return this.runInContext('getEvent', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            const response = { event };

            if (includeRelated) {
                // Get candidates count
                response.candidatesCount = await this.repo('candidate').count({
                    eventId,
                    status: 'approved',
                });

                // Get votes count
                response.votesCount = await this.repo('vote').count({ eventId });

                // Get category
                response.category = await this.repo('category').findById(event.categoryId);

                // Get creator info
                const creator = await this.repo('user').findById(event.createdBy);
                response.creator = creator ? {
                    id: creator._id,
                    name: `${creator.firstName} ${creator.lastName}`,
                    email: creator.email,
                } : null;
            }

            return this.handleSuccess(response, 'Event retrieved successfully');
        });
    }

    /**
     * List events with filters and pagination
     */
    async listEvents(filters = {}, pagination = {}) {
        return this.runInContext('listEvents', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = {};

            // Filter by status
            if (filters.status) {
                query.status = filters.status;
            }

            // Filter by category
            if (filters.categoryId) {
                query.categoryId = filters.categoryId;
            }

            // Filter by creator
            if (filters.createdBy) {
                query.createdBy = filters.createdBy;
            }

            // Filter by date range
            if (filters.startDate || filters.endDate) {
                query.startDate = {};
                if (filters.startDate) {
                    query.startDate.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.startDate.$lte = new Date(filters.endDate);
                }
            }

            // Search by name or description
            if (filters.search) {
                query.$or = [
                    { name: { $regex: filters.search, $options: 'i' } },
                    { description: { $regex: filters.search, $options: 'i' } },
                ];
            }

            // Filter by featured
            if (filters.featured !== undefined) {
                query.featured = filters.featured === 'true';
            }

            const events = await this.repo('event').findWithPagination(query, {
                page,
                limit,
                sort: filters.sort || { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(events.docs, events.total, page, limit),
                'Events retrieved successfully'
            );
        });
    }

    /**
     * Get active events
     */
    async getActiveEvents(pagination = {}) {
        return this.listEvents({ status: 'active' }, pagination);
    }

    /**
     * Get upcoming events
     */
    async getUpcomingEvents(pagination = {}) {
        return this.runInContext('getUpcomingEvents', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = {
                status: { $in: ['published', 'active'] },
                startDate: { $gt: new Date() },
            };

            const events = await this.repo('event').findWithPagination(query, {
                page,
                limit,
                sort: { startDate: 1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(events.docs, events.total, page, limit),
                'Upcoming events retrieved successfully'
            );
        });
    }

    /**
     * Calculate event results
     */
    async calculateEventResults(eventId) {
        return this.runInContext('calculateEventResults', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Get all candidates with vote counts
            const results = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        voteCount: { $sum: 1 },
                    },
                },
                { $sort: { voteCount: -1 } },
            ]);

            // Update candidates with rankings
            for (let i = 0; i < results.length; i++) {
                await this.repo('candidate').update(results[i]._id, {
                    votes: results[i].voteCount,
                    rank: i + 1,
                });
            }

            // Update event with total votes
            const totalVotes = results.reduce((sum, r) => sum + r.voteCount, 0);
            await this.repo('event').update(eventId, {
                currentVotes: totalVotes,
                resultsCalculatedAt: new Date(),
            });

            return this.handleSuccess({
                totalVotes,
                candidatesRanked: results.length,
                results: results.map((r, i) => ({
                    candidateId: r._id,
                    votes: r.voteCount,
                    rank: i + 1,
                })),
            }, 'Results calculated successfully');
        });
    }

    /**
     * Get event statistics
     */
    async getEventStatistics(eventId) {
        return this.runInContext('getEventStatistics', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Votes statistics
            const totalVotes = await this.repo('vote').count({ eventId });
            const uniqueVoters = await this.repo('vote').distinct('voterId', { eventId });

            // Candidates statistics
            const totalCandidates = await this.repo('candidate').count({ eventId });
            const approvedCandidates = await this.repo('candidate').count({
                eventId,
                status: 'approved',
            });

            // Revenue statistics
            const revenueData = await this.repo('payment').aggregate([
                { $match: { eventId, status: 'successful' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        transactionCount: { $sum: 1 },
                    },
                },
            ]);

            // Vote distribution
            const voteDistribution = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { votes: -1 } },
            ]);

            // Votes over time
            const votesOverTime = await this.repo('vote').aggregate([
                { $match: { eventId } },
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

            return this.handleSuccess({
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                },
                statistics: {
                    votes: {
                        total: totalVotes,
                        uniqueVoters: uniqueVoters.length,
                        distribution: voteDistribution,
                        overTime: votesOverTime,
                    },
                    candidates: {
                        total: totalCandidates,
                        approved: approvedCandidates,
                    },
                    revenue: {
                        total: revenueData[0]?.totalRevenue || 0,
                        transactions: revenueData[0]?.transactionCount || 0,
                    },
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Delete event (only draft events)
     */
    async deleteEvent(eventId, userId) {
        return this.runInContext('deleteEvent', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status !== 'draft') {
                throw new Error('Can only delete draft events. Use cancel for other statuses.');
            }

            await this.repo('event').delete(eventId);

            await this.logActivity(userId, 'delete', 'event', {
                eventId,
                eventName: event.name,
            });

            return this.handleSuccess(null, 'Event deleted successfully');
        });
    }
}
