#!/usr/bin/env node
/**
 * EventService Tests
 * 
 * Unit tests for the EventService class
 */

import { expect } from 'chai';
import sinon from 'sinon';
import EventService from '../../services/EventService.js';
import EventRepository from '../../repositories/EventRepository.js';
import CandidateRepository from '../../repositories/CandidateRepository.js';
import VoteRepository from '../../repositories/VoteRepository.js';
import ActivityRepository from '../../repositories/ActivityRepository.js';

describe('EventService', () => {
    let eventService;
    let eventRepositoryStub;
    let candidateRepositoryStub;
    let voteRepositoryStub;
    let activityRepositoryStub;

    beforeEach(() => {
        eventService = new EventService();
        
        eventRepositoryStub = sinon.createStubInstance(EventRepository);
        candidateRepositoryStub = sinon.createStubInstance(CandidateRepository);
        voteRepositoryStub = sinon.createStubInstance(VoteRepository);
        activityRepositoryStub = sinon.createStubInstance(ActivityRepository);

        eventService.eventRepository = eventRepositoryStub;
        eventService.candidateRepository = candidateRepositoryStub;
        eventService.voteRepository = voteRepositoryStub;
        eventService.activityRepository = activityRepositoryStub;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('createEvent', () => {
        const validEventData = {
            name: 'Test Event',
            description: 'Event description',
            startDate: new Date(Date.now() + 86400000), // Tomorrow
            endDate: new Date(Date.now() + 172800000)   // Day after tomorrow
        };
        const createdBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.createEvent.resolves({
                _id: '507f1f77bcf86cd799439011',
                name: 'Test Event',
                description: 'Event description',
                status: 'draft',
                createdBy,
                createdAt: new Date()
            });
            activityRepositoryStub.logActivity.resolves();
        });

        it('should create event successfully', async () => {
            const result = await eventService.createEvent(validEventData, createdBy);

            expect(result.success).to.be.true;
            expect(result.event.name).to.equal('Test Event');
            expect(eventRepositoryStub.createEvent.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error for missing required fields', async () => {
            const invalidData = { name: 'Test Event' }; // missing dates

            try {
                await eventService.createEvent(invalidData, createdBy);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Missing required field');
            }
        });

        it('should throw error for past start date', async () => {
            const pastEventData = {
                ...validEventData,
                startDate: new Date(Date.now() - 86400000) // Yesterday
            };

            try {
                await eventService.createEvent(pastEventData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Event start date must be in the future');
            }
        });

        it('should throw error for invalid date range', async () => {
            const invalidRangeData = {
                ...validEventData,
                endDate: validEventData.startDate // Same as start date
            };

            try {
                await eventService.createEvent(invalidRangeData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('End date must be after start date');
            }
        });
    });

    describe('updateEvent', () => {
        const eventId = '507f1f77bcf86cd799439011';
        const updatedBy = '507f1f77bcf86cd799439013';
        const updateData = {
            name: 'Updated Event',
            description: 'Updated description'
        };

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: eventId,
                name: 'Test Event',
                status: 'draft',
                startDate: new Date(Date.now() + 86400000),
                endDate: new Date(Date.now() + 172800000)
            });

            eventRepositoryStub.updateEvent.resolves({
                _id: eventId,
                name: 'Updated Event',
                description: 'Updated description',
                updatedAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should update event successfully', async () => {
            const result = await eventService.updateEvent(eventId, updateData, updatedBy);

            expect(result.success).to.be.true;
            expect(result.event.name).to.equal('Updated Event');
            expect(eventRepositoryStub.updateEvent.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if event not found', async () => {
            eventRepositoryStub.findById.resolves(null);

            try {
                await eventService.updateEvent(eventId, updateData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Event not found');
            }
        });

        it('should throw error for completed event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'completed'
            });

            try {
                await eventService.updateEvent(eventId, updateData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Cannot update completed event');
            }
        });
    });

    describe('deleteEvent', () => {
        const eventId = '507f1f77bcf86cd799439011';
        const deletedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: eventId,
                name: 'Test Event',
                status: 'draft'
            });

            voteRepositoryStub.countVotesForEvent.resolves(0);
            candidateRepositoryStub.findByEvent.resolves([]);
            eventRepositoryStub.deleteEvent.resolves();
            activityRepositoryStub.logActivity.resolves();
        });

        it('should delete event successfully', async () => {
            const result = await eventService.deleteEvent(eventId, deletedBy);

            expect(result.success).to.be.true;
            expect(result.message).to.equal('Event deleted successfully');
            expect(eventRepositoryStub.deleteEvent.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if event has votes', async () => {
            voteRepositoryStub.countVotesForEvent.resolves(5);

            try {
                await eventService.deleteEvent(eventId, deletedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Cannot delete event with existing votes');
            }
        });

        it('should throw error for active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'active'
            });

            try {
                await eventService.deleteEvent(eventId, deletedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Cannot delete active or completed event');
            }
        });
    });

    describe('getEventById', () => {
        const eventId = '507f1f77bcf86cd799439011';

        it('should get event with details', async () => {
            const mockEvent = {
                _id: eventId,
                name: 'Test Event',
                candidateCount: 5,
                voteCount: 25
            };

            eventRepositoryStub.getEventWithDetails.resolves(mockEvent);

            const result = await eventService.getEventById(eventId);

            expect(result.success).to.be.true;
            expect(result.event).to.deep.equal(mockEvent);
        });

        it('should throw error if event not found', async () => {
            eventRepositoryStub.getEventWithDetails.resolves(null);

            try {
                await eventService.getEventById(eventId);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Event not found');
            }
        });
    });

    describe('getEvents', () => {
        it('should get paginated events', async () => {
            const mockEvents = [
                { _id: '1', name: 'Event 1' },
                { _id: '2', name: 'Event 2' }
            ];

            eventRepositoryStub.getAllEvents.resolves({
                events: mockEvents,
                total: 10,
                page: 1,
                totalPages: 5
            });

            const result = await eventService.getEvents({ page: 1, limit: 2 });

            expect(result.success).to.be.true;
            expect(result.data.events).to.deep.equal(mockEvents);
            expect(result.data.total).to.equal(10);
        });
    });

    describe('activateEvent', () => {
        const eventId = '507f1f77bcf86cd799439011';
        const activatedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: eventId,
                name: 'Test Event',
                status: 'draft',
                startDate: new Date(Date.now() + 86400000)
            });

            candidateRepositoryStub.findByEvent.resolves([
                { _id: '1', name: 'Candidate 1' }
            ]);

            eventRepositoryStub.updateEvent.resolves({
                _id: eventId,
                status: 'active',
                activatedAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should activate event successfully', async () => {
            const result = await eventService.activateEvent(eventId, activatedBy);

            expect(result.success).to.be.true;
            expect(result.event.status).to.equal('active');
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if event has no candidates', async () => {
            candidateRepositoryStub.findByEvent.resolves([]);

            try {
                await eventService.activateEvent(eventId, activatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Cannot activate event without candidates');
            }
        });

        it('should throw error for already active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'active'
            });

            try {
                await eventService.activateEvent(eventId, activatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Event is already active');
            }
        });
    });

    describe('completeEvent', () => {
        const eventId = '507f1f77bcf86cd799439011';
        const completedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: eventId,
                name: 'Test Event',
                status: 'active'
            });

            eventRepositoryStub.updateEvent.resolves({
                _id: eventId,
                status: 'completed',
                completedAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should complete event successfully', async () => {
            const result = await eventService.completeEvent(eventId, completedBy);

            expect(result.success).to.be.true;
            expect(result.event.status).to.equal('completed');
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error for non-active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            try {
                await eventService.completeEvent(eventId, completedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Only active events can be completed');
            }
        });
    });

    describe('getEventStatistics', () => {
        const eventId = '507f1f77bcf86cd799439011';

        it('should get event statistics', async () => {
            const mockStats = {
                totalVotes: 100,
                totalCandidates: 5,
                votingTurnout: 75.5,
                topCandidate: { name: 'Winner', votes: 40 }
            };

            eventRepositoryStub.getEventStatistics.resolves(mockStats);

            const result = await eventService.getEventStatistics(eventId);

            expect(result.success).to.be.true;
            expect(result.data.totalVotes).to.equal(100);
            expect(result.data).to.have.property('generatedAt');
        });
    });

    describe('searchEvents', () => {
        it('should return empty array for empty search term', async () => {
            const result = await eventService.searchEvents('');

            expect(result.success).to.be.true;
            expect(result.data).to.be.an('array').that.is.empty;
        });

        it('should search events by name', async () => {
            const mockEvents = [
                { _id: '1', name: 'Election 2024' },
                { _id: '2', name: 'Student Election' }
            ];

            eventRepositoryStub.searchEventsByName.resolves(mockEvents);

            const result = await eventService.searchEvents('Election');

            expect(result.success).to.be.true;
            expect(result.data).to.deep.equal(mockEvents);
        });
    });
});
