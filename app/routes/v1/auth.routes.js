#!/usr/bin/env node
/**
 * Authentication Routes
 * 
 * @module routes/v1/auth
 */

import express from 'express';
import AuthController from '../../controllers/AuthController.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';

const router = express.Router();
const authController = new AuthController();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user
 * @access Public
 */
router.post('/register', (req, res) => authController.register(req, res));

/**
 * @route POST /api/v1/auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', (req, res) => authController.login(req, res));

/**
 * @route POST /api/v1/auth/logout
 * @desc User logout
 * @access Private
 */
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));

/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

/**
 * @route GET /api/v1/auth/verify-email/:token
 * @desc Verify email address
 * @access Public
 */
router.get('/verify-email/:token', (req, res) => authController.verifyEmail(req, res));

/**
 * @route POST /api/v1/auth/resend-verification
 * @desc Resend email verification
 * @access Public
 */
router.post('/resend-verification', (req, res) => authController.resendVerification(req, res));

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', authenticate, (req, res) => authController.getCurrentUser(req, res));

/**
 * @route PUT /api/v1/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', authenticate, (req, res) => authController.changePassword(req, res));

export default router;
