#!/usr/bin/env node
/**
 * Services Index
 * 
 * Central export point for all business logic services.
 * Provides easy access to all service classes.
 */

import BaseService from './BaseService.js';
import AuthService from './AuthService.js';
import UserService from './UserService.js';
import EventService from './EventService.js';
import VotingService from './VotingService.js';
import CandidateService from './CandidateService.js';
import CacheService from './CacheService.js';

export {
    BaseService,
    AuthService,
    UserService,
    EventService,
    VotingService,
    CandidateService,
    CacheService
};

export default {
    BaseService,
    AuthService,
    UserService,
    EventService,
    VotingService,
    CandidateService,
    CacheService
};
