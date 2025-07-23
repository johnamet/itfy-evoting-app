#!/usr/bin/env node
/**
 * Repository Index
 * 
 * Central export point for all repository classes.
 * This file exports all repository classes for easy importing throughout the application.
 */

import BaseRepository from './BaseRepository.js';
import UserRepository from './UserRepository.js';
import CouponRepository from './CouponRepository.js';
import VoteRepository from './VoteRepository.js';
import EventRepository from './EventRepository.js';
import CandidateRepository from './CandidateRepository.js';
import CouponUsageRepository from './CouponUsageRepository.js';

export {
    BaseRepository,
    UserRepository,
    CouponRepository,
    VoteRepository,
    EventRepository,
    CandidateRepository,
    CouponRepository,
    CouponUsageRepository
};

export default {
    BaseRepository,
    UserRepository,
    CouponRepository,
    VoteRepository,
    EventRepository,
    CandidateRepository,
    CouponRepository,
    CouponUsageRepository
};
