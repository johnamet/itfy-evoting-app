#!/usr/bin/env node

/**
 * Activity Repository Test Suite
 * 
 * Comprehensive tests for ActivityRepository including activity logging,
 * user activity tracking, site visit analytics, and audit trail management.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import ActivityRepository from '../../repositories/ActivityRepository.js';

describe('ActivityRepository', () => {
    let activityRepository;
    let mockActivity;
    let mockUser;
    let mockCandidate;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        activityRepository = new ActivityRepository();
        
        // Mock IDs
        mockUser = new mongoose.Types.ObjectId();
        mockCandidate = new mongoose.Types.ObjectId();
        
        // Mock activity data
        mockActivity = {
            _id: new mongoose.Types.ObjectId(),
            user: mockUser,
            action: 'create',
            targetType: 'candidate',
            targetId: mockCandidate,
            timestamp: new Date()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('logActivity', () => {
        it('should successfully log an activity', async () => {
            const activityData = {
                user: mockUser,
                action: 'create',
                targetType: 'candidate',
                targetId: mockCandidate
            };

            const validateStub = sandbox.stub(activityRepository, 'validateActivityData').resolves(true);
            const createStub = sandbox.stub(activityRepository, 'create').resolves(mockActivity);

            const result = await activityRepository.logActivity(activityData);

            expect(result).to.deep.equal(mockActivity);
            expect(validateStub.calledWith(activityData)).to.be.true;
            expect(createStub.called).to.be.true;
        });

        it('should add timestamp if not provided', async () => {
            const activityData = {
                user: mockUser,
                action: 'create',
                targetType: 'candidate',
                targetId: mockCandidate
            };

            sandbox.stub(activityRepository, 'validateActivityData').resolves(true);
            const createStub = sandbox.stub(activityRepository, 'create').resolves(mockActivity);

            await activityRepository.logActivity(activityData);

            const createCallArgs = createStub.getCall(0).args[0];
            expect(createCallArgs).to.have.property('timestamp');
            expect(createCallArgs.timestamp).to.be.instanceOf(Date);
        });

        it('should handle validation errors', async () => {
            const activityData = {
                user: mockUser,
                action: 'invalid_action',
                targetType: 'candidate',
                targetId: mockCandidate
            };

            const validationError = new Error('Invalid action');
            sandbox.stub(activityRepository, 'validateActivityData').rejects(validationError);
            sandbox.stub(activityRepository, '_handleError').returns(validationError);

            try {
                await activityRepository.logActivity(activityData);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.equal(validationError);
            }
        });
    });

    describe('getActivitiesByUser', () => {
        it('should retrieve activities for a specific user', async () => {
            const expectedActivities = [mockActivity];
            const findStub = sandbox.stub(activityRepository, 'find').resolves(expectedActivities);

            const result = await activityRepository.getActivitiesByUser(mockUser);

            expect(result).to.deep.equal(expectedActivities);
            expect(findStub.calledWith(
                { user: mockUser },
                {
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            )).to.be.true;
        });

        it('should handle options parameter', async () => {
            const options = { limit: 10 };
            const findStub = sandbox.stub(activityRepository, 'find').resolves([]);

            await activityRepository.getActivitiesByUser(mockUser, options);

            expect(findStub.calledWith(
                { user: mockUser },
                {
                    ...options,
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            )).to.be.true;
        });
    });

    describe('getActivitiesByAction', () => {
        it('should retrieve activities by action type', async () => {
            const expectedActivities = [mockActivity];
            const findStub = sandbox.stub(activityRepository, 'find').resolves(expectedActivities);

            const result = await activityRepository.getActivitiesByAction('create');

            expect(result).to.deep.equal(expectedActivities);
            expect(findStub.calledWith(
                { action: 'create' },
                {
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });
    });

    describe('getActivitiesByTargetType', () => {
        it('should retrieve activities by target type', async () => {
            const expectedActivities = [mockActivity];
            const findStub = sandbox.stub(activityRepository, 'find').resolves(expectedActivities);

            const result = await activityRepository.getActivitiesByTargetType('candidate');

            expect(result).to.deep.equal(expectedActivities);
            expect(findStub.calledWith(
                { targetType: 'candidate' },
                {
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });
    });

    describe('getActivitiesForTarget', () => {
        it('should retrieve activities for a specific target', async () => {
            const expectedActivities = [mockActivity];
            const findStub = sandbox.stub(activityRepository, 'find').resolves(expectedActivities);

            const result = await activityRepository.getActivitiesForTarget('candidate', mockCandidate);

            expect(result).to.deep.equal(expectedActivities);
            expect(findStub.calledWith(
                { targetType: 'candidate', targetId: mockCandidate },
                {
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });
    });

    describe('getActivitiesByDateRange', () => {
        it('should retrieve activities within date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');
            const expectedActivities = [mockActivity];
            const findStub = sandbox.stub(activityRepository, 'find').resolves(expectedActivities);

            const result = await activityRepository.getActivitiesByDateRange(startDate, endDate);

            expect(result).to.deep.equal(expectedActivities);
            expect(findStub.calledWith(
                {
                    timestamp: {
                        $gte: startDate,
                        $lte: endDate
                    }
                },
                {
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });
    });

    describe('getRecentActivities', () => {
        it('should retrieve recent activities with default limit', async () => {
            const expectedActivities = [mockActivity];
            const findStub = sandbox.stub(activityRepository, 'find').resolves(expectedActivities);

            const result = await activityRepository.getRecentActivities();

            expect(result).to.deep.equal(expectedActivities);
            expect(findStub.calledWith(
                {},
                {
                    limit: 50,
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });

        it('should retrieve recent activities with custom limit and filter', async () => {
            const filter = { action: 'create' };
            const limit = 10;
            const findStub = sandbox.stub(activityRepository, 'find').resolves([]);

            await activityRepository.getRecentActivities(limit, filter);

            expect(findStub.calledWith(
                filter,
                {
                    limit: limit,
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });
    });

    describe('getActivityStatistics', () => {
        it('should return comprehensive activity statistics', async () => {
            const mockGeneralStats = {
                totalActivities: 100,
                uniqueUsersCount: 25,
                earliestActivity: new Date('2024-01-01'),
                latestActivity: new Date('2024-01-31')
            };

            const mockActionStats = [
                { _id: 'create', count: 50 },
                { _id: 'view', count: 30 },
                { _id: 'update', count: 20 }
            ];

            const mockTargetTypeStats = [
                { _id: 'candidate', count: 60 },
                { _id: 'event', count: 40 }
            ];

            const aggregateStub = sandbox.stub(activityRepository, 'aggregate');
            aggregateStub.onCall(0).resolves([mockGeneralStats]);
            aggregateStub.onCall(1).resolves(mockActionStats);
            aggregateStub.onCall(2).resolves(mockTargetTypeStats);

            const result = await activityRepository.getActivityStatistics();

            expect(result).to.deep.equal({
                ...mockGeneralStats,
                actionBreakdown: mockActionStats,
                targetTypeBreakdown: mockTargetTypeStats
            });
            expect(aggregateStub.called).to.be.trueThrice;
        });

        it('should handle empty statistics gracefully', async () => {
            const aggregateStub = sandbox.stub(activityRepository, 'aggregate');
            aggregateStub.onCall(0).resolves([]);
            aggregateStub.onCall(1).resolves([]);
            aggregateStub.onCall(2).resolves([]);

            const result = await activityRepository.getActivityStatistics();

            expect(result).to.have.property('totalActivities', 0);
            expect(result).to.have.property('uniqueUsersCount', 0);
            expect(result).to.have.property('actionBreakdown');
            expect(result).to.have.property('targetTypeBreakdown');
        });
    });

    describe('getUserActivitySummary', () => {
        it('should return user activity summary', async () => {
            const mockSummary = {
                totalActivities: 25,
                firstActivity: new Date('2024-01-01'),
                lastActivity: new Date('2024-01-31')
            };

            const mockActionBreakdown = [
                { _id: 'create', count: 15 },
                { _id: 'view', count: 10 }
            ];

            const mockTargetTypeBreakdown = [
                { _id: 'candidate', count: 20 },
                { _id: 'event', count: 5 }
            ];

            const aggregateStub = sandbox.stub(activityRepository, 'aggregate');
            aggregateStub.onCall(0).resolves([mockSummary]);
            aggregateStub.onCall(1).resolves(mockActionBreakdown);
            aggregateStub.onCall(2).resolves(mockTargetTypeBreakdown);

            const result = await activityRepository.getUserActivitySummary(mockUser);

            expect(result).to.deep.equal({
                userId: mockUser,
                ...mockSummary,
                actionBreakdown: mockActionBreakdown,
                targetTypeBreakdown: mockTargetTypeBreakdown
            });
        });
    });

    describe('getActivitiesWithPagination', () => {
        it('should return paginated activities', async () => {
            const mockActivities = [mockActivity];
            const mockTotal = 100;

            const findStub = sandbox.stub(activityRepository, 'find').resolves(mockActivities);
            const countStub = sandbox.stub(activityRepository, 'countDocuments').resolves(mockTotal);

            const result = await activityRepository.getActivitiesWithPagination(1, 20);

            expect(result).to.have.property('activities', mockActivities);
            expect(result).to.have.property('pagination');
            expect(result.pagination).to.deep.equal({
                currentPage: 1,
                totalPages: 5,
                totalItems: 100,
                itemsPerPage: 20,
                hasNextPage: true,
                hasPrevPage: false
            });

            expect(findStub.calledWith(
                {},
                {
                    skip: 0,
                    limit: 20,
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
            expect(countStub.calledWith({})).to.be.true;
        });

        it('should handle different page numbers correctly', async () => {
            const findStub = sandbox.stub(activityRepository, 'find').resolves([]);
            const countStub = sandbox.stub(activityRepository, 'countDocuments').resolves(100);

            await activityRepository.getActivitiesWithPagination(3, 20);

            expect(findStub.calledWith(
                {},
                {
                    skip: 40, // (3-1) * 20
                    limit: 20,
                    populate: [{ path: 'user', select: 'name email' }],
                    sort: { timestamp: -1 }
                }
            );
        });
    });

    describe('deleteOldActivities', () => {
        it('should delete activities older than specified date', async () => {
            const olderThan = new Date('2024-01-01');
            const mockResult = { deletedCount: 50 };

            const deleteManyStub = sandbox.stub(activityRepository, 'deleteMany').resolves(mockResult);

            const result = await activityRepository.deleteOldActivities(olderThan);

            expect(result).to.deep.equal({
                deletedCount: 50,
                deletedBefore: olderThan
            });
            expect(deleteManyStub.calledWith({
                timestamp: { $lt: olderThan }
            });
        });
    });

    describe('getUserActivityTimeline', () => {
        it('should return user activity timeline', async () => {
            const mockTimeline = [
                {
                    date: '2024-01-31',
                    activities: [
                        {
                            action: 'create',
                            targetType: 'candidate',
                            targetId: mockCandidate,
                            timestamp: new Date('2024-01-31T10:00:00Z')
                        }
                    ],
                    count: 1
                }
            ];

            const aggregateStub = sandbox.stub(activityRepository, 'aggregate').resolves(mockTimeline);

            const result = await activityRepository.getUserActivityTimeline(mockUser, 30);

            expect(result).to.deep.equal(mockTimeline);
            expect(aggregateStub.called).to.be.true;
        });
    });

    describe('validateActivityData', () => {
        it('should validate correct activity data', async () => {
            const validData = {
                user: mockUser,
                action: 'create',
                targetType: 'candidate',
                targetId: mockCandidate,
                timestamp: new Date()
            };

            const result = await activityRepository.validateActivityData(validData);
            expect(result).to.be.true;
        });

        it('should reject data without user for non-site-visit activities', async () => {
            const invalidData = {
                action: 'create',
                targetType: 'candidate',
                targetId: mockCandidate
            };

            try {
                await activityRepository.validateActivityData(invalidData);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('User ID is required for non-site-visit activities');
            }
        });

        it('should allow site visits without user', async () => {
            const siteVisitData = {
                action: 'site_visit',
                targetType: 'site',
                targetId: 'site_visit_2024-01-01'
            };

            const result = await activityRepository.validateActivityData(siteVisitData);
            expect(result).to.be.true;
        });

        it('should reject invalid action', async () => {
            const invalidData = {
                user: mockUser,
                action: 'invalid_action',
                targetType: 'candidate',
                targetId: mockCandidate
            };

            try {
                await activityRepository.validateActivityData(invalidData);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Action must be one of');
            }
        });

        it('should reject invalid target type', async () => {
            const invalidData = {
                user: mockUser,
                action: 'create',
                targetType: 'invalid_type',
                targetId: mockCandidate
            };

            try {
                await activityRepository.validateActivityData(invalidData);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Target type must be one of');
            }
        });

        it('should reject data without target ID', async () => {
            const invalidData = {
                user: mockUser,
                action: 'create',
                targetType: 'candidate'
            };

            try {
                await activityRepository.validateActivityData(invalidData);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Target ID is required');
            }
        });

        it('should validate site visits structure', async () => {
            const validSiteVisitData = {
                action: 'site_visit',
                targetType: 'site',
                targetId: 'site_visit_2024-01-01',
                siteVisits: {
                    totalVisits: 5,
                    date: '2024-01-01'
                }
            };

            const result = await activityRepository.validateActivityData(validSiteVisitData);
            expect(result).to.be.true;
        });

        it('should reject invalid site visits structure', async () => {
            const invalidSiteVisitData = {
                action: 'site_visit',
                targetType: 'site',
                targetId: 'site_visit_2024-01-01',
                siteVisits: 'invalid_structure'
            };

            try {
                await activityRepository.validateActivityData(invalidSiteVisitData);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Site visits data must be an object');
            }
        });
    });

    describe('bulkLogActivities', () => {
        it('should successfully log multiple activities', async () => {
            const activitiesData = [
                {
                    user: mockUser,
                    action: 'create',
                    targetType: 'candidate',
                    targetId: mockCandidate
                },
                {
                    user: mockUser,
                    action: 'view',
                    targetType: 'event',
                    targetId: new mongoose.Types.ObjectId()
                }
            ];

            const logActivityStub = sandbox.stub(activityRepository, 'logActivity');
            logActivityStub.onCall(0).resolves(mockActivity);
            logActivityStub.onCall(1).resolves({ ...mockActivity, action: 'view' });

            const result = await activityRepository.bulkLogActivities(activitiesData);

            expect(result).to.have.property('success');
            expect(result).to.have.property('errors');
            expect(result.successCount).to.equal(2);
            expect(result.errorCount).to.equal(0);
            expect(logActivityStub.called).to.be.trueTwice;
        });

        it('should handle mixed success and errors', async () => {
            const activitiesData = [
                {
                    user: mockUser,
                    action: 'create',
                    targetType: 'candidate',
                    targetId: mockCandidate
                },
                {
                    action: 'invalid_action',
                    targetType: 'candidate',
                    targetId: mockCandidate
                }
            ];

            const logActivityStub = sandbox.stub(activityRepository, 'logActivity');
            logActivityStub.onCall(0).resolves(mockActivity);
            logActivityStub.onCall(1).rejects(new Error('Validation error'));

            const result = await activityRepository.bulkLogActivities(activitiesData);

            expect(result.successCount).to.equal(1);
            expect(result.errorCount).to.equal(1);
            expect(result.errors).to.have.length(1);
            expect(result.errors[0]).to.have.property('error', 'Validation error');
        });
    });

    describe('getMostActiveUsers', () => {
        it('should return most active users', async () => {
            const mockActiveUsers = [
                {
                    userId: mockUser,
                    user: { name: 'John Doe', email: 'john@example.com' },
                    activityCount: 50,
                    lastActivity: new Date(),
                    uniqueActions: 3
                }
            ];

            const aggregateStub = sandbox.stub(activityRepository, 'aggregate').resolves(mockActiveUsers);

            const result = await activityRepository.getMostActiveUsers(10);

            expect(result).to.deep.equal(mockActiveUsers);
            expect(aggregateStub.called).to.be.true;
        });

        it('should respect limit parameter', async () => {
            const aggregateStub = sandbox.stub(activityRepository, 'aggregate').resolves([]);

            await activityRepository.getMostActiveUsers(5);

            const aggregateCall = aggregateStub.getCall(0);
            const pipeline = aggregateCall.args[0];
            const limitStage = pipeline.find(stage => stage.$limit);
            expect(limitStage.$limit).to.equal(5);
        });
    });

    // Site Visit Tracking Tests
    describe('Site Visit Tracking', () => {
        let mockDate;
        let clock;

        beforeEach(() => {
            mockDate = new Date('2024-01-15T14:30:00Z');
            clock = sinon.useFakeTimers(mockDate.getTime());
        });

        afterEach(() => {
            clock.restore();
        });

        describe('trackSiteVisit', () => {
            it('should create new site visit document when none exists', async () => {
                const findOneStub = sandbox.stub(activityRepository.model, 'findOne').resolves(null);
                const createStub = sandbox.stub(activityRepository.model, 'create').resolves({
                    _id: new mongoose.Types.ObjectId(),
                    siteVisits: {
                        date: '2024-01-15',
                        totalVisits: 1,
                        pages: { homepage: 1 },
                        hourly: { 14: 1 },
                        users: [mockUser],
                        anonymousVisits: 0,
                        lastUpdated: mockDate,
                        metadata: [{ ip: '127.0.0.1' }]
                    }
                });

                const result = await activityRepository.trackSiteVisit(mockUser, 'homepage', { ip: '127.0.0.1' });

                expect(result.success).to.be.true;
                expect(result.isUpdate).to.be.false;
                expect(findOneStub.called).to.be.true;
                expect(createStub.called).to.be.true;
            });

            it('should update existing site visit document', async () => {
                const existingDoc = {
                    siteVisits: {
                        date: '2024-01-15',
                        totalVisits: 5,
                        pages: { homepage: 3, about: 2 },
                        hourly: { 10: 2, 12: 3 },
                        users: [new mongoose.Types.ObjectId()],
                        anonymousVisits: 1,
                        lastUpdated: new Date('2024-01-15T10:00:00Z'),
                        metadata: []
                    }
                };

                const updatedDoc = {
                    _id: new mongoose.Types.ObjectId(),
                    siteVisits: {
                        ...existingDoc.siteVisits,
                        totalVisits: 6,
                        pages: { ...existingDoc.siteVisits.pages, homepage: 4 },
                        hourly: { ...existingDoc.siteVisits.hourly, 14: 1 },
                        users: [...existingDoc.siteVisits.users, mockUser],
                        lastUpdated: mockDate
                    }
                };

                const findOneStub = sandbox.stub(activityRepository.model, 'findOne').resolves(existingDoc);
                const findOneAndUpdateStub = sandbox.stub(activityRepository.model, 'findOneAndUpdate').resolves(updatedDoc);

                const result = await activityRepository.trackSiteVisit(mockUser, 'homepage');

                expect(result.success).to.be.true;
                expect(result.isUpdate).to.be.true;
                expect(findOneStub.called).to.be.true;
                expect(findOneAndUpdateStub.called).to.be.true;
            });

            it('should handle anonymous visits', async () => {
                const findOneStub = sandbox.stub(activityRepository.model, 'findOne').resolves(null);
                const createStub = sandbox.stub(activityRepository.model, 'create').resolves({
                    _id: new mongoose.Types.ObjectId(),
                    siteVisits: {
                        date: '2024-01-15',
                        totalVisits: 1,
                        pages: { about: 1 },
                        hourly: { 14: 1 },
                        users: [],
                        anonymousVisits: 1,
                        lastUpdated: mockDate,
                        metadata: []
                    }
                });

                const result = await activityRepository.trackSiteVisit(null, 'about');

                expect(result.success).to.be.true;
                expect(result.isUpdate).to.be.false;
                expect(createStub.called).to.be.true;
            });
        });

        describe('getSiteVisitStatistics', () => {
            it('should return today\'s statistics', async () => {
                const mockStats = {
                    totalVisits: 100,
                    totalUniqueUsers: 25,
                    totalAnonymousVisits: 10,
                    dateRange: {
                        from: new Date('2024-01-15T00:00:00Z'),
                        to: new Date('2024-01-16T00:00:00Z'),
                        period: 'today'
                    }
                };

                const mockPageStats = [
                    { _id: 'homepage', visits: 60 },
                    { _id: 'about', visits: 40 }
                ];

                const aggregateStub = sandbox.stub(activityRepository, 'aggregate');
                aggregateStub.onCall(0).resolves([mockStats]);
                aggregateStub.onCall(1).resolves(mockPageStats);

                const result = await activityRepository.getSiteVisitStatistics('today');

                expect(result).to.have.property('totalVisits', 100);
                expect(result).to.have.property('totalUniqueUsers', 25);
                expect(result).to.have.property('pageBreakdown');
                expect(result.pageBreakdown).to.have.length(2);
                expect(result.pageBreakdown[0]).to.deep.equal({ page: 'homepage', visits: 60 });
            });

            it('should handle different date ranges', async () => {
                const aggregateStub = sandbox.stub(activityRepository, 'aggregate');
                aggregateStub.onCall(0).resolves([]);
                aggregateStub.onCall(1).resolves([]);

                await activityRepository.getSiteVisitStatistics('week');

                const matchStage = aggregateStub.getCall(0).args[0][0].$match;
                expect(matchStage.timestamp.$gte).to.be.instanceOf(Date);
                expect(matchStage.timestamp.$lt).to.be.instanceOf(Date);
            });

            it('should return default values when no data exists', async () => {
                const aggregateStub = sandbox.stub(activityRepository, 'aggregate');
                aggregateStub.onCall(0).resolves([]);
                aggregateStub.onCall(1).resolves([]);

                const result = await activityRepository.getSiteVisitStatistics('today');

                expect(result).to.have.property('totalVisits', 0);
                expect(result).to.have.property('totalUniqueUsers', 0);
                expect(result).to.have.property('totalAnonymousVisits', 0);
                expect(result).to.have.property('pageBreakdown');
                expect(result.pageBreakdown).to.be.an('array').that.is.empty;
            });
        });

        describe('getHourlyVisitPattern', () => {
            it('should return hourly pattern for existing data', async () => {
                const mockSiteVisit = {
                    siteVisits: {
                        date: '2024-01-15',
                        hourly: {
                            9: 5,
                            10: 8,
                            14: 12,
                            16: 3
                        }
                    }
                };

                const findOneStub = sandbox.stub(activityRepository.model, 'findOne').resolves(mockSiteVisit);

                const result = await activityRepository.getHourlyVisitPattern();

                expect(result).to.be.an('array').with.length(24);
                expect(result[9]).to.deep.equal({ hour: 9, visits: 5 });
                expect(result[10]).to.deep.equal({ hour: 10, visits: 8 });
                expect(result[14]).to.deep.equal({ hour: 14, visits: 12 });
                expect(result[0]).to.deep.equal({ hour: 0, visits: 0 });
                expect(findOneStub.called).to.be.true;
            });

            it('should return zero pattern when no data exists', async () => {
                const findOneStub = sandbox.stub(activityRepository.model, 'findOne').resolves(null);

                const result = await activityRepository.getHourlyVisitPattern();

                expect(result).to.be.an('array').with.length(24);
                result.forEach((hourData, index) => {
                    expect(hourData).to.deep.equal({ hour: index, visits: 0 });
                });
                expect(findOneStub.called).to.be.true;
            });

            it('should handle specific date parameter', async () => {
                const specificDate = new Date('2024-01-10');
                const findOneStub = sandbox.stub(activityRepository.model, 'findOne').resolves(null);

                await activityRepository.getHourlyVisitPattern(specificDate);

                const findCall = findOneStub.getCall(0);
                expect(findCall.args[0]).to.have.property('siteVisits.date', '2024-01-10');
            });
        });

        describe('cleanupSiteVisitMetadata', () => {
            it('should clean up old metadata from site visit documents', async () => {
                const mockDocs = [
                    {
                        _id: new mongoose.Types.ObjectId(),
                        siteVisits: {
                            metadata: new Array(150).fill({ ip: '127.0.0.1', timestamp: new Date() })
                        }
                    },
                    {
                        _id: new mongoose.Types.ObjectId(),
                        siteVisits: {
                            metadata: new Array(50).fill({ ip: '192.168.1.1', timestamp: new Date() })
                        }
                    }
                ];

                const findStub = sandbox.stub(activityRepository.model, 'find').resolves(mockDocs);
                const updateOneStub = sandbox.stub(activityRepository.model, 'updateOne').resolves();

                const result = await activityRepository.cleanupSiteVisitMetadata(100);

                expect(result.cleanedDocuments).to.equal(1);
                expect(result.maxMetadataEntries).to.equal(100);
                expect(findStub.called).to.be.true;
                expect(updateOneStub.called).to.be.trueOnce;
            });

            it('should not clean documents with metadata under limit', async () => {
                const mockDocs = [
                    {
                        _id: new mongoose.Types.ObjectId(),
                        siteVisits: {
                            metadata: new Array(50).fill({ ip: '127.0.0.1', timestamp: new Date() })
                        }
                    }
                ];

                const findStub = sandbox.stub(activityRepository.model, 'find').resolves(mockDocs);
                const updateOneStub = sandbox.stub(activityRepository.model, 'updateOne').resolves();

                const result = await activityRepository.cleanupSiteVisitMetadata(100);

                expect(result.cleanedDocuments).to.equal(0);
                expect(updateOneStub).to.not.have.been.called;
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors', async () => {
            const dbError = new Error('Database connection failed');
            sandbox.stub(activityRepository, 'find').rejects(dbError);
            sandbox.stub(activityRepository, '_handleError').returns(dbError);

            try {
                await activityRepository.getActivitiesByUser(mockUser);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.equal(dbError);
            }
        });

        it('should handle validation errors in logActivity', async () => {
            const validationError = new Error('Invalid activity data');
            sandbox.stub(activityRepository, 'validateActivityData').rejects(validationError);
            sandbox.stub(activityRepository, '_handleError').returns(validationError);

            try {
                await activityRepository.logActivity({});
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.equal(validationError);
            }
        });

        it('should handle aggregation pipeline errors', async () => {
            const aggregationError = new Error('Aggregation pipeline failed');
            sandbox.stub(activityRepository, 'aggregate').rejects(aggregationError);
            sandbox.stub(activityRepository, '_handleError').returns(aggregationError);

            try {
                await activityRepository.getActivityStatistics();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.equal(aggregationError);
            }
        });
    });
});
