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
import FileService from './FileService.js';
import CategoryService from './CategoryService.js';
import ActivityService from './ActivityService.js';
import CouponService from './CouponService.js';
import FormService from './FormService.js';
import SlideService from './SlideService.js';
import PaymentService from './PaymentService.js';
import EmailService from './EmailService.js';

export {
    BaseService,
    AuthService,
    UserService,
    EventService,
    VotingService,
    CandidateService,
    CacheService,
    FileService,
    CategoryService,
    ActivityService,
    CouponService,
    FormService,
    SlideService,
    PaymentService,
    EmailService
};

export default {
    BaseService,
    AuthService,
    UserService,
    EventService,
    VotingService,
    CandidateService,
    CacheService,
    FileService,
    CategoryService,
    ActivityService,
    CouponService,
    FormService,
    SlideService,
    PaymentService,
    EmailService
};
