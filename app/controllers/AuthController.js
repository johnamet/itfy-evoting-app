#!/usr/bin/env node
/**
 * Auth Controller
 * 
 * Handles authentication and user management operations.
 */

import BaseController from './BaseController.js';
import AuthService from '../services/AuthService.js';
import UserService from '../services/UserService.js';

export default class AuthController extends BaseController {
    constructor() {
        super();
        this.authService = new AuthService();
        this.userService = new UserService();
    }

    /**
     * User registration
     * 
     * @swagger
     * /auth/register:
     *   post:
     *     summary: Register a new user
     *     description: Creates a new user account in the system
     *     tags: [Authentication]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - email
     *               - password
     *             properties:
     *               name:
     *                 type: string
     *                 example: "John Doe"
     *               email:
     *                 type: string
     *                 format: email
     *                 example: "john.doe@example.com"
     *               password:
     *                 type: string
     *                 format: password
     *                 example: "password123"
     *               role:
     *                 type: string
     *                 enum: ["user", "admin", "super_admin"]
     *                 default: "user"
     *     responses:
     *       201:
     *         description: User registered successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         user:
     *                           $ref: '#/components/schemas/User'
     *                         token:
     *                           type: string
     *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                         refreshToken:
     *                           type: string
     *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                         expiresIn:
     *                           type: string
     *                           example: "24h"
     *       400:
     *         description: Bad request - Missing required fields or user already exists
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async register(req, res) {
        try {
            const { email, password, name, role } = req.body;

            // Validate required fields
            if (!email || !password || !name) {
                return this.sendError(res, 'Email, password, and name are required', 400);
            }

            const result = await this.authService.register({
                email,
                password,
                name,
                role: role || 'user'
            });

            return this.sendSuccess(res, result, 'User registered successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Registration failed');
        }
    }

    /**
     * User login
     * 
     * @swagger
     * /auth/login:
     *   post:
     *     summary: User login
     *     description: Authenticates a user and returns access tokens
     *     tags: [Authentication]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: "user@example.com"
     *               password:
     *                 type: string
     *                 format: password
     *                 example: "password123"
     *     responses:
     *       200:
     *         description: Login successful
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         user:
     *                           $ref: '#/components/schemas/User'
     *                         token:
     *                           type: string
     *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                         refreshToken:
     *                           type: string
     *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                         expiresIn:
     *                           type: string
     *                           example: "24h"
     *       400:
     *         description: Bad request - Missing credentials
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Invalid credentials
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return this.sendError(res, 'Email and password are required', 400);
            }

            const result = await this.authService.login(email, password, {ipAddress: req.ip, location: req.geo});
            return this.sendSuccess(res, result, 'Login successful');
        } catch (error) {
            return this.handleError(res, error, 'Login failed');
        }
    }

    /**
     * User logout
     * 
     * @swagger
     * /auth/logout:
     *   post:
     *     summary: User logout
     *     description: Logs out the current user and invalidates their token
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Logout successful
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       401:
     *         description: Unauthorized - Invalid or missing token
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async logout(req, res) {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (token) {
                await this.authService.logout(token);
            }

            return this.sendSuccess(res, null, 'Logout successful');
        } catch (error) {
            return this.handleError(res, error, 'Logout failed');
        }
    }

    /**
     * Get current user profile
     * 
     * @swagger
     * /auth/profile:
     *   get:
     *     summary: Get user profile
     *     description: Retrieves the current authenticated user's profile
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Profile retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/User'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: User not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async getProfile(req, res) {
        try {
            const userId = req.user?.id;
            
            if (!userId) {
                return this.sendError(res, 'User not authenticated', 401);
            }

            const user = await this.userService.getUserById(userId);
            return this.sendSuccess(res, user, 'Profile retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get profile');
        }
    }

    /**
     * Update user profile
     * 
     * @swagger
     * /auth/profile:
     *   put:
     *     summary: Update user profile
     *     description: Updates the current authenticated user's profile information
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 example: "John Doe Updated"
     *               email:
     *                 type: string
     *                 format: email
     *                 example: "john.updated@example.com"
     *               bio:
     *                 type: string
     *                 example: "Software developer with passion for innovation"
     *               avatar:
     *                 type: string
     *                 example: "https://example.com/avatar.jpg"
     *     responses:
     *       200:
     *         description: Profile updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       $ref: '#/components/schemas/User'
     *       400:
     *         description: Bad request - Invalid data
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Authentication required
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            
            if (!userId) {
                return this.sendError(res, 'User not authenticated', 401);
            }

            const updateData = req.body;
            const updatedUser = await this.userService.updateUser(userId, updateData);
            
            return this.sendSuccess(res, updatedUser, 'Profile updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update profile');
        }
    }

    /**
     * Change password
     * 
     * @swagger
     * /auth/change-password:
     *   post:
     *     summary: Change user password
     *     description: Changes the current authenticated user's password
     *     tags: [Authentication]
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - currentPassword
     *               - newPassword
     *             properties:
     *               currentPassword:
     *                 type: string
     *                 format: password
     *                 example: "currentPassword123"
     *               newPassword:
     *                 type: string
     *                 format: password
     *                 example: "newPassword456"
     *     responses:
     *       200:
     *         description: Password changed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       400:
     *         description: Bad request - Missing or invalid passwords
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Authentication required or incorrect current password
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async changePassword(req, res) {
        try {
            const userId = req.user?.id;
            const { currentPassword, newPassword } = req.body;

            if (!userId) {
                return this.sendError(res, 'User not authenticated', 401);
            }

            if (!currentPassword || !newPassword) {
                return this.sendError(res, 'Current password and new password are required', 400);
            }

            await this.authService.changePassword(userId, currentPassword, newPassword);
            return this.sendSuccess(res, null, 'Password changed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to change password');
        }
    }

    /**
     * Forgot password
     * 
     * @swagger
     * /auth/forgot-password:
     *   post:
     *     summary: Request password reset
     *     description: Sends a password reset email to the user
     *     tags: [Authentication]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: "user@example.com"
     *     responses:
     *       200:
     *         description: Password reset email sent
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       400:
     *         description: Bad request - Missing email
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: User not found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return this.sendError(res, 'Email is required', 400);
            }

            await this.authService.forgotPassword(email);
            return this.sendSuccess(res, null, 'Password reset email sent');
        } catch (error) {
            return this.handleError(res, error, 'Failed to process password reset request');
        }
    }

    /**
     * Reset password
     * 
     * @swagger
     * /auth/reset-password:
     *   post:
     *     summary: Reset password with token
     *     description: Resets user password using the token received via email
     *     tags: [Authentication]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - token
     *               - newPassword
     *             properties:
     *               token:
     *                 type: string
     *                 example: "reset_token_here"
     *               newPassword:
     *                 type: string
     *                 format: password
     *                 example: "newPassword123"
     *     responses:
     *       200:
     *         description: Password reset successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SuccessResponse'
     *       400:
     *         description: Bad request - Missing token or password
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Invalid or expired token
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                return this.sendError(res, 'Token and new password are required', 400);
            }

            await this.authService.resetPassword(token, newPassword);
            return this.sendSuccess(res, null, 'Password reset successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to reset password');
        }
    }

    /**
     * Refresh token
     * 
     * @swagger
     * /auth/refresh-token:
     *   post:
     *     summary: Refresh access token
     *     description: Generates a new access token using a valid refresh token
     *     tags: [Authentication]
     *     security: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - refreshToken
     *             properties:
     *               refreshToken:
     *                 type: string
     *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *     responses:
     *       200:
     *         description: Token refreshed successfully
     *         content:
     *           application/json:
     *             schema:
     *               allOf:
     *                 - $ref: '#/components/schemas/SuccessResponse'
     *                 - type: object
     *                   properties:
     *                     data:
     *                       type: object
     *                       properties:
     *                         token:
     *                           type: string
     *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                         refreshToken:
     *                           type: string
     *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                         expiresIn:
     *                           type: string
     *                           example: "24h"
     *       400:
     *         description: Bad request - Missing refresh token
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       401:
     *         description: Unauthorized - Invalid or expired refresh token
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return this.sendError(res, 'Refresh token is required', 400);
            }

            const result = await this.authService.refreshToken(refreshToken);
            return this.sendSuccess(res, result, 'Token refreshed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to refresh token');
        }
    }
}
