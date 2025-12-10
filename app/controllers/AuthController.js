/**
 * AuthController
 * 
 * Handles authentication and authorization for both users and candidates:
 * - User registration and login
 * - Candidate authentication
 * - Email verification
 * - Password reset/change
 * - Token refresh
 * - Logout
 * 
 * @module controllers/AuthController
 */

import BaseController from './BaseController.js';
import { authService } from '../services/index.js';

class AuthController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Register new user account
     * POST /api/v1/auth/register
     * Access: Public
     */
    register = this.asyncHandler(async (req, res) => {
        const { email, password, firstName, lastName, phone } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { email, password, firstName, lastName },
            ['email', 'password', 'firstName', 'lastName']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate email format
        if (!this.validateEmail(email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        // Validate password strength (min 8 chars)
        if (password.length < 8) {
            return this.sendBadRequest(res, 'Password must be at least 8 characters long');
        }

        try {
            const result = await authService.register({
                email,
                password,
                firstName,
                lastName,
                phone
            });

            return this.sendCreated(res, result, 'User registered successfully. Please check your email to verify your account.');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * User login
     * POST /api/v1/auth/login
     * Access: Public
     */
    login = this.asyncHandler(async (req, res) => {
        const { email, password } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { email, password },
            ['email', 'password']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate email format
        if (!this.validateEmail(email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        try {
            const metadata = this.getRequestMetadata(req);
            const result = await authService.login(email, password, metadata);

            return this.sendSuccess(res, result, 'Login successful');
        } catch (error) {
            if (error.message.includes('Invalid credentials') || 
                error.message.includes('not found') ||
                error.message.includes('not verified')) {
                return this.sendUnauthorized(res, error.message);
            }
            if (error.message.includes('locked')) {
                return this.sendForbidden(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Candidate login
     * POST /api/v1/auth/candidate/login
     * Access: Public
     */
    candidateLogin = this.asyncHandler(async (req, res) => {
        const { email, password, eventId } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { email, password, eventId },
            ['email', 'password', 'eventId']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate email format
        if (!this.validateEmail(email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        // Validate MongoDB ID
        if (!this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const metadata = this.getRequestMetadata(req);
            const result = await authService.candidateLogin(email, password, eventId, metadata);

            return this.sendSuccess(res, result, 'Candidate login successful');
        } catch (error) {
            if (error.message.includes('Invalid credentials') || 
                error.message.includes('not found')) {
                return this.sendUnauthorized(res, error.message);
            }
            if (error.message.includes('not approved') || 
                error.message.includes('suspended')) {
                return this.sendForbidden(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Verify email address
     * POST /api/v1/auth/verify-email
     * Access: Public
     */
    verifyEmail = this.asyncHandler(async (req, res) => {
        const { token } = this.getRequestBody(req);

        if (!token) {
            return this.sendBadRequest(res, 'Verification token is required');
        }

        try {
            const result = await authService.verifyEmail(token);
            return this.sendSuccess(res, result, 'Email verified successfully');
        } catch (error) {
            if (error.message.includes('Invalid') || 
                error.message.includes('expired')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Request password reset
     * POST /api/v1/auth/forgot-password
     * Access: Public
     */
    forgotPassword = this.asyncHandler(async (req, res) => {
        const { email } = this.getRequestBody(req);

        if (!email) {
            return this.sendBadRequest(res, 'Email is required');
        }

        if (!this.validateEmail(email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        try {
            await authService.forgotPassword(email);
            return this.sendSuccess(
                res, 
                null, 
                'If an account exists with this email, a password reset link has been sent'
            );
        } catch (error) {
            // Don't reveal if user exists
            return this.sendSuccess(
                res, 
                null, 
                'If an account exists with this email, a password reset link has been sent'
            );
        }
    });

    /**
     * Reset password with token
     * POST /api/v1/auth/reset-password
     * Access: Public
     */
    resetPassword = this.asyncHandler(async (req, res) => {
        const { token, password } = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { token, password },
            ['token', 'password']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate password strength
        if (password.length < 8) {
            return this.sendBadRequest(res, 'Password must be at least 8 characters long');
        }

        try {
            await authService.resetPassword(token, password);
            return this.sendSuccess(res, null, 'Password reset successfully');
        } catch (error) {
            if (error.message.includes('Invalid') || 
                error.message.includes('expired')) {
                return this.sendBadRequest(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Change password (authenticated)
     * POST /api/v1/auth/change-password
     * Access: Authenticated users
     */
    changePassword = this.asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = this.getRequestBody(req);
        const userId = this.getUserId(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            { currentPassword, newPassword },
            ['currentPassword', 'newPassword']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return this.sendBadRequest(res, 'New password must be at least 8 characters long');
        }

        // Prevent same password
        if (currentPassword === newPassword) {
            return this.sendBadRequest(res, 'New password must be different from current password');
        }

        try {
            await authService.changePassword(userId, currentPassword, newPassword);
            return this.sendSuccess(res, null, 'Password changed successfully');
        } catch (error) {
            if (error.message.includes('Invalid') || 
                error.message.includes('Incorrect')) {
                return this.sendUnauthorized(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Refresh access token
     * POST /api/v1/auth/refresh-token
     * Access: Public (requires valid refresh token)
     */
    refreshToken = this.asyncHandler(async (req, res) => {
        const { refreshToken } = this.getRequestBody(req);

        if (!refreshToken) {
            return this.sendBadRequest(res, 'Refresh token is required');
        }

        try {
            const result = await authService.refreshToken(refreshToken);
            return this.sendSuccess(res, result, 'Token refreshed successfully');
        } catch (error) {
            if (error.message.includes('Invalid') || 
                error.message.includes('expired')) {
                return this.sendUnauthorized(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Logout user
     * POST /api/v1/auth/logout
     * Access: Authenticated users
     */
    logout = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);
        const { refreshToken } = this.getRequestBody(req);

        try {
            await authService.logout(userId, refreshToken);
            return this.sendSuccess(res, null, 'Logged out successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get current user profile
     * GET /api/v1/auth/me
     * Access: Authenticated users
     */
    getCurrentUser = this.asyncHandler(async (req, res) => {
        const userId = this.getUserId(req);

        try {
            const user = await authService.getCurrentUser(userId);
            return this.sendSuccess(res, this.sanitizeUser(user), 'User profile retrieved');
        } catch (error) {
            if (error.message.includes('not found')) {
                return this.sendNotFound(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Resend verification email
     * POST /api/v1/auth/resend-verification
     * Access: Public
     */
    resendVerification = this.asyncHandler(async (req, res) => {
        const { email } = this.getRequestBody(req);

        if (!email) {
            return this.sendBadRequest(res, 'Email is required');
        }

        if (!this.validateEmail(email)) {
            return this.sendBadRequest(res, 'Invalid email format');
        }

        try {
            await authService.resendVerificationEmail(email);
            return this.sendSuccess(
                res, 
                null, 
                'If an account exists with this email, a verification link has been sent'
            );
        } catch (error) {
            // Don't reveal if user exists
            return this.sendSuccess(
                res, 
                null, 
                'If an account exists with this email, a verification link has been sent'
            );
        }
    });
}

export default AuthController;
