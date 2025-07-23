#!/usr/bin/env node
/**
 * EventRepository Test Suite
 */

import mongoose from 'mongoose';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
import EventRepository from '../../repositories/EventRepository.js';

describe('EventRepository', () => {
    let eventRepository;
    let mockEvent;
    let eventId;

    beforeEach(() => {
        eventRepository = new EventRepository();
        eventId = new mongoose.Types.ObjectId();
        mockEvent = {
            _id: eventId,
            name: 'Test Election',
            description: 'Test election description',
            startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
            status: 'draft',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Constructor', () => {
        it('should initialize with Event model', () => {
            expect(eventRepository).to.be.instanceOf(EventRepository);
            expect(eventRepository.model).to.exist;
        });

        it('should have status constants', () => {
            expect(EventRepository.Status.DRAFT).to.equal('draft');
            expect(EventRepository.Status.ACTIVE).to.equal('active');
            expect(EventRepository.Status.COMPLETED).to.equal('completed');
            expect(EventRepository.Status.CANCELLED).to.equal('cancelled');
            expect(EventRepository.Status.SCHEDULED).to.equal('scheduled');
            expect(EventRepository.Status.PAUSED).to.equal('paused');
        });
    });

    describe('createEvent', () => {
        it('should create an event successfully', async () => {
            const eventData = {
                name: 'Test Election',
                description: 'Test description',
                startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const createStub = sinon.stub(eventRepository, 'create').resolves(mockEvent);

            const result = await eventRepository.createEvent(eventData);

            expect(createStub.calledOnce).to.be.true;
            expect(createStub.calledWith({
                ...eventData,
                status: 'draft'
            })).to.be.true;
            expect(result).to.equal(mockEvent);
        });

        it('should set default status to draft if not provided', async () => {
            const eventData = {
                name: 'Test Election',
                description: 'Test description',
                startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const createStub = sinon.stub(eventRepository, 'create').resolves(mockEvent);

            await eventRepository.createEvent(eventData);

            const calledWith = createStub.getCall(0).args[0];
            expect(calledWith.status).to.equal('draft');
        });

        it('should validate event dates', async () => {
            const eventData = {
                name: 'Test Election',
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // End before start
            };

            try {
                await eventRepository.createEvent(eventData);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('End date must be after start date');
            }
        });

        it('should handle errors properly', async () => {
            const eventData = {
                name: 'Test Election',
                startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            const error = new Error('Database error');
            sinon.stub(eventRepository, 'create').rejects(error);
            sinon.stub(eventRepository, '_handleError').returns(error);

            try {
                await eventRepository.createEvent(eventData);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });
    });

    describe('findActiveEvents', () => {
        it('should find active events within date range', async () => {
            const mockActiveEvents = [mockEvent];
            const findStub = sinon.stub(eventRepository, 'find').resolves(mockActiveEvents);

            const result = await eventRepository.findActiveEvents();

            expect(findStub.calledOnce).to.be.true;
            
            const criteria = findStub.getCall(0).args[0];
            expect(criteria.status).to.equal('active');
            expect(criteria.startDate).to.have.property('$lte');
            expect(criteria.endDate).to.have.property('$gte');
            
            const options = findStub.getCall(0).args[1];
            expect(options.sort).to.deep.equal({ startDate: 1 });
            
            expect(result).to.equal(mockActiveEvents);
        });

        it('should pass through options', async () => {
            const options = { limit: 5 };
            const findStub = sinon.stub(eventRepository, 'find').resolves([]);

            await eventRepository.findActiveEvents(options);

            const passedOptions = findStub.getCall(0).args[1];
            expect(passedOptions.limit).to.equal(5);
            expect(passedOptions.sort).to.deep.equal({ startDate: 1 });
        });
    });

    describe('findUpcomingEvents', () => {
        it('should find upcoming events', async () => {
            const mockUpcomingEvents = [mockEvent];
            const findStub = sinon.stub(eventRepository, 'find').resolves(mockUpcomingEvents);

            const result = await eventRepository.findUpcomingEvents();

            expect(findStub.calledOnce).to.be.true;
            
            const criteria = findStub.getCall(0).args[0];
            expect(criteria.startDate).to.have.property('$gt');
            expect(criteria.status).to.deep.equal({ $in: ['active', 'scheduled'] });
            
            expect(result).to.equal(mockUpcomingEvents);
        });
    });

    describe('findPastEvents', () => {
        it('should find past events', async () => {
            const mockPastEvents = [mockEvent];
            const findStub = sinon.stub(eventRepository, 'find').resolves(mockPastEvents);

            const result = await eventRepository.findPastEvents();

            expect(findStub.calledOnce).to.be.true;
            
            const criteria = findStub.getCall(0).args[0];
            expect(criteria.endDate).to.have.property('$lt');
            
            const options = findStub.getCall(0).args[1];
            expect(options.sort).to.deep.equal({ endDate: -1 });
            
            expect(result).to.equal(mockPastEvents);
        });
    });

    describe('findByStatus', () => {
        it('should find events by status', async () => {
            const status = 'active';
            const mockEvents = [mockEvent];
            const findStub = sinon.stub(eventRepository, 'find').resolves(mockEvents);

            const result = await eventRepository.findByStatus(status);

            expect(findStub.calledOnce).to.be.true;
            expect(findStub.calledWith({ status })).to.be.true;
            expect(result).to.equal(mockEvents);
        });
    });

    describe('updateStatus', () => {
        it('should update event status successfully', async () => {
            const status = 'active';
            const updatedEvent = { ...mockEvent, status };
            const updateStub = sinon.stub(eventRepository, 'updateById').resolves(updatedEvent);

            const result = await eventRepository.updateStatus(eventId, status);

            expect(updateStub.calledOnce).to.be.true;
            expect(updateStub.calledWith(eventId, { status })).to.be.true;
            expect(result).to.equal(updatedEvent);
        });

        it('should set completedAt when status is completed', async () => {
            const status = 'completed';
            const updatedEvent = { ...mockEvent, status, completedAt: new Date() };
            const updateStub = sinon.stub(eventRepository, 'updateById').resolves(updatedEvent);

            await eventRepository.updateStatus(eventId, status);

            const updateData = updateStub.getCall(0).args[1];
            expect(updateData.status).to.equal('completed');
            expect(updateData.completedAt).to.be.a('date');
        });

        it('should set cancelledAt when status is cancelled', async () => {
            const status = 'cancelled';
            const updatedEvent = { ...mockEvent, status, cancelledAt: new Date() };
            const updateStub = sinon.stub(eventRepository, 'updateById').resolves(updatedEvent);

            await eventRepository.updateStatus(eventId, status);

            const updateData = updateStub.getCall(0).args[1];
            expect(updateData.status).to.equal('cancelled');
            expect(updateData.cancelledAt).to.be.a('date');
        });

        it('should throw error for invalid status', async () => {
            const invalidStatus = 'invalid';

            try {
                await eventRepository.updateStatus(eventId, invalidStatus);
                expect.fail('Should have thrown error for invalid status');
            } catch (error) {
                expect(error.message).to.include('Invalid status: invalid');
            }
        });
    });

    describe('startEvent', () => {
        it('should start an event successfully', async () => {
            const findStub = sinon.stub(eventRepository, 'findById').resolves(mockEvent);
            const updateStatusStub = sinon.stub(eventRepository, 'updateStatus').resolves({ ...mockEvent, status: 'active' });

            const result = await eventRepository.startEvent(eventId);

            expect(findStub.calledWith(eventId)).to.be.true;
            expect(updateStatusStub.calledWith(eventId, 'active')).to.be.true;
            expect(result.status).to.equal('active');
        });

        it('should throw error if event not found', async () => {
            sinon.stub(eventRepository, 'findById').resolves(null);

            try {
                await eventRepository.startEvent(eventId);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Event not found');
            }
        });

        it('should throw error if event is already active', async () => {
            const activeEvent = { ...mockEvent, status: 'active' };
            sinon.stub(eventRepository, 'findById').resolves(activeEvent);

            try {
                await eventRepository.startEvent(eventId);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Event is already active');
            }
        });

        it('should throw error if event is completed', async () => {
            const completedEvent = { ...mockEvent, status: 'completed' };
            sinon.stub(eventRepository, 'findById').resolves(completedEvent);

            try {
                await eventRepository.startEvent(eventId);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Cannot start a completed or cancelled event');
            }
        });
    });

    describe('endEvent', () => {
        it('should end an event successfully', async () => {
            const activeEvent = { ...mockEvent, status: 'active' };
            const findStub = sinon.stub(eventRepository, 'findById').resolves(activeEvent);
            const updateStatusStub = sinon.stub(eventRepository, 'updateStatus').resolves({ ...activeEvent, status: 'completed' });

            const result = await eventRepository.endEvent(eventId);

            expect(findStub.calledWith(eventId)).to.be.true;
            expect(updateStatusStub.calledWith(eventId, 'completed')).to.be.true;
            expect(result.status).to.equal('completed');
        });

        it('should throw error if event is already completed', async () => {
            const completedEvent = { ...mockEvent, status: 'completed' };
            sinon.stub(eventRepository, 'findById').resolves(completedEvent);

            try {
                await eventRepository.endEvent(eventId);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Event is already completed');
            }
        });
    });

    describe('cancelEvent', () => {
        it('should cancel an event successfully', async () => {
            const findStub = sinon.stub(eventRepository, 'findById').resolves(mockEvent);
            const updateStub = sinon.stub(eventRepository, 'updateById').resolves({ 
                ...mockEvent, 
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: 'Test reason'
            });

            const result = await eventRepository.cancelEvent(eventId, 'Test reason');

            expect(findStub.calledWith(eventId)).to.be.true;
            
            const updateData = updateStub.getCall(0).args[1];
            expect(updateData.status).to.equal('cancelled');
            expect(updateData.cancelledAt).to.be.a('date');
            expect(updateData.cancellationReason).to.equal('Test reason');
            
            expect(result.status).to.equal('cancelled');
        });

        it('should use empty string as default reason', async () => {
            const findStub = sinon.stub(eventRepository, 'findById').resolves(mockEvent);
            const updateStub = sinon.stub(eventRepository, 'updateById').resolves({ 
                ...mockEvent, 
                status: 'cancelled'
            });

            await eventRepository.cancelEvent(eventId);

            const updateData = updateStub.getCall(0).args[1];
            expect(updateData.cancellationReason).to.equal('');
        });
    });

    describe('checkVotingStatus', () => {
        it('should return can vote for active event within date range', async () => {
            const activeEvent = {
                ...mockEvent,
                status: 'active',
                startDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
                endDate: new Date(Date.now() + 60 * 60 * 1000)   // 1 hour from now
            };
            
            sinon.stub(eventRepository, 'findById').resolves(activeEvent);

            const result = await eventRepository.checkVotingStatus(eventId);

            expect(result.canVote).to.be.true;
            expect(result.reason).to.equal('Voting is open');
            expect(result.event).to.equal(activeEvent);
            expect(result.timeRemaining).to.be.a('number');
        });

        it('should return cannot vote for event not found', async () => {
            sinon.stub(eventRepository, 'findById').resolves(null);

            const result = await eventRepository.checkVotingStatus(eventId);

            expect(result.canVote).to.be.false;
            expect(result.reason).to.equal('Event not found');
        });

        it('should return cannot vote for inactive event', async () => {
            const inactiveEvent = { ...mockEvent, status: 'draft' };
            sinon.stub(eventRepository, 'findById').resolves(inactiveEvent);

            const result = await eventRepository.checkVotingStatus(eventId);

            expect(result.canVote).to.be.false;
            expect(result.reason).to.equal('Event is draft');
            expect(result.event).to.equal(inactiveEvent);
        });

        it('should return cannot vote for event not started yet', async () => {
            const futureEvent = {
                ...mockEvent,
                status: 'active',
                startDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
                endDate: new Date(Date.now() + 2 * 60 * 60 * 1000)
            };
            
            sinon.stub(eventRepository, 'findById').resolves(futureEvent);

            const result = await eventRepository.checkVotingStatus(eventId);

            expect(result.canVote).to.be.false;
            expect(result.reason).to.equal('Voting has not started yet');
            expect(result.startsIn).to.be.a('number');
        });

        it('should return cannot vote for ended event', async () => {
            const endedEvent = {
                ...mockEvent,
                status: 'active',
                startDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                endDate: new Date(Date.now() - 60 * 60 * 1000)       // 1 hour ago
            };
            
            sinon.stub(eventRepository, 'findById').resolves(endedEvent);

            const result = await eventRepository.checkVotingStatus(eventId);

            expect(result.canVote).to.be.false;
            expect(result.reason).to.equal('Voting has ended');
            expect(result.endedAgo).to.be.a('number');
        });
    });

    describe('updateEventDates', () => {
        it('should update event dates successfully', async () => {
            const findStub = sinon.stub(eventRepository, 'findById').resolves(mockEvent);
            const newStartDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
            const newEndDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
            const updatedEvent = { ...mockEvent, startDate: newStartDate, endDate: newEndDate };
            const updateStub = sinon.stub(eventRepository, 'updateById').resolves(updatedEvent);

            const result = await eventRepository.updateEventDates(eventId, newStartDate, newEndDate);

            expect(findStub.calledWith(eventId)).to.be.true;
            expect(updateStub.calledWith(eventId, {
                startDate: newStartDate,
                endDate: newEndDate
            })).to.be.true;
            expect(result).to.equal(updatedEvent);
        });

        it('should throw error if event not found', async () => {
            sinon.stub(eventRepository, 'findById').resolves(null);

            try {
                await eventRepository.updateEventDates(eventId, new Date(), new Date());
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Event not found');
            }
        });

        it('should throw error for completed event', async () => {
            const completedEvent = { ...mockEvent, status: 'completed' };
            sinon.stub(eventRepository, 'findById').resolves(completedEvent);

            try {
                await eventRepository.updateEventDates(eventId, new Date(), new Date());
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Cannot update dates for completed or cancelled events');
            }
        });

        it('should validate new dates', async () => {
            sinon.stub(eventRepository, 'findById').resolves(mockEvent);
            const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // End before start

            try {
                await eventRepository.updateEventDates(eventId, startDate, endDate);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('End date must be after start date');
            }
        });
    });

    describe('getEventsRequiringUpdates', () => {
        it('should return events that need status updates', async () => {
            const eventsNeedingUpdates = [
                {
                    ...mockEvent,
                    status: 'scheduled',
                    startDate: new Date(Date.now() - 60 * 60 * 1000), // Should be started
                    requiredAction: 'start'
                },
                {
                    ...mockEvent,
                    _id: new mongoose.Types.ObjectId(),
                    status: 'active',
                    endDate: new Date(Date.now() - 60 * 60 * 1000), // Should be ended
                    requiredAction: 'end'
                }
            ];

            const aggregateStub = sinon.stub(eventRepository, 'aggregate').resolves(eventsNeedingUpdates);

            const result = await eventRepository.getEventsRequiringUpdates();

            expect(aggregateStub.calledOnce).to.be.true;
            expect(result).to.equal(eventsNeedingUpdates);
        });
    });

    describe('_validateEventDates', () => {
        it('should throw error for end date before start date', () => {
            const eventData = {
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
            };

            expect(() => eventRepository._validateEventDates(eventData))
                .to.throw('End date must be after start date');
        });

        it('should not throw error for valid dates', () => {
            const eventData = {
                startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };

            expect(() => eventRepository._validateEventDates(eventData))
                .to.not.throw();
        });

        it('should handle missing dates gracefully', () => {
            expect(() => eventRepository._validateEventDates({})).to.not.throw();
            expect(() => eventRepository._validateEventDates({ startDate: new Date() })).to.not.throw();
            expect(() => eventRepository._validateEventDates({ endDate: new Date() })).to.not.throw();
        });
    });
});