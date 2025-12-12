#!/usr/bin/env node
/**
 * User Routes
 * 
 * @module routes/v1/users
 */

import express from 'express';
import UserController from '../../controllers/UserController.js';
import { authenticate, requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const userController = new UserController();

/**
 * @route GET /api/v1/users
 * @desc Get all users (with pagination)
 * @access Private (Admin - Level 3+)
 */
router.get('/', requireLevel(3), (req, res) => userController.getAllUsers(req, res));

/**
 * @route GET /api/v1/users/:id
 * @desc Get user by ID
 * @access Private (Admin - Level 3+)
 */
router.get('/:id', requireLevel(3), (req, res) => userController.getUserById(req, res));

/**
 * @route PUT /api/v1/users/:id
 * @desc Update user
 * @access Private (Admin - Level 3+ or own profile)
 */
router.put('/:id', authenticate, (req, res) => userController.updateUser(req, res));

/**
 * @route DELETE /api/v1/users/:id
 * @desc Delete user
 * @access Private (Admin - Level 4+)
 */
router.delete('/:id', requireLevel(4), (req, res) => userController.deleteUser(req, res));

/**
 * @route PUT /api/v1/users/:id/role
 * @desc Update user role
 * @access Private (Admin - Level 4+)
 */
router.put('/:id/role', requireLevel(4), (req, res) => userController.updateUserRole(req, res));

/**
 * @route GET /api/v1/users/:id/activity
 * @desc Get user activity log
 * @access Private (Admin - Level 3+ or own activity)
 */
router.get('/:id/activity', authenticate, (req, res) => userController.getUserActivity(req, res));

/**
 * @route PUT /api/v1/users/:id/status
 * @desc Update user status (active/suspended)
 * @access Private (Admin - Level 3+)
 */
router.put('/:id/status', requireLevel(3), (req, res) => userController.updateUserStatus(req, res));

export default router;
