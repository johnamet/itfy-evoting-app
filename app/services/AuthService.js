#!/usr/bin/env node
/**
 * Authentication Service
 * 
 * Handles user authentication, authorization, and session management.
 * Includes login, logout, token management, and permission checks.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import BaseService from './BaseService.js';
import UserRepository from '../repositories/UserRepository.js';
import RoleRepository from '../repositories/RoleRepository.js';
import EmailService from './EmailService.js';
import config from '../config/ConfigManager.js';
import ActivityService from './ActivityService.js';

class AuthService extends BaseService {
    constructor() {
        super();
        this.userRepository = new UserRepository();
        this.roleRepository = new RoleRepository();
        this.emailService = new EmailService();
        this.activityService = new ActivityService()
        this.jwtSecret = config.get('jwt.secret');
        this.jwtExpiresIn = config.get('jwt.expiresIn') || '24h';
        this.refreshTokenExpiresIn = config.get('jwt.refreshExpiresIn') || '7d';
        this.jwtAlgorithm = config.get('jwt.algorithm') || 'HS256';
        this.jwtIssuer = config.get('jwt.issuer') || 'e-voting-app';
        this.jwtAudience = config.get('jwt.audience') || 'e-voting-app-users';
    }

    /**
     * Authenticate user with email and password
     * @param {String} email - User email
     * @param {String} password - User password
     * @returns {Promise<Object>} Authentication result with tokens and user info
     */
    async login(email, password, options={}) {
        try {
            this._log('login', { email , options: options});

            // Validate required fields
            this._validateRequiredFields({ email, password }, ['email', 'password']);
            this._validateEmail(email);

            // Find user and verify password
            const user = await this.userRepository.authenticate(email, password);
            if (!user) {
                throw new Error('Invalid email or password');
            }

            // Check if user is active
            if (!user.isActive) {
                throw new Error('Account is deactivated');
            }

            // Generate tokens
            const tokens = await this._generateTokens(user);

            // Update last login
            await this.userRepository.updateById(user._id, {
                lastLogin: new Date(),
                lastLoginIP: options.ipAddress || 'Unknown',
                lastLoginLocation: options.location ? `${options.location.country}, ${options.location.city}` : 'Unknown'
            });


            const role  = user.role
            this._log('login_success', { userId: user._id, email, role: user.role.level });

            //log activity
            this.activityService.logActivity({
                user: user._id,
                action: "login",
                targetType: "user",
                targetId: user._id,
                ipAddress: options.ipAddress || "Unknown",
                userAgent: options.userAgent || "Unknown",
                timestamp: new Date()
            })
            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: {
                        id: role._id,
                        name: role.name,
                        level: role.level
                    },
                    lastLogin: new Date()
                },
                tokens: {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    expiresIn: this.jwtExpiresIn
                }
            };
        } catch (error) {
            throw this._handleError(error, 'login', { email });
        }
    }

    /**
     * Refresh access token using refresh token
     * @param {String} refreshToken - Refresh token
     * @returns {Promise<Object>} New access token
     */
    async refreshToken(refreshToken) {
        try {
            this._log('refresh_token');

            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }

            // Verify refresh token
            const decoded = jwt.verify(refreshToken, this.jwtSecret);
            
            // Find user
            const user = await this.userRepository.findById(decoded.userId);
            if (!user || !user.isActive) {
                throw new Error('Invalid refresh token');
            }

            // Generate new access token
            const accessToken = this._generateAccessToken(user);

            this._log('refresh_token_success', { userId: user._id });

            return {
                success: true,
                accessToken,
                expiresIn: this.jwtExpiresIn
            };
        } catch (error) {
            throw this._handleError(error, 'refresh_token');
        }
    }

    /**
     * Logout user (invalidate tokens)
     * @param {String} userId - User ID
     * @returns {Promise<Object>} Logout result
     */
    async logout(userId) {
        try {
            this._log('logout', { userId });

            this._validateObjectId(userId, 'User ID');

            // Update user's last logout time
            await this.userRepository.updateById(userId, {
                lastLogout: new Date()
            });

            this._log('logout_success', { userId });

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'logout', { userId });
        }
    }

    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Registration result
     */
    async register(userData) {
        try {
            this._log('register', { email: userData.email });

            // Validate required fields
            this._validateRequiredFields(userData, ['name', 'email', 'password']);
            this._validateEmail(userData.email);

            // Validate password strength
            this._validatePassword(userData.password);

            // Check if email already exists
            const existingUser = await this.userRepository.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('Email already registered');
            }

            // Get default role (lowest level)
            const defaultRole = await this.roleRepository.getLowestLevelRole();
            if (!defaultRole) {
                throw new Error('Default role not found');
            }

            // Create user with default role
            const userToCreate = {
                ...userData,
                role: defaultRole._id,
                isActive: true,
                emailVerified: false
            };

            const user = await this.userRepository.create(userToCreate);

            this._log('register_success', { userId: user._id, email: user.email });

            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: {
                        id: defaultRole._id,
                        name: defaultRole.name,
                        level: defaultRole.level
                    }
                },
                message: 'Registration successful'
            };
        } catch (error) {
            throw this._handleError(error, 'register', { email: userData.email });
        }
    }

    /**
     * Change user password
     * @param {String} userId - User ID
     * @param {String} currentPassword - Current password
     * @param {String} newPassword - New password
     * @returns {Promise<Object>} Password change result
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            this._log('change_password', { userId });

            this._validateObjectId(userId, 'User ID');
            this._validateRequiredFields({ currentPassword, newPassword }, ['currentPassword', 'newPassword']);
            this._validatePassword(newPassword);

            // Find user
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 12);

            // Update password
            await this.userRepository.updateById(userId, {
                password: hashedPassword,
                passwordChangedAt: new Date()
            });

            this._log('change_password_success', { userId });

            return {
                success: true,
                message: 'Password changed successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'change_password', { userId });
        }
    }

    /**
     * Verify user token and get user information
     * @param {String} token - JWT token
     * @returns {Promise<Object>} User information
     */
    async verifyToken(token) {
        try {
            if (!token) {
                throw new Error('Token is required');
            }

            // Verify token
            const decoded = jwt.verify(token, this.jwtSecret);
            
            // Find user
            const user = await this.userRepository.findById(decoded.userId);
            if (!user || !user.isActive) {
                throw new Error('Invalid token');
            }

            // Get user role
            const role = await this.roleRepository.findById(user.role);

            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: {
                        id: role._id,
                        name: role.name,
                        level: role.level
                    }
                }
            };
        } catch (error) {
            throw this._handleError(error, 'verify_token');
        }
    }

    /**
     * Check if user has required permission level
     * @param {String} userId - User ID
     * @param {Number} requiredLevel - Required permission level
     * @returns {Promise<Boolean>} Permission check result
     */
    async hasPermission(userId, requiredLevel) {
        try {
            this._validateObjectId(userId, 'User ID');

            const user = await this.userRepository.findById(userId);
            if (!user) {
                return false;
            }

            const role = await this.roleRepository.findById(user.role);
            if (!role) {
                return false;
            }

            return role.level >= requiredLevel;
        } catch (error) {
            this._log('permission_check_error', { userId, requiredLevel, error: error.message }, 'error');
            return false;
        }
    }

    /**
     * Generate access and refresh tokens
     * @param {Object} user - User object
     * @returns {Object} Generated tokens
     * @private
     */
    async _generateTokens(user) {
        const accessToken = this._generateAccessToken(user);
        const refreshToken = this._generateRefreshToken(user);

        return {
            accessToken,
            refreshToken
        };
    }

    /**
     * Generate access token
     * @param {Object} user - User object
     * @returns {String} Access token
     * @private
     */
    _generateAccessToken(user) {
        return jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role
            },
            this.jwtSecret,
            { expiresIn: this.jwtExpiresIn,
                algorithm: this.jwtAlgorithm,
                issuer: this.jwtIssuer,
                audience: this.jwtAudience
            }
        );
    }

    /**
     * Generate refresh token
     * @param {Object} user - User object
     * @returns {String} Refresh token
     * @private
     */
    _generateRefreshToken(user) {
        return jwt.sign(
            {
                userId: user._id,
                type: 'refresh'
            },
            this.jwtSecret,
            { expiresIn: this.refreshTokenExpiresIn,
                algorithm: this.jwtAlgorithm,
                issuer: this.jwtIssuer,
                audience: this.jwtAudience
             }
        );
    }

    /**
     * Request password reset
     * @param {String} email - User email
     * @param {String} ipAddress - Request IP address for security
     * @returns {Promise<Object>} Password reset result
     */
    async requestPasswordReset(email, ipAddress = 'Unknown') {
        try {
            this._log('password_reset_request', { email, ipAddress });

            // Validate email
            this._validateEmail(email);

            // Find user
            const user = await this.userRepository.findByEmail(email);
            if (!user) {
                // Don't reveal if email exists or not for security
                return {
                    success: true,
                    message: 'If this email exists in our system, you will receive a password reset link'
                };
            }

            // Generate reset token
            const resetToken = this._generateSecureToken();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            // Store reset token (you might want to add a password reset table/field)
            await this.userRepository.updateUser(user._id, {
                passwordResetToken: resetToken,
                passwordResetExpires: expiresAt
            });

            // Send password reset email
            try {
                await this.emailService.sendPasswordResetEmail({
                    name: user.name,
                    email: user.email,
                    ipAddress
                }, resetToken, 30);
                
                this._log('password_reset_email_sent', { userId: user._id, email });
            } catch (emailError) {
                this._logError('password_reset_email_failed', emailError, { userId: user._id, email });
                // Continue - don't fail the request if email fails
            }

            return {
                success: true,
                message: 'If this email exists in our system, you will receive a password reset link'
            };
        } catch (error) {
            throw this._handleError(error, 'password_reset_request', { email });
        }
    }

    /**
     * Request password reset (alias for forgotPassword)
     * @param {String} email - User email
     * @param {String} ipAddress - Request IP address for security
     * @returns {Promise<Object>} Password reset result
     */
    async forgotPassword(email, ipAddress = 'Unknown') {
        return this.requestPasswordReset(email, ipAddress);
    }

    /**
     * Reset password using token (overloaded method to support both signatures)
     * @param {String} token - Reset token
     * @param {String} newPasswordOrEmail - New password (if 2 params) or email (if 3 params)
     * @param {String} newPassword - New password (only if 3 params)
     * @returns {Promise<Object>} Password reset result
     */
    async resetPassword(token, newPasswordOrEmail, newPassword) {
        // Handle both signatures: (token, newPassword) and (token, email, newPassword)
        if (arguments.length === 2) {
            // Called with (token, newPassword) - need to find email from token
            return this._resetPasswordByToken(token, newPasswordOrEmail);
        } else {
            // Called with (token, email, newPassword)
            return this._resetPasswordByTokenAndEmail(token, newPasswordOrEmail, newPassword);
        }
    }

    /**
     * Reset password using only token (finds user by token)
     * @param {String} token - Reset token
     * @param {String} newPassword - New password
     * @returns {Promise<Object>} Password reset result
     * @private
     */
    async _resetPasswordByToken(token, newPassword) {
        try {
            this._log('password_reset_by_token', { token: token.substring(0, 8) + '...' });

            // Validate inputs
            this._validateRequiredFields({ token, newPassword }, ['token', 'newPassword']);
            this._validatePassword(newPassword);

            // Find user with valid reset token
            const user = await this.userRepository.findOne({
                passwordResetToken: token,
                passwordResetExpires: { $gt: new Date() }
            });

            if (!user) {
                throw new Error('Invalid or expired reset token');
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password and clear reset token
            await this.userRepository.updateUser(user._id, {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                updatedAt: new Date()
            });

            this._log('password_reset_success', { userId: user._id, email: user.email });

            return {
                success: true,
                message: 'Password reset successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'password_reset_by_token');
        }
    }

    /**
     * Reset password using token and email
     * @param {String} token - Reset token
     * @param {String} email - User email
     * @param {String} newPassword - New password
     * @returns {Promise<Object>} Password reset result
     * @private
     */
    async _resetPasswordByTokenAndEmail(token, email, newPassword) {
        try {
            this._log('password_reset_by_token_and_email', { token: token.substring(0, 8) + '...', email });

            // Validate inputs
            this._validateRequiredFields({ token, email, newPassword }, ['token', 'email', 'newPassword']);
            this._validateEmail(email);
            this._validatePassword(newPassword);

            // Find user with valid reset token and matching email
            const user = await this.userRepository.findOne({
                email,
                passwordResetToken: token,
                passwordResetExpires: { $gt: new Date() }
            });

            if (!user) {
                throw new Error('Invalid or expired reset token');
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password and clear reset token
            await this.userRepository.updateUser(user._id, {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                updatedAt: new Date()
            });

            this._log('password_reset_success', { userId: user._id, email });

            return {
                success: true,
                message: 'Password reset successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'password_reset_by_token_and_email', { email });
        }
    }

    /**
     * Generate secure random token
     * @returns {String} Secure token
     * @private
     */
    _generateSecureToken() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    /**
     * Validate password strength
     * @param {String} password - Password to validate
     * @throws {Error} If password is weak
     * @private
     */
    _validatePassword(password) {
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        if (!/(?=.*[a-z])/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }

        if (!/(?=.*[A-Z])/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }

        if (!/(?=.*\d)/.test(password)) {
            throw new Error('Password must contain at least one number');
        }

        if (!/(?=.*[@$!%*?&])/.test(password)) {
            throw new Error('Password must contain at least one special character');
        }
    }
}

export default AuthService;
