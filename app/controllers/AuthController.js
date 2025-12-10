/**
 * AuthController
 * 
 * Handles authentication and authorization operations including:
 * - User and candidate registration
 * - Login and logout
 * - Email verification
 * - Password management (reset, change)
 * - Token refresh
 * 
 * @extends BaseController
 * @module controllers/AuthController
 * @version 2.0.0
 */

import BaseController from './BaseController.js';
import { authService } from '../services/index.js';

class AuthController extends BaseController {
    constructor() {
        super();
        this.authService = authService;
    }

    // ================================
    // USER AUTHENTICATION
    // ================================

    /**
     * Register new user
     * POST /api/v1/auth/register
     */
    async registerUser(req, res) {
        try {
            const metadata = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            };

            const result = await this.authService.registerUser(req.body, metadata);
            
            return this.sendSuccess(res, result.data, result.message, 201);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    /**
     * User login
     * POST /api/v1/auth/login
     */
    async loginUser(req, res) {
        try {
            const metadata = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            };

            const result = await this.authService.loginUser(
                req.body.email,
                req.body.password,
                metadata
            );
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 401);
        }
    }

    /**
     * Verify user email
     * POST /api/v1/auth/verify-email
     */
    async verifyUserEmail(req, res) {
        try {
            const { token } = req.body;
            
            const result = await this.authService.verifyUserEmail(token);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    // ================================
    // CANDIDATE AUTHENTICATION
    // ================================

    /**
     * Register new candidate
     * POST /api/v1/auth/candidate/register
     */
    async registerCandidate(req, res) {
        try {
            const metadata = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            };

            const result = await this.authService.registerCandidate(req.body, metadata);
            
            return this.sendSuccess(res, result.data, result.message, 201);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    /**
     * Candidate login
     * POST /api/v1/auth/candidate/login
     */
    async loginCandidate(req, res) {
        try {
            const metadata = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
            };

            const result = await this.authService.loginCandidate(
                req.body.email,
                req.body.password,
                metadata
            );
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 401);
        }
    }

    /**
     * Verify candidate email
     * POST /api/v1/auth/candidate/verify-email
     */
    async verifyCandidateEmail(req, res) {
        try {
            const { token } = req.body;
            
            const result = await this.authService.verifyCandidateEmail(token);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    /**
     * Approve candidate (admin only)
     * POST /api/v1/auth/candidate/:candidateId/approve
     */
    async approveCandidate(req, res) {
        try {
            const { candidateId } = req.params;
            const approverId = req.user.userId;

            const result = await this.authService.approveCandidate(candidateId, approverId);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    // ================================
    // PASSWORD MANAGEMENT
    // ================================

    /**
     * Request password reset
     * POST /api/v1/auth/password/reset-request
     */
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            
            const result = await this.authService.requestPasswordReset(email);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    /**
     * Reset password with token
     * POST /api/v1/auth/password/reset
     */
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            
            const result = await this.authService.resetPassword(token, newPassword);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    /**
     * Change password (authenticated user)
     * POST /api/v1/auth/password/change
     */
    async changePassword(req, res) {
        try {
            const userId = req.user.userId;
            const { currentPassword, newPassword } = req.body;
            
            const result = await this.authService.changePassword(
                userId,
                currentPassword,
                newPassword
            );
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    // ================================
    // TOKEN MANAGEMENT
    // ================================

    /**
     * Refresh access token
     * POST /api/v1/auth/token/refresh
     */
    async refreshAccessToken(req, res) {
        try {
            const { refreshToken } = req.body;
            
            const result = await this.authService.refreshAccessToken(refreshToken);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 401);
        }
    }

    /**
     * Verify token validity
     * POST /api/v1/auth/token/verify
     */
    async verifyToken(req, res) {
        try {
            const { token } = req.body;
            
            const result = await this.authService.verifyToken(token);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 401);
        }
    }

    /**
     * Logout (client-side token removal)
     * POST /api/v1/auth/logout
     */
    async logout(req, res) {
        try {
            // In a stateless JWT system, logout is primarily client-side
            // Server can optionally blacklist tokens or log the action
            
            return this.sendSuccess(res, null, 'Logged out successfully');
        } catch (error) {
            return this.sendError(res, error.message, 400);
        }
    }

    /**
     * Get current authenticated user
     * GET /api/v1/auth/me
     */
    async getCurrentUser(req, res) {
        try {
            const userId = req.user.userId;
            
            // Get user from repository (through auth service)
            const result = await this.authService.getCurrentUser(userId);
            
            return this.sendSuccess(res, result.data, result.message);
        } catch (error) {
            return this.sendError(res, error.message, 404);
        }
    }
}

export default new AuthController();
