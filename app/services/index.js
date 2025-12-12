/**
 * Services Index
 * 
 * Centralized export of all service instances with proper repository injection.
 * Services are instantiated as singletons with their required repositories.
 * 
 * @module services
 * @version 2.0.0
 */

// Import all repositories
import {
    userRepository,
    candidateRepository,
    eventRepository,
    voteRepository,
    categoryRepository,
    couponRepository,
    couponUsageRepository,
    paymentRepository,
    notificationRepository,
    analyticsRepository,
    settingsRepository,
    activityRepository,
    roleRepository,
    slideRepository,
    voteBundleRepository,
    formsRepository,
    nominationRepository,
} from '../repositories/index.js';

// Import all service classes
import BaseService from './BaseService.js';
import AuthService from './AuthService.js';
import UserService from './UserService.js';
import EventService from './EventService.js';
import VotingService from './VotingService.js';
import CandidateService from './CandidateService.js';
import CouponService from './CouponService.js';
import PaymentService from './PaymentService.js';
import NotificationService from './NotificationService.js';
import AnalyticsService from './AnalyticsService.js';
import SettingsService from './SettingsService.js';
import NominationService from './NominationService.js';
import SlideService from './SlideService.js';
import { emailService } from './EmailService.js';
import { fileService } from './FileService.js';

/**
 * Instantiate services with required repository injections
 */

// AuthService - handles user and candidate authentication
const authService = new AuthService({
    user: userRepository,
    candidate: candidateRepository,
    settings: settingsRepository,
    activity: activityRepository,
});

// UserService - handles user profile and account management
const userService = new UserService({
    user: userRepository,
    activity: activityRepository,
    event: eventRepository,
    vote: voteRepository,
});

// EventService - handles event lifecycle management
const eventService = new EventService({
    event: eventRepository,
    candidate: candidateRepository,
    vote: voteRepository,
    category: categoryRepository,
    payment: paymentRepository,
    activity: activityRepository,
    settings: settingsRepository,
}, { emailService, notificationService: null }); // notificationService set after instantiation

// VotingService - handles vote casting and analytics
const votingService = new VotingService({
    vote: voteRepository,
    event: eventRepository,
    candidate: candidateRepository,
    voteBundle: voteBundleRepository,
    user: userRepository,
    activity: activityRepository,
    settings: settingsRepository,
}, { emailService, notificationService: null }); // notificationService set after instantiation

// CandidateService - handles candidate management
const candidateService = new CandidateService({
    candidate: candidateRepository,
    event: eventRepository,
    category: categoryRepository,
    vote: voteRepository,
    activity: activityRepository,
}, { emailService, notificationService: null }); // notificationService set after instantiation

// CouponService - handles coupons and usage tracking
const couponService = new CouponService({
    coupon: couponRepository,
    couponUsage: couponUsageRepository,
    event: eventRepository,
    user: userRepository,
    activity: activityRepository,
});

// PaymentService - handles payment processing and verification
const paymentService = new PaymentService({
    payment: paymentRepository,
    event: eventRepository,
    user: userRepository,
    coupon: couponRepository,
    couponUsage: couponUsageRepository,
    activity: activityRepository,
}, { emailService, notificationService: null }); // notificationService set after instantiation

// NotificationService - handles notification creation and delivery
const notificationService = new NotificationService({
    notification: notificationRepository,
    user: userRepository,
    event: eventRepository,
    vote: voteRepository,
    candidate: candidateRepository,
    payment: paymentRepository,
});

// AnalyticsService - handles platform analytics and reporting
const analyticsService = new AnalyticsService({
    analytics: analyticsRepository,
    user: userRepository,
    event: eventRepository,
    vote: voteRepository,
    candidate: candidateRepository,
    payment: paymentRepository,
    activity: activityRepository,
});

// SettingsService - handles platform configuration
const settingsService = new SettingsService({
    settings: settingsRepository,
    activity: activityRepository,
});

// NominationService - handles candidate nominations and admin review
const nominationService = new NominationService({
    nomination: nominationRepository,
    candidate: candidateRepository,
    event: eventRepository,
    category: categoryRepository,
    user: userRepository,
    activity: activityRepository,
}, { emailService, notificationService: null }); // notificationService set after instantiation

// SlideService - handles presentation slides/carousels
const slideService = new SlideService({
    slide: slideRepository,
    event: eventRepository,
    activity: activityRepository,
});

/**
 * Set notificationService references after instantiation to avoid circular dependencies
 */
if (notificationService) {
    eventService.notificationService = notificationService;
    votingService.notificationService = notificationService;
    candidateService.notificationService = notificationService;
    paymentService.notificationService = notificationService;
    nominationService.notificationService = notificationService;
}

/**
 * Export service instances (recommended for use in controllers)
 */
export {
    authService,
    userService,
    eventService,
    votingService,
    candidateService,
    couponService,
    paymentService,
    notificationService,
    analyticsService,
    settingsService,
    nominationService,
    slideService,
    emailService,
    fileService,
};

/**
 * Export service classes (for testing and custom instantiation)
 */
export {
    BaseService,
    AuthService,
    UserService,
    EventService,
    VotingService,
    CandidateService,
    CouponService,
    PaymentService,
    NotificationService,
    AnalyticsService,
    SettingsService,
    NominationService,
    SlideService,
};

/**
 * Default export - all service instances
 */
export default {
    auth: authService,
    user: userService,
    event: eventService,
    voting: votingService,
    candidate: candidateService,
    coupon: couponService,
    payment: paymentService,
    notification: notificationService,
    analytics: analyticsService,
    settings: settingsService,
    nomination: nominationService,
    slide: slideService,
    email: emailService,
    file: fileService,
};
