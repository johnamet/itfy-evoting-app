#!/usr/bin/env node
/**
 * Auth Routes
 * 
 * Defines API endpoints for authentication operations.
 * 
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization operations
 */

import express from 'express';
import AuthController from '../controllers/AuthController.js';
import { requireRead, requireUpdate } from '../middleware/auth.js';

const router = express.Router();
const authController = new AuthController();

// Public routes
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
router.post('/refresh-token', (req, res) => authController.refreshToken(req, res));

// Protected routes
router.post('/logout', requireRead, (req, res) => authController.logout(req, res));
router.get('/profile', requireRead, (req, res) => authController.getProfile(req, res));
router.put('/profile', requireUpdate, (req, res) => authController.updateProfile(req, res));
router.post('/change-password', requireUpdate, (req, res) => authController.changePassword(req, res));

export default router;
