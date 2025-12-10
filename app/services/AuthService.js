#!/usr/bin/env node
/**
 * Authentication Service
 * 
 * Handles user and candidate authentication with:
 * - Registration and login for both users and candidates
 * - Email verification with 3-day reminder system
 * - Password reset flows
 * - Token management (access & refresh tokens)
 * - Account locking after failed attempts
 * - Multi-device tracking
 * 
 * @module services/AuthService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/ConfigManager.js';
import emailService from './EmailService.js';
import { emailQueue } from '../config/queue.js';

class AuthService extends BaseService {
    constructor(repositories) {
        super(repositories);
        
        this.JWT_SECRET = config.get('jwt.secret');
        this.JWT_EXPIRES_IN = config.get('jwt.expiresIn') || '24h';
        this.JWT_REFRESH_EXPIRES_IN = config.get('jwt.refreshExpiresIn') || '7d';
        this.JWT_ISSUER = config.get('jwt.issuer') || 'itfy-evoting';
        this.JWT_AUDIENCE = config.get('jwt.audience') || 'itfy-evoting-users';
        
        this.MAX_LOGIN_ATTEMPTS = 5;
        this.ACCOUNT_LOCK_DURATION = 15; // minutes
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

                // Hash password
                const hashedPassword = await bcrypt.hash(
                    userData.password,
                    await this.getSetting('security.bcrypt.rounds', 10)
                );

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

                // Generate verification token
                const verificationToken = this.generateToken(user._id, user.email, 'email-verification', '7d');
                const verificationUrl = `${config.get('app.url')}/verify-email?token=${verificationToken}`;

                // Queue welcome + verification email
                await emailQueue.add('send-welcome-email', {
                    email: user.email,
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                    verificationUrl
                });

                // Schedule 3-day reminder if not verified
                await this.scheduleVerificationReminder(user._id, user.email, verificationToken);

                // Generate tokens
                const { accessToken, refreshToken } = this.generateAuthTokens(user);

                // Log activity
                await this.logActivity(user._id, 'user_registered', 'User', metadata);

                return this.handleSuccess({
                    user: this.sanitizeUser(user),
                    accessToken,
                    refreshToken,
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

                // Rate limiting check
                await this.checkLoginRateLimit(credentials.email, metadata.ip);

                const user = await this.repo('user').findByEmailWithPassword(credentials.email, { skipCache: true });

                // Constant-time comparison to prevent timing attacks
                const passwordHash = user?.password || '$2b$10$X/invalid/hash/that/will/never/match';
                const isValid = await bcrypt.compare(credentials.password, passwordHash);

                if (!user) {
                    await this.incrementLoginAttempts(credentials.email, metadata.ip);
                    throw new Error('Invalid email or password');
                }

                // Check account lock
                if (user.lockedUntil && user.lockedUntil > new Date()) {
                    const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
                    throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
                }

                if (!isValid) {
                    await this.handleFailedLogin(user._id);
                    await this.incrementLoginAttempts(credentials.email, metadata.ip);
                    throw new Error('Invalid email or password');
                }

                // Check if account is active
                if (!user.active) {
                    throw new Error('Account is disabled');
                }

                // Reset failed attempts
                if (user.loginAttempts > 0) {
                    await this.repo('user').updateById(user._id, {
                        loginAttempts: 0,
                        lockedUntil: null
                    });
                }

                // Update last login
                await this.repo('user').updateById(user._id, {
                    lastLogin: new Date()
                });

                // Generate tokens
                const { accessToken, refreshToken } = this.generateAuthTokens(user);

                // Log activity
                await this.logActivity(user._id, 'user_login', 'User', metadata);

                // Send warning if email not verified
                const message = !user.emailVerified 
                    ? 'Login successful. Please verify your email to access all features.'
                    : 'Login successful';

                return this.handleSuccess({
                    user: this.sanitizeUser(user),
                    accessToken,
                    refreshToken,
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

                // Generate temporary password
                const tempPassword = this.generateTempPassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

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

                // Generate verification token
                const verificationToken = this.generateToken(candidate._id, candidate.email, 'candidate-email-verification', '7d');
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

                const candidate = await this.repo('candidate').findOne({
                    email: credentials.email,
                    ...(credentials.eventId && { event: credentials.eventId })
                }, { skipCache: true });

                if (!candidate) {
                    throw new Error('Invalid credentials');
                }

                const isValid = await bcrypt.compare(credentials.password, candidate.password);
                if (!isValid) {
                    throw new Error('Invalid credentials');
                }

                // Check if approved
                if (candidate.status !== 'approved') {
                    throw new Error('Candidate not approved yet');
                }

                // Update last login
                await this.repo('candidate').updateById(candidate._id, {
                    lastLogin: new Date()
                });

                // Generate tokens (with cId claim for candidates)
                const { accessToken, refreshToken } = this.generateCandidateTokens(candidate);

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
                const payload = this.verifyToken(token);
                
                if (payload.type !== 'email-verification') {
                    throw new Error('Invalid verification token');
                }

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

                return this.handleSuccess({ message: 'Email verified successfully' });
            } catch (error) {
                return this.handleError(error, 'Email verification failed');
            }
        });
    }

    /**
     * Verify candidate email
     * @param {string} token - Verification token
     * @returns {Promise<Object>}
     */
    async verifyCandidateEmail(token) {
        return this.runInContext({ action: 'verifyCandidateEmail' }, async () => {
            try {
                const payload = this.verifyToken(token);
                
                if (payload.type !== 'candidate-email-verification') {
                    throw new Error('Invalid verification token');
                }

                const candidate = await this.repo('candidate').findById(payload.sub);
                if (!candidate) {
                    throw new Error('Candidate not found');
                }

                if (candidate.emailVerified) {
                    return this.handleSuccess({ message: 'Email already verified' });
                }

                await this.repo('candidate').updateById(candidate._id, {
                    emailVerified: true,
                    emailVerifiedAt: new Date()
                });

                // Cancel scheduled reminder
                await this.cancelVerificationReminder(candidate._id, 'candidate');

                return this.handleSuccess({ message: 'Email verified successfully' });
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

                const tokenType = type === 'user' ? 'email-verification' : 'candidate-email-verification';
                const verificationToken = this.generateToken(entity._id, entity.email, tokenType, '7d');
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

                const resetToken = this.generateToken(entity._id, entity.email, 'password-reset', '1h');
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
                const payload = this.verifyToken(token);
                
                if (payload.type !== 'password-reset') {
                    throw new Error('Invalid reset token');
                }

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

                // Hash new password
                const hashedPassword = await bcrypt.hash(newPassword, 10);

                await repo.updateById(entity._id, {
                    password: hashedPassword,
                    loginAttempts: 0,
                    lockedUntil: null
                });

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

                // Verify current password
                const isValid = await bcrypt.compare(currentPassword, entity.password);
                if (!isValid) {
                    throw new Error('Current password is incorrect');
                }

                // Check if new password is different
                const isSame = await bcrypt.compare(newPassword, entity.password);
                if (isSame) {
                    throw new Error('New password must be different from current password');
                }

                // Validate new password
                const passwordValidation = this.validatePassword(newPassword);
                if (!passwordValidation.valid) {
                    throw new Error(passwordValidation.errors.join(', '));
                }

                // Hash and update
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                await repo.updateById(userId, { password: hashedPassword });

                return this.handleSuccess({ message: 'Password changed successfully' });
            } catch (error) {
                return this.handleError(error, 'Password change failed');
            }
        });
    }

    // ================================
    // TOKEN MANAGEMENT
    // ================================

    /**
     * Generate JWT token
     * @param {string} id - User/Candidate ID
     * @param {string} email - Email
     * @param {string} [type='access'] - Token type
     * @param {string} [expiresIn] - Expiration time
     * @returns {string} JWT token
     */
    generateToken(id, email, type = 'access', expiresIn = null) {
        const payload = {
            sub: id,
            email,
            type,
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: expiresIn || this.JWT_EXPIRES_IN,
            issuer: this.JWT_ISSUER,
            audience: this.JWT_AUDIENCE
        });
    }

    /**
     * Generate auth tokens for user
     * @param {Object} user - User object
     * @returns {Object} { accessToken, refreshToken }
     */
    generateAuthTokens(user) {
        const accessToken = jwt.sign(
            {
                sub: user._id.toString(),
                userId: user._id.toString(),
                email: user.email,
                level: user.level,
                role: user.role
            },
            this.JWT_SECRET,
            {
                expiresIn: this.JWT_EXPIRES_IN,
                issuer: this.JWT_ISSUER,
                audience: this.JWT_AUDIENCE
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: user._id.toString(),
                userId: user._id.toString(),
                type: 'refresh'
            },
            this.JWT_SECRET,
            {
                expiresIn: this.JWT_REFRESH_EXPIRES_IN,
                issuer: this.JWT_ISSUER,
                audience: this.JWT_AUDIENCE
            }
        );

        return { accessToken, refreshToken };
    }

    /**
     * Generate auth tokens for candidate
     * @param {Object} candidate - Candidate object
     * @returns {Object} { accessToken, refreshToken }
     */
    generateCandidateTokens(candidate) {
        const accessToken = jwt.sign(
            {
                sub: candidate._id.toString(),
                cId: candidate._id.toString(),
                candidateId: candidate._id.toString(),
                email: candidate.email,
                eventId: candidate.event
            },
            this.JWT_SECRET,
            {
                expiresIn: this.JWT_EXPIRES_IN,
                issuer: this.JWT_ISSUER,
                audience: this.JWT_AUDIENCE
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: candidate._id.toString(),
                cId: candidate._id.toString(),
                type: 'refresh'
            },
            this.JWT_SECRET,
            {
                expiresIn: this.JWT_REFRESH_EXPIRES_IN,
                issuer: this.JWT_ISSUER,
                audience: this.JWT_AUDIENCE
            }
        );

        return { accessToken, refreshToken };
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token
     * @returns {Object} Decoded payload
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.JWT_SECRET, {
                issuer: this.JWT_ISSUER,
                audience: this.JWT_AUDIENCE
            });
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Refresh access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>}
     */
    async refreshAccessToken(refreshToken) {
        return this.runInContext({ action: 'refreshAccessToken' }, async () => {
            try {
                const payload = this.verifyToken(refreshToken);

                if (payload.type !== 'refresh') {
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

                // Generate new tokens
                const tokens = isCandidate 
                    ? this.generateCandidateTokens(entity)
                    : this.generateAuthTokens(entity);

                return this.handleSuccess(tokens);
            } catch (error) {
                return this.handleError(error, 'Token refresh failed');
            }
        });
    }

    // ================================
    // SECURITY HELPERS
    // ================================

    /**
     * Check login rate limit
     * @private
     */
    async checkLoginRateLimit(email, ip) {
        const key = `login_attempts:${ip}:${email}`;
        
        if (this.hasRepo('settings')) {
            const attempts = await this.repo('settings').getValue(key);
            if (attempts && parseInt(attempts) >= this.MAX_LOGIN_ATTEMPTS) {
                throw new Error('Too many login attempts. Try again in 15 minutes.');
            }
        }
    }

    /**
     * Increment login attempts
     * @private
     */
    async incrementLoginAttempts(email, ip) {
        const key = `login_attempts:${ip}:${email}`;
        
        if (this.hasRepo('settings')) {
            const current = await this.repo('settings').getValue(key, 0);
            await this.repo('settings').upsertSetting({
                key,
                value: parseInt(current) + 1,
                category: 'security',
                expiresAt: this.addDays(new Date(), 0.01) // 15 minutes
            });
        }
    }

    /**
     * Handle failed login
     * @private
     */
    async handleFailedLogin(userId) {
        const user = await this.repo('user').findById(userId);
        const attempts = (user.loginAttempts || 0) + 1;

        const updates = { loginAttempts: attempts };

        if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
            updates.lockedUntil = new Date(Date.now() + this.ACCOUNT_LOCK_DURATION * 60000);
            
            // Send account locked email
            await emailService.sendAccountLockedEmail({
                email: user.email,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                duration: this.ACCOUNT_LOCK_DURATION
            });
        }

        await this.repo('user').updateById(userId, updates);
    }

    /**
     * Generate temporary password
     * @private
     */
    generateTempPassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

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
