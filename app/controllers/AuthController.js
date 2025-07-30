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
