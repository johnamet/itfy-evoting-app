#!/usr/bin/env node
/**
 * Event Repository
 * 
 * Extends BaseRepository to provide Event-specific database operations.
 * Includes event lifecycle management, participant tracking, and scheduling.
 */

import BaseRepository from './BaseRepository.js';
import Event from '../models/Event.js';
import mongoose from 'mongoose';


/**
 * Event status enumeration
 * @enum {String}
 */
class EventRepository extends BaseRepository {
    static Status = {
        DRAFT: 'draft',
        SCHEDULED: 'scheduled',
        ACTIVE: 'active',
        PAUSED: 'paused',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    };

    constructor() {
        // Get the Event model
        super(Event);
    }

    /**
     * Create a new event
     * @param {Object} eventData - Event data
     * @returns {Promise<Object>} Created event
     */
    async createEvent(eventData) {
        try {
            // Validate event dates
            this._validateEventDates(eventData);


            return await this.create({
                ...eventData,
                status: eventData.status || 'draft'
            });
        } catch (error) {
            throw this._handleError(error, 'createEvent');
        }
    }

    /**
     * Find active events
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Active events
     */
    async findActiveEvents(options = {}) {
        try {
            const criteria = {
                status: 'active',
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            };

            return await this.find(criteria, {
                ...options,
                sort: { startDate: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findActiveEvents');
        }
    }

    /**
     * Find upcoming events
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Upcoming events
     */
    async findUpcomingEvents(options = {}) {
        try {
            const criteria = {
                startDate: { $gt: new Date() },
                status: { $in: ['active', 'scheduled'] }
            };

            return await this.find(criteria, {
                ...options,
                sort: { startDate: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findUpcomingEvents');
        }
    }

    /**
     * Find past events
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Past events
     */
    async findPastEvents(options = {}) {
        try {
            const criteria = {
                endDate: { $lt: new Date() }
            };

            return await this.find(criteria, {
                ...options,
                sort: { endDate: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findPastEvents');
        }
    }

    /**
     * Find events by status
     * @param {String} status - Event status
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Events with specified status
     */
    async findByStatus(status, options = {}) {
        try {
            const criteria = { status };
            return await this.find(criteria, {
                ...options,
                sort: { createdAt: -1 },
            });
        } catch (error) {
            throw this._handleError(error, 'findByStatus');
        }
    }

    /**
     * Update event status
     * @param {String|ObjectId} eventId - Event ID
     * @param {String} status - New status
     * @returns {Promise<Object|null>} Updated event
     */
    async updateStatus(eventId, status) {
        try {
            const validStatuses = Object.values(EventRepository.Status);
            
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const updateData = { status };
            
            // Set completion date if status is completed
            if (status === 'completed') {
                updateData.completedAt = new Date();
            }
            
            // Set cancellation date if status is cancelled
            if (status === 'cancelled') {
                updateData.cancelledAt = new Date();
            }

            return await this.updateById(eventId, updateData);
        } catch (error) {
            throw this._handleError(error, 'updateStatus');
        }
    }

    /**
     * Start an event (change status to active)
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Object|null>} Updated event
     */
    async startEvent(eventId) {
        try {
            const event = await this.findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status === 'active') {
                throw new Error('Event is already active');
            }

            if (event.status === 'completed' || event.status === 'cancelled') {
                throw new Error('Cannot start a completed or cancelled event');
            }

            return await this.updateStatus(eventId, 'active');
        } catch (error) {
            throw this._handleError(error, 'startEvent');
        }
    }

    /**
     * End an event (change status to completed)
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Object|null>} Updated event
     */
    async endEvent(eventId) {
        try {
            const event = await this.findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status === 'completed') {
                throw new Error('Event is already completed');
            }

            if (event.status === 'cancelled') {
                throw new Error('Cannot complete a cancelled event');
            }

            return await this.updateStatus(eventId, 'completed');
        } catch (error) {
            throw this._handleError(error, 'endEvent');
        }
    }

    /**
     * Cancel an event
     * @param {String|ObjectId} eventId - Event ID
     * @param {String} reason - Cancellation reason
     * @returns {Promise<Object|null>} Updated event
     */
    async cancelEvent(eventId, reason = '') {
        try {
            const event = await this.findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status === 'cancelled') {
                throw new Error('Event is already cancelled');
            }

            if (event.status === 'completed') {
                throw new Error('Cannot cancel a completed event');
            }

            return await this.updateById(eventId, {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: reason
            });
        } catch (error) {
            throw this._handleError(error, 'cancelEvent');
        }
    }
    /**
     * Get event with full details (candidates, categories, etc.)
     * @param {String|ObjectId} eventId - Event ID
     * @param {Boolean} [includeVotes=false] - Whether to include votes details
     * @returns {Promise<Object|null>} Event with full details
     */
    async getEventDetails(eventId, includeVotes = false) {
        try {
            const pipeline = [
                { $match: { _id: new mongoose.Types.ObjectId(eventId) } },
                {
                    $lookup: {
                        from: 'candidates',
                        localField: '_id',
                        foreignField: 'event',
                        as: 'candidates'
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'candidates.category',
                        foreignField: '_id',
                        as: 'categories'
                    }
                }
            ];

            if (includeVotes) {
                pipeline.push(
                    {
                        $lookup: {
                            from: 'votes',
                            localField: '_id',
                            foreignField: 'event',
                            as: 'votes'
                        }
                    },
                    {
                        $addFields: {
                            totalVotes: { $size: '$votes' },
                            uniqueVoters: { $size: { $setUnion: ['$votes.voter.email'] } }
                        }
                    }
                );
            }

            pipeline.push({
                $addFields: {
                    candidateCount: { $size: '$candidates' },
                    categoryCount: { $size: { $setUnion: ['$candidates.category'] } }
                }
            });

            const [eventDetails] = await this.aggregate(pipeline);
            return eventDetails || null;
        } catch (error) {
            throw this._handleError(error, 'getEventDetails');
        }
    }

    /**
     * Get events where voting is open and at least one category is active
     * @returns {Promise<Array>} Events where voting is open
     */
    async getVotableEvents() {
        try {
            const pipeline = [
                {
                    $match: {
                        status: 'active',
                        startDate: { $lte: new Date() },
                        endDate: { $gte: new Date() }
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: '_id',
                        foreignField: 'event',
                        as: 'categories'
                    }
                },
                {
                    $addFields: {
                        activeCategoryCount: {
                            $size: {
                                $filter: {
                                    input: '$categories',
                                    as: 'cat',
                                    cond: { $eq: ['$$cat.status', 'active'] }
                                }
                            }
                        }
                    }
                },
                {
                    $match: {
                        activeCategoryCount: { $gt: 0 }
                    }
                },
                {
                    $sort: { startDate: 1 }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getVotableEvents');
        }
    }

    /**
     * Get event statistics
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Object>} Event statistics
     */
    async getEventStats(eventId) {
        try {
            const pipeline = [
                { $match: { _id: new mongoose.Types.ObjectId(eventId) } },
                {
                    $lookup: {
                        from: 'votes',
                        localField: '_id',
                        foreignField: 'event',
                        as: 'votes'
                    }
                },
                {
                    $lookup: {
                        from: 'candidates',
                        localField: '_id',
                        foreignField: 'event',
                        as: 'candidates'
                    }
                },
                {
                    $addFields: {
                        totalVotes: {
                            $sum: 1
                        },
                        candidateCount: { $size: '$candidates' },
                        categoryCount: { $size: '$categories' }
                    }
                },
                {
                    $project: {
                        name: 1,
                        status: 1,
                        startDate: 1,
                        endDate: 1,
                        totalVotes: 1,
                        candidateCount: 1,
                        categoryCount: 1,
                        votingDuration: {
                            $divide: [
                                { $subtract: ['$endDate', '$startDate'] },
                                1000 * 60 * 60 * 24 // Convert to days
                            ]
                        },
                        isActive: {
                            $and: [
                                { $eq: ['$status', 'active'] },
                                { $lte: ['$startDate', new Date()] },
                                { $gte: ['$endDate', new Date()] }
                            ]
                        }
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            return stats || null;
        } catch (error) {
            throw this._handleError(error, 'getEventStats');
        }
    }

    /**
     * Check if voting is allowed for event
     * @param {String|ObjectId} eventId - Event ID
     * @returns {Promise<Object>} Voting status
     */
    async checkVotingStatus(eventId) {
        try {
            const event = await this.findById(eventId);
            
            if (!event) {
                return {
                    canVote: false,
                    reason: 'Event not found'
                };
            }

            const now = new Date();
            
            if (event.status !== 'active') {
                return {
                    canVote: false,
                    reason: `Event is ${event.status}`,
                    event
                };
            }

            if (now < event.startDate) {
                return {
                    canVote: false,
                    reason: 'Voting has not started yet',
                    startsIn: event.startDate - now,
                    event
                };
            }

            if (now > event.endDate) {
                return {
                    canVote: false,
                    reason: 'Voting has ended',
                    endedAgo: now - event.endDate,
                    event
                };
            }

            return {
                canVote: true,
                reason: 'Voting is open',
                timeRemaining: event.endDate - now,
                event
            };
        } catch (error) {
            throw this._handleError(error, 'checkVotingStatus');
        }
    }

    /**
     * Update event dates
     * @param {String|ObjectId} eventId - Event ID
     * @param {Date} startDate - New start date
     * @param {Date} endDate - New end date
     * @returns {Promise<Object|null>} Updated event
     */
    async updateEventDates(eventId, startDate, endDate) {
        try {
            const event = await this.findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status === EventRepository.Status.COMPLETED || event.status === EventRepository.Status.CANCELLED) {
                throw new Error('Cannot update dates for completed or cancelled events');
            }

            // Validate new dates
            this._validateEventDates({ startDate, endDate });

            return await this.updateById(eventId, {
                startDate,
                endDate
            });
        } catch (error) {
            throw this._handleError(error, 'updateEventDates');
        }
    }

    /**
     * Get events requiring status updates
     * @returns {Promise<Array>} Events that need status updates
     */
    async getEventsRequiringUpdates() {
        try {
            const now = new Date();
            
            const pipeline = [
                {
                    $match: {
                        $or: [
                            // Events that should be started
                            {
                                status: 'scheduled',
                                startDate: { $lte: now }
                            },
                            // Events that should be ended
                            {
                                status: 'active',
                                endDate: { $lt: now }
                            }
                        ]
                    }
                },
                {
                    $addFields: {
                        requiredAction: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'scheduled'] }, { $lte: ['$startDate', now] }] },
                                'start',
                                'end'
                            ]
                        }
                    }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getEventsRequiringUpdates');
        }
    }

    /**
     * Validate event dates
     * @private
     * @param {Object} eventData - Event data with dates
     */
    _validateEventDates(eventData) {
        const { startDate, endDate } = eventData;
        
        if (startDate && endDate) {
            if (new Date(startDate) >= new Date(endDate)) {
                throw new Error('End date must be after start date');
            }
        }
        
        if (startDate && new Date(startDate) < new Date()) {
            // Allow this for updating existing events, but warn in logs
            console.warn('Warning: Start date is in the past');
        }
    }
}

export default EventRepository;
