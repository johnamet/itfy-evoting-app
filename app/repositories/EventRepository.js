#!/usr/bin/env node
/**
 * Enhanced Event Repository
 * 
 * Provides event-specific database operations with intelligent caching.
 * Event data is automatically cached and invalidated when updated.
 * 
 * @module EventRepository
 * @version 2.0.0
 */

import BaseRepository from '../BaseRepository.js';
import Event from '../../models/Event.js';
import { eventCacheManager } from '../../utils/engine/CacheManager.js';

class EventRepository extends BaseRepository {
    constructor() {
        super(Event, {
            enableCache: true,
            cacheManager: eventCacheManager,
        });
    }

    // ============================================
    // EVENT MANAGEMENT
    // ============================================

    /**
     * Create a new event
     * @param {Object} eventData - Event data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async createEvent(eventData, options = {}) {
        try {
            this.validateRequiredFields(eventData, [
                'title',
                'startDate',
                'endDate',
                'createdBy',
            ]);

            const event = await this.create(eventData, options);

            this.log('createEvent', { eventId: event._id, title: event.title });

            return event;
        } catch (error) {
            throw this.handleError(error, 'createEvent', { title: eventData.title });
        }
    }

    /**
     * Update event by ID
     * @param {String} eventId - Event ID
     * @param {Object} updateData - Data to update
     * @param {Object} options - Update options
     * @returns {Promise<Object>}
     */
    async updateEvent(eventId, updateData, options = {}) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            const event = await this.updateById(eventId, updateData, {
                ...options,
                new: true,
                runValidators: true,
            });

            if (!event) {
                return null;
            }

            this.log('updateEvent', { eventId, success: true });

            return event;
        } catch (error) {
            throw this.handleError(error, 'updateEvent', { eventId });
        }
    }

    // ============================================
    // EVENT QUERIES
    // ============================================

    /**
     * Find events by creator
     * @param {String} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByCreator(userId, options = {}) {
        try {
            this.validateObjectId(userId, 'User ID');

            return await this.find(
                { createdBy: userId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByCreator', { userId });
        }
    }

    /**
     * Find active events
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findActiveEvents(options = {}) {
        try {
            const now = new Date();

            return await this.find(
                {
                    status: 'active',
                    startDate: { $lte: now },
                    endDate: { $gte: now },
                    deleted: false,
                },
                { ...options, sort: { startDate: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findActiveEvents');
        }
    }

    /**
     * Find upcoming events
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findUpcomingEvents(options = {}) {
        try {
            const now = new Date();

            return await this.find(
                {
                    startDate: { $gt: now },
                    deleted: false,
                },
                { ...options, sort: { startDate: 1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findUpcomingEvents');
        }
    }

    /**
     * Find past events
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findPastEvents(options = {}) {
        try {
            const now = new Date();

            return await this.find(
                {
                    endDate: { $lt: now },
                    deleted: false,
                },
                { ...options, sort: { endDate: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findPastEvents');
        }
    }

    /**
     * Find events by status
     * @param {String} status - Event status
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByStatus(status, options = {}) {
        try {
            return await this.find(
                { status, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByStatus', { status });
        }
    }

    /**
     * Find events by category
     * @param {String} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByCategory(categoryId, options = {}) {
        try {
            this.validateObjectId(categoryId, 'Category ID');

            return await this.find(
                { category: categoryId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByCategory', { categoryId });
        }
    }

    /**
     * Search events by text
     * @param {String} searchText - Search query
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async searchEvents(searchText, options = {}) {
        try {
            if (!searchText) {
                return [];
            }

            return await this.textSearch(searchText, { deleted: false }, options);
        } catch (error) {
            throw this.handleError(error, 'searchEvents', { searchText });
        }
    }

    // ============================================
    // EVENT STATUS MANAGEMENT
    // ============================================

    /**
     * Publish event
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>}
     */
    async publishEvent(eventId) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.updateById(eventId, {
                status: 'active',
                publishedAt: new Date(),
            });
        } catch (error) {
            throw this.handleError(error, 'publishEvent', { eventId });
        }
    }

    /**
     * Close event
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>}
     */
    async closeEvent(eventId) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.updateById(eventId, {
                status: 'closed',
                closedAt: new Date(),
            });
        } catch (error) {
            throw this.handleError(error, 'closeEvent', { eventId });
        }
    }

    /**
     * Cancel event
     * @param {String} eventId - Event ID
     * @param {String} reason - Cancellation reason
     * @returns {Promise<Object>}
     */
    async cancelEvent(eventId, reason = null) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.updateById(eventId, {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: reason,
            });
        } catch (error) {
            throw this.handleError(error, 'cancelEvent', { eventId });
        }
    }

    // ============================================
    // EVENT STATISTICS
    // ============================================

    /**
     * Get event statistics
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>}
     */
    async getEventStats(eventId) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            const event = await this.findById(eventId, {
                populate: ['candidates', 'categories'],
            });

            if (!event) {
                throw new Error('Event not found');
            }

            // Get vote count (you'll need to implement this with Vote repository)
            const candidateCount = event.candidates?.length || 0;
            const categoryCount = event.categories?.length || 0;

            return {
                eventId,
                title: event.title,
                status: event.status,
                candidateCount,
                categoryCount,
                totalVotes: event.totalVotes || 0,
                startDate: event.startDate,
                endDate: event.endDate,
                isPaid: event.isPaid,
                price: event.price,
                createdAt: event.createdAt,
            };
        } catch (error) {
            throw this.handleError(error, 'getEventStats', { eventId });
        }
    }

    /**
     * Increment vote count for event
     * @param {String} eventId - Event ID
     * @param {Number} count - Number to increment by (default: 1)
     * @returns {Promise<Object>}
     */
    async incrementVoteCount(eventId, count = 1) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.updateById(eventId, {
                $inc: { totalVotes: count },
            });
        } catch (error) {
            throw this.handleError(error, 'incrementVoteCount', { eventId });
        }
    }

    /**
     * Get total event count
     * @param {Object} filter - Optional filter
     * @returns {Promise<Number>}
     */
    async getEventCount(filter = {}) {
        try {
            return await this.count({ ...filter, deleted: false });
        } catch (error) {
            throw this.handleError(error, 'getEventCount');
        }
    }

    /**
     * Get active event count
     * @returns {Promise<Number>}
     */
    async getActiveEventCount() {
        try {
            const now = new Date();

            return await this.count({
                status: 'active',
                startDate: { $lte: now },
                endDate: { $gte: now },
                deleted: false,
            });
        } catch (error) {
            throw this.handleError(error, 'getActiveEventCount');
        }
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    /**
     * Update multiple events by creator
     * @param {String} userId - User ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>}
     */
    async updateEventsByCreator(userId, updateData) {
        try {
            this.validateObjectId(userId, 'User ID');

            return await this.updateMany(
                { createdBy: userId },
                updateData
            );
        } catch (error) {
            throw this.handleError(error, 'updateEventsByCreator', { userId });
        }
    }

    /**
     * Close all expired events
     * @returns {Promise<Object>}
     */
    async closeExpiredEvents() {
        try {
            const now = new Date();

            return await this.updateMany(
                {
                    status: 'active',
                    endDate: { $lt: now },
                },
                {
                    status: 'closed',
                    closedAt: now,
                }
            );
        } catch (error) {
            throw this.handleError(error, 'closeExpiredEvents');
        }
    }
}

export default EventRepository;
