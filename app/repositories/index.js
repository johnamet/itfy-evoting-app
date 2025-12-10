#!/usr/bin/env node
/**
 * Enhanced Repositories Index
 * 
 * Central export point for all enhanced repositories with intelligent caching.
 * All repositories automatically invalidate stale caches when entities are updated.
 * 
 * @module repositories/enhanced
 * @version 2.0.0
 */

// Import enhanced repositories
import UserRepository from './UserRepository.js';
import EventRepository from './EventRepository.js';
import VoteRepository from './VoteRepository.js';
import CandidateRepository from './CandidateRepository.js';
import PaymentRepository from './PaymentRepository.js';
import NotificationRepository from './NotificationRepository.js';
import CategoryRepository from './CategoryRepository.js';
import CouponRepository from './CouponRepository.js';
import CouponUsageRepository from './CouponUsageRepository.js';
import AnalyticsRepository from './AnalyticsRepository.js';
import SettingsRepository from './SettingsRepository.js';
import ActivityRepository from './ActivityRepository.js';
import RoleRepository from './RoleRepository.js';
import SlideRepository from './SlideRepository.js';
import VoteBundleRepository from './VoteBundleRepository.js';
import FormsRepository from './FormsRepository.js';

// Create singleton instances
const userRepository = new UserRepository();
const eventRepository = new EventRepository();
const voteRepository = new VoteRepository();
const candidateRepository = new CandidateRepository();
const paymentRepository = new PaymentRepository();
const notificationRepository = new NotificationRepository();
const categoryRepository = new CategoryRepository();
const couponRepository = new CouponRepository();
const couponUsageRepository = new CouponUsageRepository();
const analyticsRepository = new AnalyticsRepository();
const settingsRepository = new SettingsRepository();
const activityRepository = new ActivityRepository();
const roleRepository = new RoleRepository();
const slideRepository = new SlideRepository();
const voteBundleRepository = new VoteBundleRepository();
const formsRepository = new FormsRepository();

// Export instances (recommended approach for consistency)
export {
    userRepository,
    eventRepository,
    voteRepository,
    candidateRepository,
    paymentRepository,
    notificationRepository,
    categoryRepository,
    couponRepository,
    couponUsageRepository,
    analyticsRepository,
    settingsRepository,
    activityRepository,
    roleRepository,
    slideRepository,
    voteBundleRepository,
    formsRepository,
};

// Export classes for custom instantiation if needed
export {
    UserRepository,
    EventRepository,
    VoteRepository,
    CandidateRepository,
    PaymentRepository,
    NotificationRepository,
    CategoryRepository,
    CouponRepository,
    CouponUsageRepository,
    AnalyticsRepository,
    SettingsRepository,
    ActivityRepository,
    RoleRepository,
    SlideRepository,
    VoteBundleRepository,
    FormsRepository,
};

// Default export with all repositories
export default {
    userRepository,
    eventRepository,
    voteRepository,
    candidateRepository,
    paymentRepository,
    notificationRepository,
    categoryRepository,
    couponRepository,
    couponUsageRepository,
    analyticsRepository,
    settingsRepository,
    activityRepository,
    roleRepository,
    slideRepository,
    voteBundleRepository,
    formsRepository,
};
