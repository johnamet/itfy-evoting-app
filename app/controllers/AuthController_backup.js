#!/usr/bin/env node
/**
 * Auth Controller
 * 
 * Handles authentication and user managem    /**
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
     *             $ref: '#/components/schemas/RegisterRequest'
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
     *                       $ref: '#/components/schemas/AuthResponse'
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
     */ operations.
 * 
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           format: password
 *           example: "securePassword123"
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - name
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "newuser@example.com"
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: "securePassword123"
 *         name:
 *           type: string
 *           example: "John Doe"
 *         role:
 *           type: string
 *           enum: [user, admin, super_admin]
 *           default: user
 *           example: "user"
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refreshToken:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         expiresIn:
 *           type: string
 *           example: "24h"
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           format: password
 *           example: "oldPassword123"
 *         newPassword:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: "newSecurePassword123"
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
     *             $ref: '#/components/schemas/RegisterRequest'
     *           examples:
     *             user:
     *               summary: Regular user registration
     *               value:
     *                 email: "user@example.com"
     *                 password: "securePassword123"
     *                 name: "John Doe"
     *                 role: "user"
     *             admin:
     *               summary: Admin user registration
     *               value:
     *                 email: "admin@example.com"
     *                 password: "adminPassword123"
     *                 name: "Admin User"
     *                 role: "admin"
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
     *                       $ref: '#/components/schemas/AuthResponse'
     *             example:
     *               success: true
     *               message: "User registered successfully"
     *               timestamp: "2025-08-05T10:30:00.000Z"
     *               data:
     *                 user:
     *                   _id: "64f8a1b2c3d4e5f6789012ab"
     *                   name: "John Doe"
     *                   email: "user@example.com"
     *                   role: "user"
     *                   level: 1
     *                   isActive: true
     *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                 expiresIn: "24h"
     *       400:
     *         description: Bad request - Missing required fields or validation error
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             examples:
     *               missing_fields:
     *                 summary: Missing required fields
     *                 value:
     *                   success: false
     *                   error: "Email, password, and name are required"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
     *               email_exists:
     *                 summary: Email already exists
     *                 value:
     *                   success: false
     *                   error: "Email already exists"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
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
     *             $ref: '#/components/schemas/LoginRequest'
     *           example:
     *             email: "user@example.com"
     *             password: "securePassword123"
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
     *                       $ref: '#/components/schemas/AuthResponse'
     *             example:
     *               success: true
     *               message: "Login successful"
     *               timestamp: "2025-08-05T10:30:00.000Z"
     *               data:
     *                 user:
     *                   _id: "64f8a1b2c3d4e5f6789012ab"
     *                   name: "John Doe"
     *                   email: "user@example.com"
     *                   role: "user"
     *                   level: 1
     *                   isActive: true
     *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     *                 expiresIn: "24h"
     *       400:
     *         description: Bad request - Missing credentials or invalid login
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *             examples:
     *               missing_credentials:
     *                 summary: Missing email or password
     *                 value:
     *                   success: false
     *                   error: "Email and password are required"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
     *               invalid_credentials:
     *                 summary: Invalid credentials
     *                 value:
     *                   success: false
     *                   error: "Invalid email or password"
     *                   timestamp: "2025-08-05T10:30:00.000Z"
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

            const result = await this.authService.login(email, password);
            return this.sendSuccess(res, result, 'Login successful');
        } catch (error) {
            return this.handleError(res, error, 'Login failed');
        }
    }

    /**
     * User logout
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
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            const updateData = req.body;

            if (!userId) {
                return this.sendError(res, 'User not authenticated', 401);
            }

            // Remove sensitive fields that shouldn't be updated here
            delete updateData.password;
            delete updateData.email;
            delete updateData.role;

            const updatedUser = await this.userService.updateUser(userId, updateData);
            return this.sendSuccess(res, updatedUser, 'Profile updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update profile');
        }
    }

    /**
     * Change password
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
     * Request password reset
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
            return this.handleError(res, error, 'Failed to send password reset email');
        }
    }

    /**
     * Reset password with token
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
     * Refresh access token
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
