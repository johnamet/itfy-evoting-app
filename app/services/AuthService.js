#!/usr/bin/env node
/**
 * Authentication Service
 * 
 * Handles user and candidate authentication with:
 * - Registration and login for both users and candidates
 * - Email verification with 3-day reminder system using Redis
 * - Password reset flows with Redis token storage
 * - Token management (access & refresh tokens) via AuthHelpers
 * - Account locking after failed attempts using Redis
 * - Multi-device tracking and token blacklisting
 * 
 * @module services/AuthService
 * @version 3.0.0
 */

import BaseService from './BaseService.js';
import config from '../config/ConfigManager.js';
import emailService from './EmailService.js';
import { emailQueue } from '../config/queue.js';
import AuthHelpers from '../utils/authHelpers.js';

class AuthService extends BaseService {
    constructor(repositories) {
        super(repositories);
        
        this.MAX_LOGIN_ATTEMPTS = config.get('security.maxLoginAttempts', 5);
        this.ACCOUNT_LOCK_DURATION = config.get('security.accountLockDuration', 15); // minutes
        this.EMAIL_VERIFICATION_DAYS = 3;
    }

    // ================================
    // USER AUTHENTICATION
    // ================================

    /**
     * Register new user
     * @param {Object} userData - { email, password, level, firstName, lastName }
     * @param {Object} [metadata={}] - { ip, userAgent }
     * @returns {Promise<Object>}
     */
    async registerUser(userData, metadata = {}) {
        return this.runInContext({ action: 'registerUser' }, async () => {
            try {
                this.validateRequiredFields(userData, ['email', 'password']);

                // Validate email format
                if (!this.validateEmail(userData.email)) {
                    throw new Error('Invalid email format');
                }

                // Validate password strength
                const passwordValidation = this.validatePassword(userData.password);
                if (!passwordValidation.valid) {
                    throw new Error(passwordValidation.errors.join(', '));
                }

                // Check for existing user
                const existingUser = await this.repo('user').findByEmail(userData.email);
                if (existingUser) {
                    throw new Error('Email already registered');
                }

                // Hash password using AuthHelpers
                const hashedPassword = await AuthHelpers.hashPassword(userData.password);

                // Create user
                const user = await this.repo('user').createUser({
                    email: userData.email,
                    password: hashedPassword,
                    level: userData.level || 1,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    emailVerified: false,
                    active: true
                });

                // Generate and store verification token using AuthHelpers
                const verificationToken = await AuthHelpers.generateAndStoreVerificationToken(
                    user._id.toString(),
                    user.email,
                    false
                );
                const verificationUrl = `${config.get('app.url')}/verify-email?token=${verificationToken}`;

                // Queue welcome + verification email
                await emailQueue.add('send-welcome-email', {
                    email: user.email,
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                    verificationUrl
                });

                // Schedule 3-day reminder if not verified
                await this.scheduleVerificationReminder(user._id, user.email, verificationToken);

                // Generate tokens using AuthHelpers
                const tokens = AuthHelpers.generateAuthTokens(
                    user._id.toString(),
                    user.email,
                    user.level,
                    user.role
                );

                // Store refresh token in Redis
                await AuthHelpers.storeRefreshToken(user._id.toString(), tokens.refreshToken);

                // Log activity
                await this.logActivity(user._id, 'user_registered', 'User', metadata);

                return this.handleSuccess({
                    user: this.sanitizeUser(user),
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    message: 'Registration successful. Please verify your email.'
                });
            } catch (error) {
                return this.handleError(error, 'User registration failed');
            }
        });
    }

    /**
     * Login user
     * @param {Object} credentials - { email, password }
     * @param {Object} [metadata={}] - { ip, userAgent }
     * @returns {Promise<Object>}
     */
    async loginUser(credentials, metadata = {}) {
        return this.runInContext({ action: 'loginUser' }, async () => {
            try {
                this.validateRequiredFields(credentials, ['email', 'password']);

                // Check if account is locked using AuthHelpers
                const isLocked = await AuthHelpers.isAccountLocked(credentials.email, this.MAX_LOGIN_ATTEMPTS);
                if (isLocked) {
                    throw new Error(`Account temporarily locked. Please try again in ${this.ACCOUNT_LOCK_DURATION} minutes.`);
                }

                const user = await this.repo('user').findByEmailWithPassword(credentials.email, { skipCache: true });

                // Constant-time comparison to prevent timing attacks
                const passwordHash = user?.password || '$2b$10$X/invalid/hash/that/will/never/match';
                const isValid = await AuthHelpers.comparePassword(credentials.password, passwordHash);

                if (!user || !isValid) {
                    await AuthHelpers.recordFailedLogin(credentials.email);
                    throw new Error('Invalid email or password');
                }

                // Check if account is active
                if (!user.active) {
                    throw new Error('Account is disabled');
                }

                // Clear failed login attempts on successful login
                await AuthHelpers.clearFailedLoginAttempts(credentials.email);

                // Update last login
                await this.repo('user').updateById(user._id, {
                    lastLogin: new Date()
                });

                // Generate tokens using AuthHelpers
                const tokens = AuthHelpers.generateAuthTokens(
                    user._id.toString(),
                    user.email,
                    user.level,
                    user.role
                );

                // Store refresh token in Redis
                await AuthHelpers.storeRefreshToken(user._id.toString(), tokens.refreshToken);

                // Log activity
                await this.logActivity(user._id, 'user_login', 'User', metadata);

                // Send warning if email not verified
                const message = !user.emailVerified 
                    ? 'Login successful. Please verify your email to access all features.'
                    : 'Login successful';

                return this.handleSuccess({
                    user: this.sanitizeUser(user),
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    message
                });
            } catch (error) {
                return this.handleError(error, 'Login failed');
            }
        });
    }

    // ================================
    // CANDIDATE AUTHENTICATION
    // ================================

    /**
     * Register candidate (typically done by event manager)
     * @param {Object} candidateData - Candidate information
     * @returns {Promise<Object>}
     */
    async registerCandidate(candidateData) {
        return this.runInContext({ action: 'registerCandidate' }, async () => {
            try {
                this.validateRequiredFields(candidateData, ['name', 'email', 'event']);

                // Check for existing candidate
                const existing = await this.repo('candidate').findOne({
                    email: candidateData.email,
                    event: candidateData.event
                });

                if (existing) {
                    throw new Error('Candidate already registered for this event');
                }

                // Generate temporary password using AuthHelpers
                const tempPassword = AuthHelpers.generateTempPassword();
                const hashedPassword = await AuthHelpers.hashPassword(tempPassword);

                // Create candidate
                const candidate = await this.repo('candidate').create({
                    ...candidateData,
                    password: hashedPassword,
                    status: 'pending',
                    emailVerified: false
                });

                return this.handleSuccess({
                    candidate: this.sanitizeCandidate(candidate),
                    tempPassword, // Send this securely to the candidate
                    message: 'Candidate registered. Awaiting approval.'
                });
            } catch (error) {
                return this.handleError(error, 'Candidate registration failed');
            }
        });
    }

    /**
     * Approve candidate and send verification email
     * @param {string} candidateId - Candidate ID
     * @returns {Promise<Object>}
     */
    async approveCandidate(candidateId) {
        return this.runInContext({ action: 'approveCandidate' }, async () => {
            try {
                const candidate = await this.repo('candidate').findById(candidateId);
                if (!candidate) {
                    throw new Error('Candidate not found');
                }

                const event = await this.repo('event').findById(candidate.event);
                if (!event) {
                    throw new Error('Event not found');
                }

                // Update status
                await this.repo('candidate').updateById(candidateId, {
                    status: 'approved',
                    approvedAt: new Date()
                });

                // Generate and store verification token using AuthHelpers
                const verificationToken = await AuthHelpers.generateAndStoreVerificationToken(
                    candidate._id.toString(),
                    candidate.email,
                    true
                );
                const verificationUrl = `${config.get('app.url')}/candidate/verify-email?token=${verificationToken}`;

                // Send approval email with verification link
                await emailService.sendCandidateApprovedEmail({
                    email: candidate.email,
                    name: candidate.name,
                    eventName: event.title,
                    verificationUrl
                });

                // Schedule 3-day verification reminder
                await this.scheduleVerificationReminder(candidateId, candidate.email, verificationToken, 'candidate');

                return this.handleSuccess({
                    message: 'Candidate approved and verification email sent'
                });
            } catch (error) {
                return this.handleError(error, 'Candidate approval failed');
            }
        });
    }

    /**
     * Login candidate
     * @param {Object} credentials - { email, password, eventId }
     * @param {Object} [metadata={}] - { ip, userAgent }
     * @returns {Promise<Object>}
     */
    async loginCandidate(credentials, metadata = {}) {
        return this.runInContext({ action: 'loginCandidate' }, async () => {
            try {
                this.validateRequiredFields(credentials, ['email', 'password']);

                // Check if account is locked using AuthHelpers
                const isLocked = await AuthHelpers.isAccountLocked(credentials.email, this.MAX_LOGIN_ATTEMPTS);
                if (isLocked) {
                    throw new Error(`Account temporarily locked. Please try again in ${this.ACCOUNT_LOCK_DURATION} minutes.`);
                }

                const candidate = await this.repo('candidate').findOne({
                    email: credentials.email,
                    ...(credentials.eventId && { event: credentials.eventId })
                }, { skipCache: true });

                if (!candidate) {
                    await AuthHelpers.recordFailedLogin(credentials.email);
                    throw new Error('Invalid credentials');
                }

                const isValid = await AuthHelpers.comparePassword(credentials.password, candidate.password);
                if (!isValid) {
                    await AuthHelpers.recordFailedLogin(credentials.email);
                    throw new Error('Invalid credentials');
                }

                // Check if approved
                if (candidate.status !== 'approved') {
                    throw new Error('Candidate not approved yet');
                }

                // Clear failed login attempts
                await AuthHelpers.clearFailedLoginAttempts(credentials.email);

                // Update last login
                await this.repo('candidate').updateById(candidate._id, {
                    lastLogin: new Date()
                });

                // Generate tokens using AuthHelpers
                const accessToken = AuthHelpers.generateCandidateAccessToken(
                    candidate._id.toString(),
                    candidate.email,
                    candidate.event.toString()
                );
                const refreshToken = AuthHelpers.generateRefreshToken(
                    candidate._id.toString(),
                    candidate.email
                );

                // Store refresh token in Redis
                await AuthHelpers.storeRefreshToken(candidate._id.toString(), refreshToken);

                const message = !candidate.emailVerified
                    ? 'Login successful. Please verify your email.'
                    : 'Login successful';

                return this.handleSuccess({
                    candidate: this.sanitizeCandidate(candidate),
                    accessToken,
                    refreshToken,
                    message
                });
            } catch (error) {
                return this.handleError(error, 'Candidate login failed');
            }
        });
    }

    // ================================
    // EMAIL VERIFICATION
    // ================================

    /**
     * Verify user email
     * @param {string} token - Verification token
     * @returns {Promise<Object>}
     */
    async verifyUserEmail(token) {
        return this.runInContext({ action: 'verifyUserEmail' }, async () => {
            try {
                // Validate token using AuthHelpers
                const payload = await AuthHelpers.validateVerificationToken(token);

                const user = await this.repo('user').findById(payload.sub);
                if (!user) {
                    throw new Error('User not found');
                }

                if (user.emailVerified) {
                    return this.handleSuccess({ message: 'Email already verified' });
                }

                await this.repo('user').updateById(user._id, {
                    emailVerified: true,
                    emailVerifiedAt: new Date()
                });

                // Cancel scheduled reminder
                await this.cancelVerificationReminder(user._id);

                // Delete verification token from Redis
                await AuthHelpers.deleteVerificationToken(user._id.toString());

                return this.handleSuccess({ message: 'Email verified successfully' });
            } catch (error) {
                return this.handleError(error, 'Email verification failed');
            }
        });
    }

    /**
     * Verify candidate email
     * @param {string} token - Verification token
     * @param {string} [password] - Password (required for nominees setting up account)
     * @param {Object} [metadata={}] - { ip, userAgent }
     * @returns {Promise<Object>}
     */
    async verifyCandidateEmail(token, password = null, metadata = {}) {
        return this.runInContext({ action: 'verifyCandidateEmail' }, async () => {
            try {
                // Validate token using AuthHelpers
                const payload = await AuthHelpers.validateVerificationToken(token);
                
                if (payload.type !== 'candidate-email-verification') {
                    throw new Error('Invalid candidate verification token');
                }

                const candidate = await this.repo('candidate').findById(payload.sub);
                if (!candidate) {
                    throw new Error('Candidate not found');
                }

                if (candidate.emailVerified) {
                    // If already verified, just return success (idempotent)
                    return this.handleSuccess({ 
                        message: 'Email already verified',
                        candidate: this.sanitizeCandidate(candidate)
                    });
                }

                // Check if this is a nominated candidate requiring password setup
                const isNominee = candidate.status === 'awaiting_verification';
                
                if (isNominee && !password) {
                    throw new Error('Password is required for nominee account setup');
                }

                // Validate password strength for nominees
                if (isNominee && password) {
                    const passwordValidation = this.validatePassword(password);
                    if (!passwordValidation.valid) {
                        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
                    }
                }

                // Update candidate record
                const updateData = {
                    emailVerified: true,
                    emailVerifiedAt: new Date()
                };

                // Hash password for nominees
                if (isNominee && password) {
                    updateData.password = await AuthHelpers.hashPassword(password);
                    updateData.status = 'verified'; // Transition from awaiting_verification to verified
                    updateData.verification = {
                        status: 'verified',
                        verifiedAt: new Date(),
                        method: 'email'
                    };
                }

                const updatedCandidate = await this.repo('candidate').updateById(candidate._id, updateData);

                // Cancel scheduled reminder
                await this.cancelVerificationReminder(candidate._id, 'candidate');

                // Delete verification token from Redis
                await AuthHelpers.deleteVerificationToken(candidate._id.toString());

                // Calculate initial profile completion for nominees
                if (isNominee) {
                    const completionPercentage = updatedCandidate.calculateProfileCompletion();
                    
                    // Queue welcome email with profile completion instructions
                    await emailQueue.add('send-welcome-email', {
                        email: updatedCandidate.email,
                        name: updatedCandidate.name,
                        profileCompletionPercentage: completionPercentage,
                        isNominee: true,
                        verificationUrl: null // Already verified
                    });

                    // Log activity
                    await this.logActivity(
                        updatedCandidate._id,
                        'nominee_verified',
                        'Candidate',
                        metadata
                    );

                    // Generate tokens for immediate login
                    const tokens = AuthHelpers.generateAuthTokens(
                        updatedCandidate._id.toString(),
                        updatedCandidate.email,
                        null, // No level for candidates
                        null, // No role for candidates
                        true  // isCandidate flag
                    );

                    // Store refresh token in Redis
                    await AuthHelpers.storeRefreshToken(
                        updatedCandidate._id.toString(),
                        tokens.refreshToken,
                        'candidate'
                    );

                    return this.handleSuccess({
                        message: 'Email verified and account activated successfully',
                        candidate: this.sanitizeCandidate(updatedCandidate),
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        profileCompletion: completionPercentage
                    });
                }

                // Standard verification for self-registered candidates
                return this.handleSuccess({ 
                    message: 'Email verified successfully',
                    candidate: this.sanitizeCandidate(updatedCandidate)
                });
            } catch (error) {
                return this.handleError(error, 'Email verification failed');
            }
        });
    }

    /**
     * Resend verification email
     * @param {string} email - User email
     * @param {string} [type='user'] - 'user' or 'candidate'
     * @returns {Promise<Object>}
     */
    async resendVerification(email, type = 'user') {
        return this.runInContext({ action: 'resendVerification' }, async () => {
            try {
                const repo = type === 'user' ? this.repo('user') : this.repo('candidate');
                const entity = await repo.findOne({ email }, { skipCache: true });

                if (!entity) {
                    // Return success to prevent email enumeration
                    return this.handleSuccess({ message: 'If an account exists, verification email sent' });
                }

                if (entity.emailVerified) {
                    return this.handleSuccess({ message: 'Email already verified' });
                }

                // Generate and store verification token using AuthHelpers
                const isCandidate = type === 'candidate';
                const verificationToken = await AuthHelpers.generateAndStoreVerificationToken(
                    entity._id.toString(),
                    entity.email,
                    isCandidate
                );
                const verificationUrl = `${config.get('app.url')}/${type}/verify-email?token=${verificationToken}`;

                await emailService.sendVerificationEmail({
                    email: entity.email,
                    name: entity.name || `${entity.firstName || ''} ${entity.lastName || ''}`.trim(),
                    verificationUrl
                });

                return this.handleSuccess({ message: 'If an account exists, verification email sent' });
            } catch (error) {
                return this.handleError(error, 'Resend verification failed');
            }
        });
    }

    /**
     * Schedule 3-day verification reminder
     * @private
     */
    async scheduleVerificationReminder(entityId, email, verificationToken, type = 'user') {
        try {
            const delay = this.EMAIL_VERIFICATION_DAYS * 24 * 60 * 60 * 1000; // 3 days in ms
            
            await emailQueue.add(
                'send-verification-reminder',
                {
                    entityId,
                    email,
                    verificationToken,
                    type,
                    daysRemaining: 0
                },
                {
                    delay,
                    jobId: `verification-reminder-${type}-${entityId}`
                }
            );

            // Schedule status revert for candidates (set back to pending if not verified)
            if (type === 'candidate') {
                await emailQueue.add(
                    'revert-candidate-status',
                    { candidateId: entityId },
                    {
                        delay,
                        jobId: `revert-status-${entityId}`
                    }
                );
            }
        } catch (error) {
            this.log('error', `Failed to schedule verification reminder: ${error.message}`);
        }
    }

    /**
     * Cancel verification reminder
     * @private
     */
    async cancelVerificationReminder(entityId, type = 'user') {
        try {
            const job = await emailQueue.getJob(`verification-reminder-${type}-${entityId}`);
            if (job) {
                await job.remove();
            }

            if (type === 'candidate') {
                const revertJob = await emailQueue.getJob(`revert-status-${entityId}`);
                if (revertJob) {
                    await revertJob.remove();
                }
            }
        } catch (error) {
            this.log('error', `Failed to cancel verification reminder: ${error.message}`);
        }
    }

    // ================================
    // PASSWORD MANAGEMENT
    // ================================

    /**
     * Request password reset
     * @param {string} email - User email
     * @param {string} [type='user'] - 'user' or 'candidate'
     * @returns {Promise<Object>}
     */
    async requestPasswordReset(email, type = 'user') {
        return this.runInContext({ action: 'requestPasswordReset' }, async () => {
            try {
                const repo = type === 'user' ? this.repo('user') : this.repo('candidate');
                const entity = await repo.findOne({ email });

                if (!entity) {
                    // Return success to prevent email enumeration
                    return this.handleSuccess({ message: 'If an account exists, reset email sent' });
                }

                // Generate and store reset token using AuthHelpers
                const resetToken = await AuthHelpers.generateAndStoreResetToken(
                    entity._id.toString(),
                    entity.email
                );
                const resetUrl = `${config.get('app.url')}/${type}/reset-password?token=${resetToken}`;

                await emailService.sendPasswordResetEmail({
                    email: entity.email,
                    name: entity.name || `${entity.firstName || ''} ${entity.lastName || ''}`.trim(),
                    resetUrl
                });

                return this.handleSuccess({ message: 'If an account exists, reset email sent' });
            } catch (error) {
                return this.handleError(error, 'Password reset request failed');
            }
        });
    }

    /**
     * Reset password
     * @param {string} token - Reset token
     * @param {string} newPassword - New password
     * @param {string} [type='user'] - 'user' or 'candidate'
     * @returns {Promise<Object>}
     */
    async resetPassword(token, newPassword, type = 'user') {
        return this.runInContext({ action: 'resetPassword' }, async () => {
            try {
                // Validate reset token using AuthHelpers
                const payload = await AuthHelpers.validateResetToken(token);

                // Validate new password
                const passwordValidation = this.validatePassword(newPassword);
                if (!passwordValidation.valid) {
                    throw new Error(passwordValidation.errors.join(', '));
                }

                const repo = type === 'user' ? this.repo('user') : this.repo('candidate');
                const entity = await repo.findById(payload.sub);
                
                if (!entity) {
                    throw new Error('Account not found');
                }

                // Hash new password using AuthHelpers
                const hashedPassword = await AuthHelpers.hashPassword(newPassword);

                await repo.updateById(entity._id, {
                    password: hashedPassword,
                    loginAttempts: 0,
                    lockedUntil: null
                });

                // Delete reset token and all refresh tokens for security
                await AuthHelpers.deleteResetToken(entity._id.toString());
                await AuthHelpers.deleteAllRefreshTokens(entity._id.toString());

                // Blacklist all existing tokens for security
                await AuthHelpers.blacklistAllUserTokens(entity._id.toString());

                // Send confirmation email
                await emailService.sendPasswordChangedEmail({
                    email: entity.email,
                    name: entity.name || `${entity.firstName || ''} ${entity.lastName || ''}`.trim()
                });

                return this.handleSuccess({ message: 'Password reset successful' });
            } catch (error) {
                return this.handleError(error, 'Password reset failed');
            }
        });
    }

    /**
     * Change password (for authenticated users)
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @param {string} [type='user'] - 'user' or 'candidate'
     * @returns {Promise<Object>}
     */
    async changePassword(userId, currentPassword, newPassword, type = 'user') {
        return this.runInContext({ action: 'changePassword' }, async () => {
            try {
                const repo = type === 'user' ? this.repo('user') : this.repo('candidate');
                const entity = await repo.findById(userId, { skipCache: true });

                if (!entity) {
                    throw new Error('Account not found');
                }

                // Verify current password using AuthHelpers
                const isValid = await AuthHelpers.comparePassword(currentPassword, entity.password);
                if (!isValid) {
                    throw new Error('Current password is incorrect');
                }

                // Check if new password is different
                const isSame = await AuthHelpers.comparePassword(newPassword, entity.password);
                if (isSame) {
                    throw new Error('New password must be different from current password');
                }

                // Validate new password
                const passwordValidation = this.validatePassword(newPassword);
                if (!passwordValidation.valid) {
                    throw new Error(passwordValidation.errors.join(', '));
                }

                // Hash and update using AuthHelpers
                const hashedPassword = await AuthHelpers.hashPassword(newPassword);
                await repo.updateById(userId, { password: hashedPassword });

                // Delete all refresh tokens for security
                await AuthHelpers.deleteAllRefreshTokens(userId.toString());

                return this.handleSuccess({ message: 'Password changed successfully' });
            } catch (error) {
                return this.handleError(error, 'Password change failed');
            }
        });
    }

    // ================================
    // TOKEN MANAGEMENT (Delegated to AuthHelpers)
    // ================================
    // All token generation, verification, and management now handled by AuthHelpers utility

    /**
     * Refresh access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>}
     */
    async refreshAccessToken(refreshToken) {
        return this.runInContext({ action: 'refreshAccessToken' }, async () => {
            try {
                // Verify token using AuthHelpers
                const payload = AuthHelpers.verifyToken(refreshToken);

                if (payload.type !== 'refresh') {
                    throw new Error('Invalid refresh token');
                }

                // Check if token is blacklisted
                const isBlacklisted = await AuthHelpers.isTokenBlacklisted(refreshToken);
                if (isBlacklisted) {
                    throw new Error('Token has been revoked');
                }

                // Validate stored refresh token
                const storedToken = await AuthHelpers.getStoredRefreshToken(payload.sub);
                if (storedToken !== refreshToken) {
                    throw new Error('Invalid refresh token');
                }

                // Check if user/candidate exists and is active
                const isCandidate = !!payload.cId;
                const repo = isCandidate ? this.repo('candidate') : this.repo('user');
                const entity = await repo.findById(payload.sub);

                if (!entity) {
                    throw new Error('Account not found');
                }

                if (!isCandidate && !entity.active) {
                    throw new Error('Account is disabled');
                }

                // Generate new access token using AuthHelpers
                const accessToken = isCandidate
                    ? AuthHelpers.generateCandidateAccessToken(
                        entity._id.toString(),
                        entity.email,
                        entity.event.toString()
                      )
                    : AuthHelpers.generateUserAccessToken(
                        entity._id.toString(),
                        entity.email,
                        entity.level,
                        entity.role
                      );

                return this.handleSuccess({
                    accessToken,
                    refreshToken
                });
            } catch (error) {
                return this.handleError(error, 'Token refresh failed');
            }
        });
    }

    // ================================
    // SECURITY HELPERS (Delegated to AuthHelpers)
    // ================================
    // All login attempt tracking, rate limiting, and account locking now handled by AuthHelpers utility using Redis
    // generateTempPassword is also available in AuthHelpers

    /**
     * Sanitize user object (remove sensitive data)
     * @private
     */
    sanitizeUser(user) {
        const { password, loginAttempts, lockedUntil, ...safe } = user.toObject ? user.toObject() : user;
        return safe;
    }

    /**
     * Sanitize candidate object
     * @private
     */
    sanitizeCandidate(candidate) {
        const { password, ...safe } = candidate.toObject ? candidate.toObject() : candidate;
        return safe;
    }
}

export default AuthService;
