#!/usr/bin/env node
/**
 * Controllers Index
 * 
 * Exports all controllers for easy importing.
 */

import ActivityController from './ActivityController.js';
import AuthController from './AuthController.js';
import BaseController from './BaseController.js';
import CacheController from './CacheController.js';
import CandidateController from './CandidateController.js';
import CategoryController from './CategoryController.js';
import CouponController from './CouponController.js';
import EventController from './EventController.js';
import FileController from './FileController.js';
import FormController from './FormController.js';
import SlideController from './SlideController.js';
import UserController from './UserController.js';
import VotingController from './VotingController.js';

export {
    ActivityController,
    AuthController,
    BaseController,
    CacheController,
    CandidateController,
    CategoryController,
    CouponController,
    EventController,
    FileController,
    FormController,
    SlideController,
    UserController,
    VotingController
};

export default {
    BaseController,
    FormController
};
