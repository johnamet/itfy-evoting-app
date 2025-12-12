#!/usr/bin/env node
/**
 * Controllers Index
 * 
 * Central export point for all controllers.
 * All controllers follow domain-based pattern with thin controller layer
 * that delegates business logic to service layer.
 * 
 * @module controllers/index
 * @version 2.0.0
 */

// Import base controller
import BaseController from './BaseController.js';

// Import domain controllers
import AuthController from './AuthController.js';
import UserController from './UserController.js';
import EventController from './EventController.js';
import CandidateController from './CandidateController.js';
import VotingController from './VotingController.js';
import PaymentController from './PaymentController.js';
import CouponController from './CouponController.js';
import NotificationController from './NotificationController.js';
import AnalyticsController from './AnalyticsController.js';
import SettingsController from './SettingsController.js';
import NominationController from './NominationController.js';
import SlideController from './SlideController.js';

// Create controller instances
const authController = new AuthController();
const userController = new UserController();
const eventController = new EventController();
const candidateController = new CandidateController();
const votingController = new VotingController();
const paymentController = new PaymentController();
const couponController = new CouponController();
const notificationController = new NotificationController();
const analyticsController = new AnalyticsController();
const settingsController = new SettingsController();
const nominationController = new NominationController();
const slideController = new SlideController();

// Export class definitions
export {
    BaseController,
    AuthController,
    UserController,
    EventController,
    CandidateController,
    VotingController,
    PaymentController,
    CouponController,
    NotificationController,
    AnalyticsController,
    SettingsController,
    NominationController,
    SlideController
};

// Export controller instances for route usage
export {
    authController,
    userController,
    eventController,
    candidateController,
    votingController,
    paymentController,
    couponController,
    notificationController,
    analyticsController,
    settingsController,
    nominationController,
    slideController
};

// Default export for convenience
export default {
    BaseController,
    auth: authController,
    user: userController,
    event: eventController,
    candidate: candidateController,
    voting: votingController,
    payment: paymentController,
    coupon: couponController,
    notification: notificationController,
    analytics: analyticsController,
    settings: settingsController,
    nomination: nominationController,
    slide: slideController
};
