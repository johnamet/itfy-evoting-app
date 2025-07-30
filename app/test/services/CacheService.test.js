#!/usr/bin/env node
/**
 * CacheService Tests
 * 
 * Unit tests for the CacheService class
 */

import { expect } from 'chai';
import sinon from 'sinon';
import CacheService from '../../services/CacheService.js';
import { mainCache, userCache, eventCache }  from '../../utils/engine/cache.js';



describe('CacheService', () => {
    let mainCacheStub;
    let userCacheStub;
    let eventCacheStub;

    beforeEach(() => {
        // Create stubs for cache instances
        mainCacheStub = {
            set: sinon.stub(),
            get: sinon.stub(),
            delete: sinon.stub(),
            keys: sinon.stub(),
            clear: sinon.stub(),
            increment: sinon.stub(),
            size: sinon.stub(),
            getStats: sinon.stub()
        };

        userCacheStub = {
            set: sinon.stub(),
            get: sinon.stub(),
            delete: sinon.stub(),
            keys: sinon.stub(),
            clear: sinon.stub(),
            size: sinon.stub(),
            getStats: sinon.stub()
        };

        eventCacheStub = {
            set: sinon.stub(),
            get: sinon.stub(),
            delete: sinon.stub(),
            keys: sinon.stub(),
            clear: sinon.stub(),
            size: sinon.stub(),
            getStats: sinon.stub()
        };

        // Replace the actual cache instances with stubs
        sinon.stub(CacheService, '_getMainCache').returns(mainCacheStub);
        sinon.stub(CacheService, '_getUserCache').returns(userCacheStub);
        sinon.stub(CacheService, '_getEventCache').returns(eventCacheStub);
      
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('cacheUser', () => {
        it('should cache user data successfully', () => {
            const userId = '507f1f77bcf86cd799439011';
            const userData = { id: userId, name: 'John Doe', email: 'john@example.com' };
            const ttl = 3600000;

            userCacheStub.set.returns(true);

            const result = CacheService.cacheUser(userId, userData, ttl);

            expect(result).to.be.true;
            expect(userCacheStub.set.calledOnce).to.be.true;
            expect(userCacheStub.set.calledWith(userId, userData, ttl)).to.be.true;
        });
    });

    describe('getUser', () => {
        it('should retrieve cached user data', () => {
            const userId = '507f1f77bcf86cd799439011';
            const userData = { id: userId, name: 'John Doe' };

            userCacheStub.get.returns(userData);

            const result = CacheService.getUser(userId);

            expect(result).to.deep.equal(userData);
            expect(userCacheStub.get.calledOnce).to.be.true;
            expect(userCacheStub.get.calledWith(`user:${userId}`)).to.be.true;
        });

        it('should return null if user not cached', () => {
            const userId = '507f1f77bcf86cd799439011';

            userCacheStub.get.returns(null);

            const result = CacheService.getUser(userId);

            expect(result).to.be.null;
        });
    });

    describe('invalidateUser', () => {
        it('should invalidate user cache entries', () => {
            const userId = '507f1f77bcf86cd799439011';
            const cacheKeys = [
                `user:${userId}`,
                `user:${userId}:profile`,
                `user:${userId}:settings`,
                'user:other:data'
            ];

            userCacheStub.keys.returns(cacheKeys);
            userCacheStub.delete.returns(true);

            const result = CacheService.invalidateUser(userId);

            expect(result).to.be.true;
            expect(userCacheStub.delete.callCount).to.equal(3); // Should delete 3 matching keys
        });
    });

    describe('cacheEvent', () => {
        it('should cache event data successfully', () => {
            const eventId = '507f1f77bcf86cd799439011';
            const eventData = { id: eventId, name: 'Test Event', status: 'active' };

            eventCacheStub.set.returns(true);

            const result = CacheService.cacheEvent(eventId, eventData);

            expect(result).to.be.true;
            expect(eventCacheStub.set.calledOnce).to.be.true;
            expect(eventCacheStub.set.calledWith(`event:${eventId}`, eventData)).to.be.true;
        });
    });

    describe('getEvent', () => {
        it('should retrieve cached event data', () => {
            const eventId = '507f1f77bcf86cd799439011';
            const eventData = { id: eventId, name: 'Test Event' };

            eventCacheStub.get.returns(eventData);

            const result = CacheService.getEvent(eventId);

            expect(result).to.deep.equal(eventData);
            expect(eventCacheStub.get.calledWith(`event:${eventId}`)).to.be.true;
        });
    });

    describe('invalidateEvent', () => {
        it('should invalidate event cache entries across all caches', () => {
            const eventId = '507f1f77bcf86cd799439011';
            
            // Setup mock keys for each cache
            mainCacheStub.keys.returns(['api:events', `vote_count:${eventId}`]);
            userCacheStub.keys.returns([`user:123:event:${eventId}`]);
            eventCacheStub.keys.returns([`event:${eventId}`, `candidates:${eventId}`]);

            mainCacheStub.delete.returns(true);
            userCacheStub.delete.returns(true);
            eventCacheStub.delete.returns(true);

            const result = CacheService.invalidateEvent(eventId);

            expect(result).to.be.true;
            expect(mainCacheStub.delete.calledOnce).to.be.true;
            expect(userCacheStub.delete.calledOnce).to.be.true;
            expect(eventCacheStub.delete.calledTwice).to.be.true;
        });
    });

    describe('cacheVotingSession', () => {
        it('should cache voting session data', () => {
            const sessionId = 'session123';
            const sessionData = { userId: '123', eventId: '456', timestamp: new Date() };

            mainCacheStub.set.returns(true);

            const result = CacheService.cacheVotingSession(sessionId, sessionData);

            expect(result).to.be.true;
            expect(mainCacheStub.set.calledWith(`voting_session:${sessionId}`, sessionData)).to.be.true;
        });
    });

    describe('getVotingSession', () => {
        it('should retrieve voting session data', () => {
            const sessionId = 'session123';
            const sessionData = { userId: '123', eventId: '456' };

            mainCacheStub.get.returns(sessionData);

            const result = CacheService.getVotingSession(sessionId);

            expect(result).to.deep.equal(sessionData);
            expect(mainCacheStub.get.calledWith(`voting_session:${sessionId}`)).to.be.true;
        });
    });

    describe('cacheVoteCount', () => {
        it('should cache vote count data', () => {
            const eventId = '507f1f77bcf86cd799439011';
            const voteData = { total: 100, byCandidate: { 'cand1': 60, 'cand2': 40 } };

            eventCacheStub.set.returns(true);

            const result = CacheService.cacheVoteCount(eventId, voteData);

            expect(result).to.be.true;
            expect(eventCacheStub.set.calledWith(`vote_count:${eventId}`, voteData)).to.be.true;
        });
    });

    describe('getVoteCount', () => {
        it('should retrieve vote count data', () => {
            const eventId = '507f1f77bcf86cd799439011';
            const voteData = { total: 100 };

            eventCacheStub.get.returns(voteData);

            const result = CacheService.getVoteCount(eventId);

            expect(result).to.deep.equal(voteData);
        });
    });

    describe('cacheCandidates', () => {
        it('should cache candidates array', () => {
            const eventId = '507f1f77bcf86cd799439011';
            const candidates = [
                { id: '1', name: 'Candidate 1' },
                { id: '2', name: 'Candidate 2' }
            ];

            eventCacheStub.set.returns(true);

            const result = CacheService.cacheCandidates(eventId, candidates);

            expect(result).to.be.true;
            expect(eventCacheStub.set.calledWith(`candidates:${eventId}`, candidates)).to.be.true;
        });
    });

    describe('getCandidates', () => {
        it('should retrieve candidates array', () => {
            const eventId = '507f1f77bcf86cd799439011';
            const candidates = [{ id: '1', name: 'Candidate 1' }];

            eventCacheStub.get.returns(candidates);

            const result = CacheService.getCandidates(eventId);

            expect(result).to.deep.equal(candidates);
        });
    });

    describe('cacheAuthToken', () => {
        it('should cache authentication token', () => {
            const token = 'jwt-token-123';
            const userData = { id: '123', email: 'user@example.com' };

            userCacheStub.set.returns(true);

            const result = CacheService.cacheAuthToken(token, userData);

            expect(result).to.be.true;
            expect(userCacheStub.set.calledWith(`auth:${token}`, userData)).to.be.true;
        });
    });

    describe('getAuthToken', () => {
        it('should retrieve auth token data', () => {
            const token = 'jwt-token-123';
            const userData = { id: '123', email: 'user@example.com' };

            userCacheStub.get.returns(userData);

            const result = CacheService.getAuthToken(token);

            expect(result).to.deep.equal(userData);
        });
    });

    describe('invalidateAuthToken', () => {
        it('should invalidate auth token', () => {
            const token = 'jwt-token-123';

            userCacheStub.delete.returns(true);

            const result = CacheService.invalidateAuthToken(token);

            expect(result).to.be.true;
            expect(userCacheStub.delete.calledWith(`auth:${token}`)).to.be.true;
        });
    });

    describe('incrementCounter', () => {
        it('should increment counter value', () => {
            const counterName = 'api_requests';
            const incrementBy = 1;

            mainCacheStub.increment.returns(5);

            const result = CacheService.incrementCounter(counterName, incrementBy);

            expect(result).to.equal(5);
            expect(mainCacheStub.increment.calledWith(`counter:${counterName}`, incrementBy)).to.be.true;
        });
    });

    describe('getCounter', () => {
        it('should get counter value', () => {
            const counterName = 'api_requests';

            mainCacheStub.get.returns(10);

            const result = CacheService.getCounter(counterName);

            expect(result).to.equal(10);
            expect(mainCacheStub.get.calledWith(`counter:${counterName}`)).to.be.true;
        });

        it('should return 0 if counter not found', () => {
            const counterName = 'api_requests';

            mainCacheStub.get.returns(null);

            const result = CacheService.getCounter(counterName);

            expect(result).to.equal(0);
        });
    });

    describe('set and get with serialization', () => {
        it('should serialize and cache data', () => {
            const key = 'test-key';
            const data = { name: 'Test', value: 123 };

            mainCacheStub.set.returns(true);

            const result = CacheService.set(key, data);

            expect(result).to.be.true;
            expect(mainCacheStub.set.calledOnce).to.be.true;
            
            const serializedData = mainCacheStub.set.getCall(0).args[1];
            expect(JSON.parse(serializedData)).to.deep.equal(data);
        });

        it('should deserialize and return cached data', () => {
            const key = 'test-key';
            const data = { name: 'Test', value: 123 };
            const serializedData = JSON.stringify(data);

            mainCacheStub.get.returns(serializedData);

            const result = CacheService.get(key);

            expect(result).to.deep.equal(data);
        });

        it('should handle serialization errors', () => {
            const key = 'test-key';
            const circularData = {};
            circularData.self = circularData; // Create circular reference

            const result = CacheService.set(key, circularData);

            expect(result).to.be.false;
        });

        it('should handle deserialization errors', () => {
            const key = 'test-key';

            mainCacheStub.get.returns('invalid-json');

            const result = CacheService.get(key);

            expect(result).to.be.null;
        });
    });

    describe('getStats', () => {
        it('should return combined cache statistics', () => {
            const mainStats = { hits: 10, misses: 2 };
            const userStats = { hits: 5, misses: 1 };
            const eventStats = { hits: 8, misses: 3 };

            mainCacheStub.getStats.returns(mainStats);
            mainCacheStub.size.returns(15);
            userCacheStub.getStats.returns(userStats);
            userCacheStub.size.returns(8);
            eventCacheStub.getStats.returns(eventStats);
            eventCacheStub.size.returns(12);

            const result = CacheService.getStats();

            expect(result).to.have.property('main', mainStats);
            expect(result).to.have.property('user', userStats);
            expect(result).to.have.property('event', eventStats);
            expect(result.combined.totalSize).to.equal(35);
            expect(result.combined.totalHits).to.equal(23);
            expect(result.combined.totalMisses).to.equal(6);
        });
    });

    describe('clearAll', () => {
        it('should clear all caches', () => {
            CacheService.clearAll();

            expect(mainCacheStub.clear.calledOnce).to.be.true;
            expect(userCacheStub.clear.calledOnce).to.be.true;
            expect(eventCacheStub.clear.calledOnce).to.be.true;
        });
    });
});
