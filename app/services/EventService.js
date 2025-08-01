#!/usr/bin/env node
/**
 * Event Service
 * 
 * Handles event management including creation, lifecycle management,
 * event status updates, and event-related business logic.
 */

import BaseService from './BaseService.js';
import EventRepository from '../repositories/EventRepository.js';
import CandidateRepository from '../repositories/CandidateRepository.js';
import VoteRepository from '../repositories/VoteRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import EmailService from './EmailService.js';
import { populate } from 'dotenv';

class EventService extends BaseService {
    constructor() {
        super();
        this.eventRepository = new EventRepository();
        this.candidateRepository = new CandidateRepository();
        this.voteRepository = new VoteRepository();
        this.activityRepository = new ActivityRepository();
        this.emailService = new EmailService();
        this.adminEmail = process.env.ADMIN_EMAIL || 'admin@itfy.com';
    }

    /**
     * Create a new event
     * @param {Object} eventData - Event data
     * @param {String} createdBy - ID of user creating the event
     * @returns {Promise<Object>} Created event
     */
    async createEvent(eventData, createdBy) {
        try {
            this._log('create_event', { name: eventData.name, createdBy });

            // Validate required fields
            this._validateRequiredFields(eventData, ['name', 'startDate', 'endDate']);
            this._validateObjectId(createdBy, 'Created By User ID');

            // Validate dates
            this._validateDateRange(eventData.startDate, eventData.endDate);

            // Ensure start date is in the future
            if (new Date(eventData.startDate) <= new Date()) {
                throw new Error('Event start date must be in the future');
            }

            // Create event with default status
            const eventToCreate = {
                ...this._sanitizeData(eventData),
                status: eventData.status || 'draft',
                createdBy,
                createdAt: new Date()
            };

            const event = await this.eventRepository.createEvent(eventToCreate);


            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'create',
                targetType: 'event',
                targetId: event._id,
                metadata: { eventName: event.name, status: event.status }
            });

            // Send event creation email
            await this.emailService.sendEventNotification(
                { email: this.adminEmail, name: 'Admin' },
                {
                    id: event._id,
                    name: event.name,
                    description: event.description,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    status: event.status
                }
            );

            this._log('create_event_success', { eventId: event._id, name: event.name });

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    description: event.description,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    status: event.status,
                    createdAt: event.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_event', { name: eventData.name });
        }
    }

    /**
     * Update event details
     * @param {String} eventId - Event ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user updating the event
     * @returns {Promise<Object>} Updated event
     */
    async updateEvent(eventId, updateData, updatedBy) {
        try {
            this._log('update_event', { eventId, updatedBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current event
            const currentEvent = await this.eventRepository.findById(eventId);
            if (!currentEvent) {
                throw new Error('Event not found');
            }

            // Validate dates if being updated
            if (updateData.startDate || updateData.endDate) {
                const startDate = updateData.startDate || currentEvent.startDate;
                const endDate = updateData.endDate || currentEvent.endDate;
                this._validateDateRange(startDate, endDate);
            }

            // Check if event can be updated
            if (currentEvent.status === 'completed') {
                throw new Error('Cannot update completed event');
            }

            if (currentEvent.status === 'active' && updateData.startDate) {
                throw new Error('Cannot change start date of active event');
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            delete sanitizedData._id;
            delete sanitizedData.createdAt;
            delete sanitizedData.createdBy;
            sanitizedData.updatedAt = new Date();

            // Update event
            const updatedEvent = await this.eventRepository.updateById(eventId, sanitizedData);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'update',
                targetType: 'event',
                targetId: eventId,
                metadata: { 
                    eventName: updatedEvent.name,
                    updatedFields: Object.keys(sanitizedData)
                }
            });

            // Send event update email
            await this.emailService.sendEventNotification(
                { email: this.adminEmail, name: 'Admin' },
                {
                    id: updatedEvent._id,
                    name: updatedEvent.name,
                    description: updatedEvent.description,
                    startDate: updatedEvent.startDate,
                    endDate: updatedEvent.endDate,
                    status: updatedEvent.status
                }
            );

            this._log('update_event_success', { eventId });

            return {
                success: true,
                event: {
                    id: updatedEvent._id,
                    name: updatedEvent.name,
                    description: updatedEvent.description,
                    startDate: updatedEvent.startDate,
                    endDate: updatedEvent.endDate,
                    status: updatedEvent.status,
                    updatedAt: updatedEvent.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_event', { eventId });
        }
    }

    /**
     * Start an event
     * @param {String} eventId - Event ID
     * @param {String} startedBy - ID of user starting the event
     * @returns {Promise<Object>} Start result
     */
    async startEvent(eventId, startedBy) {
        try {
            this._log('start_event', { eventId, startedBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(startedBy, 'Started By User ID');

            // Check if event has candidates
            const candidates = await this.candidateRepository.findByEvent(eventId);
            if (candidates.length === 0) {
                throw new Error('Cannot start event without candidates');
            }

            // Start the event
            const event = await this.eventRepository.startEvent(eventId);

            // Log activity
            await this.activityRepository.logActivity({
                user: startedBy,
                action: 'start',
                targetType: 'event',
                targetId: eventId,
                metadata: { 
                    eventName: event.name,
                    candidatesCount: candidates.length
                }
            });

            // Send event notification to users (in the background)
            this._sendEventNotificationEmails(event, 'started').catch(emailError => {
                this._logError('event_notification_email_failed', emailError, { eventId });
            });

            this._log('start_event_success', { eventId });

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    startedAt: event.startedAt
                },
                message: 'Event started successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'start_event', { eventId });
        }
    }

    /**
     * End an event
     * @param {String} eventId - Event ID
     * @param {String} endedBy - ID of user ending the event
     * @returns {Promise<Object>} End result
     */
    async endEvent(eventId, endedBy) {
        try {
            this._log('end_event', { eventId, endedBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(endedBy, 'Ended By User ID');

            // End the event
            const event = await this.eventRepository.endEvent(eventId);

            // Log activity
            await this.activityRepository.logActivity({
                user: endedBy,
                action: 'end',
                targetType: 'event',
                targetId: eventId,
                metadata: { eventName: event.name }
            });

            // Send event end email
            await this.emailService.sendEventNotification(
                { email: this.adminEmail, name: 'Admin' },
                {
                    id: event._id,
                    name: event.name,
                    description: event.description,
                    status: event.status,
                    completedAt: event.completedAt
                }
            );

            this._log('end_event_success', { eventId });

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    completedAt: event.completedAt
                },
                message: 'Event ended successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'end_event', { eventId });
        }
    }

    /**
     * Cancel an event
     * @param {String} eventId - Event ID
     * @param {String} cancelledBy - ID of user cancelling the event
     * @param {String} reason - Cancellation reason
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelEvent(eventId, cancelledBy, reason = '') {
        try {
            this._log('cancel_event', { eventId, cancelledBy, reason });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(cancelledBy, 'Cancelled By User ID');

            // Cancel the event
            const event = await this.eventRepository.cancelEvent(eventId, reason);

            // Log activity
            await this.activityRepository.logActivity({
                user: cancelledBy,
                action: 'cancel',
                targetType: 'event',
                targetId: eventId,
                metadata: { 
                    eventName: event.name,
                    reason: reason || 'No reason provided'
                }
            });

            // Send event cancellation email
            await this.emailService.sendEventNotification(
                { email: this.adminEmail, name: 'Admin' },
                {
                    id: event._id,
                    name: event.name,
                    description: event.description,
                    status: event.status,
                    cancelledAt: event.cancelledAt,
                    cancellationReason: event.cancellationReason
                }
            );

            this._log('cancel_event_success', { eventId });

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    cancelledAt: event.cancelledAt,
                    cancellationReason: event.cancellationReason
                },
                message: 'Event cancelled successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'cancel_event', { eventId });
        }
    }

    /**
     * Get event by ID with detailed information
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>} Event details
     */
    async getEventById(eventId) {
        try {
            this._log('get_event_by_id', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get candidates count
            const candidates = await this.candidateRepository.findByEvent(eventId);
            const candidatesCount = candidates.length;

            // Get categories
            const categories = [...new Set(candidates.map(c => c.category.toString()))];
            const categoriesCount = categories.length;

            // Get votes count if event is active or completed
            let votesCount = 0;
            if (event.status === 'active' || event.status === 'completed') {
                const votes = await this.voteRepository.getVotesByEvent(eventId);
                votesCount = votes.length;
            }

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    description: event.description,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    status: event.status,
                    candidatesCount,
                    categoriesCount,
                    votesCount,
                    createdAt: event.createdAt,
                    updatedAt: event.updatedAt,
                    startedAt: event.startedAt,
                    completedAt: event.completedAt,
                    cancelledAt: event.cancelledAt,
                    cancellationReason: event.cancellationReason
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_event_by_id', { eventId });
        }
    }

    /**
     * Get events with filtering and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Paginated events
     */
    async getEvents(query = {}) {
        try {
            this._log('get_events', { query });

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Create filter based on query
            const filter = this._createSearchFilter(query, ['name', 'description']);

            let events;
            if (query.status) {
                events = await this.eventRepository.findByStatus(query.status, { 
                    skip: (page - 1) * limit, 
                    limit 
                });
            } else if (query.type === 'active') {
                events = await this.eventRepository.findActiveEvents(new Date(), new Date(), {
                    skip: (page - 1) * limit,
                    limit
                });
            } else if (query.type === 'upcoming') {
                events = await this.eventRepository.findUpcomingEvents({
                    skip: (page - 1) * limit,
                    limit
                });
            } else if (query.type === 'past') {
                events = await this.eventRepository.findPastEvents({
                    skip: (page - 1) * limit,
                    limit
                });
            } else {
                events = await this.eventRepository.find(filter, {
                    skip: (page - 1) * limit,
                    limit,
                    sort: { createdAt: -1 },
                    ...query.populate ? { populate: query.populate } : {}
                });
            }

            // Get total count for pagination
            const total = await this.eventRepository.countDocuments(filter);

            // Format events with additional information
            const formattedEvents = await Promise.all(
                events.map(async (event) => {
                    const candidates = await this.candidateRepository.findByEvent(event._id);
                    return {
                        id: event._id,
                        name: event.name,
                        description: event.description,
                        startDate: event.startDate,
                        endDate: event.endDate,
                        status: event.status,
                        candidatesCount: candidates.length,
                        createdAt: event.createdAt,
                        createdBy: event.createdBy,
                    };
                })
            );

            return {
                success: true,
                data: this._formatPaginationResponse(formattedEvents, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_events', { query });
        }
    }

    /**
     * Check voting status for an event
     * @param {String} eventId - Event ID
     * @returns {Promise<Object>} Voting status
     */
    async checkVotingStatus(eventId) {
        try {
            this._log('check_voting_status', { eventId });

            this._validateObjectId(eventId, 'Event ID');

            const status = await this.eventRepository.checkVotingStatus(eventId);

            return {
                success: true,
                data: status
            };
        } catch (error) {
            throw this._handleError(error, 'check_voting_status', { eventId });
        }
    }

    /**
     * Get events requiring status updates
     * @returns {Promise<Object>} Events needing updates
     */
    async getEventsRequiringUpdates() {
        try {
            this._log('get_events_requiring_updates');

            const events = await this.eventRepository.getEventsRequiringUpdates();

            return {
                success: true,
                data: events
            };
        } catch (error) {
            throw this._handleError(error, 'get_events_requiring_updates');
        }
    }

    /**
     * Update event dates
     * @param {String} eventId - Event ID
     * @param {Date} startDate - New start date
     * @param {Date} endDate - New end date
     * @param {String} updatedBy - ID of user updating dates
     * @returns {Promise<Object>} Update result
     */
    async updateEventDates(eventId, startDate, endDate, updatedBy) {
        try {
            this._log('update_event_dates', { eventId, startDate, endDate, updatedBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');
            this._validateDateRange(startDate, endDate);

            const event = await this.eventRepository.updateEventDates(eventId, startDate, endDate);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'update',
                targetType: 'event',
                targetId: eventId,
                metadata: { 
                    eventName: event.name,
                    newStartDate: startDate,
                    newEndDate: endDate
                }
            });

            this._log('update_event_dates_success', { eventId });

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    updatedAt: event.updatedAt
                },
                message: 'Event dates updated successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'update_event_dates', { eventId });
        }
    }

    /**
     * Send event notification emails to all eligible users
     * @param {Object} event - Event object
     * @param {String} notificationType - Type of notification (started, created, reminder)
     * @private
     */
    async _sendEventNotificationEmails(event, notificationType = 'created') {
        try {
            this._log('send_event_notifications', { eventId: event._id, type: notificationType });

            // For now, we'll need to get users from UserRepository
            // In a real implementation, you might have a subscription system
            const UserRepository = (await import('../repositories/UserRepository.js')).default;
            const userRepository = new UserRepository();
            
            // Get all active users (you might want to filter based on event eligibility)
            const users = await userRepository.findActiveUsers({ limit: 1000 });
            
            if (users.length === 0) {
                this._log('no_users_for_notification', { eventId: event._id });
                return;
            }

            // Prepare email data
            const eventData = {
                id: event._id,
                _id: event._id,
                name: event.name,
                title: event.name,
                description: event.description,
                registrationStartDate: event.registrationStartDate || event.startDate,
                registrationEndDate: event.registrationEndDate || event.startDate,
                votingStartDate: event.startDate,
                votingEndDate: event.endDate,
                entryFee: event.entryFee || 0,
                currency: event.currency || 'GHS',
                categories: [], // You might want to populate this from categories
                paymentDeadline: event.registrationEndDate || event.startDate,
                details: event.details
            };

            // Send emails in batches to avoid overwhelming the email service
            const batchSize = 10;
            let emailsSent = 0;
            let emailsFailed = 0;

            for (let i = 0; i < users.length; i += batchSize) {
                const batch = users.slice(i, i + batchSize);
                const batchPromises = batch.map(user => 
                    this.emailService.sendEventNotification(
                        {
                            name: user.name,
                            fullName: user.name,
                            email: user.email
                        },
                        eventData
                    ).then(() => {
                        emailsSent++;
                    }).catch(error => {
                        emailsFailed++;
                        this._logError('individual_event_notification_failed', error, { 
                            userId: user._id, 
                            email: user.email,
                            eventId: event._id 
                        });
                    })
                );

                await Promise.allSettled(batchPromises);
                
                // Small delay between batches to respect rate limits
                if (i + batchSize < users.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this._log('event_notifications_completed', { 
                eventId: event._id, 
                totalUsers: users.length,
                emailsSent,
                emailsFailed,
                type: notificationType 
            });

        } catch (error) {
            this._logError('send_event_notifications_error', error, { eventId: event._id });
        }
    }

    /**
     * Publish an event (make it available for registration)
     * @param {String} eventId - Event ID
     * @param {String} publishedBy - ID of user publishing the event
     * @returns {Promise<Object>} Publish result
     */
    async publishEvent(eventId, publishedBy) {
        try {
            this._log('publish_event', { eventId, publishedBy });

            this._validateObjectId(eventId, 'Event ID');
            this._validateObjectId(publishedBy, 'Published By User ID');

            // Get current event
            const currentEvent = await this.eventRepository.findById(eventId);
            if (!currentEvent) {
                throw new Error('Event not found');
            }

            if (currentEvent.status !== 'draft') {
                throw new Error('Only draft events can be published');
            }

            // Update event status to published
            const event = await this.eventRepository.updateById(eventId, {
                status: 'published',
                publishedAt: new Date(),
                publishedBy
            });

            // Log activity
            await this.activityRepository.logActivity({
                user: publishedBy,
                action: 'publish',
                targetType: 'event',
                targetId: eventId,
                metadata: { 
                    eventName: event.name,
                    publishedAt: event.publishedAt
                }
            });

            // Send event notification emails (async)
            this._sendEventNotificationEmails(event, 'published').catch(emailError => {
                this._logError('event_publish_notification_failed', emailError, { eventId });
            });

            this._log('publish_event_success', { eventId });

            return {
                success: true,
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                    publishedAt: event.publishedAt
                },
                message: 'Event published successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'publish_event', { eventId });
        }
    }
}

export default EventService;
