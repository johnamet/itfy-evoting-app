#!/usr/bin/env node
/**
 * Cache service
 * This service provides high-level caching operations for the application
 */

import { mainCache, userCache, eventCache } from '../utils/engine/cache.js';

class CacheService {
    
    /**
     * Cache user data
     * @param {string} userId - User ID
     * @param {Object} userData - User data to cache
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheUser(userId, userData, ttl = 7200000) { // 2 hours
        const key = `user:${userId}`;
        return userCache.set(key, userData, ttl);
    }

    /**
     * Get cached user data
     * @param {string} userId - User ID
     * @returns {Object|null} User data or null if not found
     */
    static getUser(userId) {
        const key = `user:${userId}`;
        return userCache.get(key);
    }

    /**
     * Invalidate user cache
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    static invalidateUser(userId) {
        const patterns = [
            `user:${userId}`,
            `user:${userId}:.*`
        ];
        
        let deleted = false;
        for (const pattern of patterns) {
            const regex = new RegExp(pattern);
            for (const key of userCache.keys()) {
                if (regex.test(key)) {
                    userCache.delete(key);
                    deleted = true;
                }
            }
        }
        return deleted;
    }

    /**
     * Cache event data
     * @param {string} eventId - Event ID
     * @param {Object} eventData - Event data to cache
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheEvent(eventId, eventData, ttl = 1800000) { // 30 minutes
        const key = `event:${eventId}`;
        return eventCache.set(key, eventData, ttl);
    }

    /**
     * Get cached event data
     * @param {string} eventId - Event ID
     * @returns {Object|null} Event data or null if not found
     */
    static getEvent(eventId) {
        const key = `event:${eventId}`;
        return eventCache.get(key);
    }

    /**
     * Invalidate event cache
     * @param {string} eventId - Event ID
     * @returns {boolean} Success status
     */
    static invalidateEvent(eventId) {
        const patterns = [
            `event:${eventId}`,
            `event:${eventId}:.*`,
            `.*:${eventId}:.*` // For related caches
        ];
        
        let deleted = false;
        const caches = [mainCache, userCache, eventCache];
        
        for (const cache of caches) {
            for (const pattern of patterns) {
                const regex = new RegExp(pattern);
                for (const key of cache.keys()) {
                    if (regex.test(key)) {
                        cache.delete(key);
                        deleted = true;
                    }
                }
            }
        }
        return deleted;
    }

    /**
     * Cache voting session data
     * @param {string} sessionId - Session ID
     * @param {Object} sessionData - Session data to cache
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheVotingSession(sessionId, sessionData, ttl = 3600000) { // 1 hour
        const key = `voting_session:${sessionId}`;
        return mainCache.set(key, sessionData, ttl);
    }

    /**
     * Get cached voting session data
     * @param {string} sessionId - Session ID
     * @returns {Object|null} Session data or null if not found
     */
    static getVotingSession(sessionId) {
        const key = `voting_session:${sessionId}`;
        return mainCache.get(key);
    }

    /**
     * Cache vote count for an event
     * @param {string} eventId - Event ID
     * @param {Object} voteData - Vote count data
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheVoteCount(eventId, voteData, ttl = 300000) { // 5 minutes
        const key = `vote_count:${eventId}`;
        return eventCache.set(key, voteData, ttl);
    }

    /**
     * Get cached vote count for an event
     * @param {string} eventId - Event ID
     * @returns {Object|null} Vote count data or null if not found
     */
    static getVoteCount(eventId) {
        const key = `vote_count:${eventId}`;
        return eventCache.get(key);
    }

    /**
     * Cache candidates for an event
     * @param {string} eventId - Event ID
     * @param {Array} candidates - Candidates array
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheCandidates(eventId, candidates, ttl = 1800000) { // 30 minutes
        const key = `candidates:${eventId}`;
        return eventCache.set(key, candidates, ttl);
    }

    /**
     * Get cached candidates for an event
     * @param {string} eventId - Event ID
     * @returns {Array|null} Candidates array or null if not found
     */
    static getCandidates(eventId) {
        const key = `candidates:${eventId}`;
        return eventCache.get(key);
    }

    /**
     * Cache authentication token
     * @param {string} token - JWT token
     * @param {Object} userData - User data associated with token
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheAuthToken(token, userData, ttl = 3600000) { // 1 hour
        const key = `auth:${token}`;
        return userCache.set(key, userData, ttl);
    }

    /**
     * Get cached authentication token data
     * @param {string} token - JWT token
     * @returns {Object|null} User data or null if not found
     */
    static getAuthToken(token) {
        const key = `auth:${token}`;
        return userCache.get(key);
    }

    /**
     * Invalidate authentication token
     * @param {string} token - JWT token
     * @returns {boolean} Success status
     */
    static invalidateAuthToken(token) {
        const key = `auth:${token}`;
        return userCache.delete(key);
    }

    /**
     * Cache API response
     * @param {string} endpoint - API endpoint
     * @param {Object} response - Response data
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheApiResponse(endpoint, response, ttl = 1800000) { // 30 minutes
        const key = `api:${endpoint}`;
        return mainCache.set(key, response, ttl);
    }

    /**
     * Get cached API response
     * @param {string} endpoint - API endpoint
     * @returns {Object|null} Response data or null if not found
     */
    static getApiResponse(endpoint) {
        const key = `api:${endpoint}`;
        return mainCache.get(key);
    }

    /**
     * Cache database query result
     * @param {string} queryKey - Unique query identifier
     * @param {any} result - Query result
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static cacheQueryResult(queryKey, result, ttl = 900000) { // 15 minutes
        const key = `query:${queryKey}`;
        return mainCache.set(key, result, ttl);
    }

    /**
     * Get cached database query result
     * @param {string} queryKey - Unique query identifier
     * @returns {any} Query result or null if not found
     */
    static getQueryResult(queryKey) {
        const key = `query:${queryKey}`;
        return mainCache.get(key);
    }

    /**
     * Increment a counter in cache
     * @param {string} counterName - Counter name
     * @param {number} increment - Amount to increment
     * @param {number} ttl - Time to live in milliseconds
     * @returns {number} New counter value
     */
    static incrementCounter(counterName, increment = 1, ttl = 86400000) { // 24 hours
        const key = `counter:${counterName}`;
        return mainCache.increment(key, increment, ttl);
    }

    /**
     * Get counter value
     * @param {string} counterName - Counter name
     * @returns {number} Counter value or 0 if not found
     */
    static getCounter(counterName) {
        const key = `counter:${counterName}`;
        return mainCache.get(key) || 0;
    }

    /**
     * Set cache with automatic serialization
     * @param {string} key - Cache key
     * @param {any} data - Data to cache (will be JSON serialized)
     * @param {number} ttl - Time to live in milliseconds
     * @returns {boolean} Success status
     */
    static set(key, data, ttl = 3600000) {
        try {
            const serializedData = JSON.stringify(data);
            return mainCache.set(key, serializedData, ttl);
        } catch (error) {
            console.error('Cache serialization error:', error.message);
            return false;
        }
    }

    /**
     * Get cache with automatic deserialization
     * @param {string} key - Cache key
     * @returns {any} Deserialized data or null if not found
     */
    static get(key) {
        try {
            const serializedData = mainCache.get(key);
            if (serializedData === null) return null;
            return JSON.parse(serializedData);
        } catch (error) {
            console.error('Cache deserialization error:', error.message);
            return null;
        }
    }

    /**
     * Get all cache statistics
     * @returns {Object} Combined cache statistics
     */
    static getStats() {
        return {
            main: mainCache.getStats(),
            user: userCache.getStats(),
            event: eventCache.getStats(),
            combined: {
                totalSize: mainCache.size() + userCache.size() + eventCache.size(),
                totalHits: mainCache.getStats().hits + userCache.getStats().hits + eventCache.getStats().hits,
                totalMisses: mainCache.getStats().misses + userCache.getStats().misses + eventCache.getStats().misses
            }
        };
    }

    /**
     * Clear all caches
     */
    static clearAll() {
        mainCache.clear();
        userCache.clear();
        eventCache.clear();
        console.log('All caches cleared');
    }
}

export default CacheService;
