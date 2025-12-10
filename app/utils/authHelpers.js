/**
 * Authentication Helper Utility
 * 
 * Handles JWT token generation/verification, password hashing, and token management.
 * Uses Redis for refresh token storage, token blacklisting, and verification tokens.
 * Compatible with ITFY E-Voting authentication system.
 * 
 * @module utils/authHelpers
 * @version 2.0.0
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import config from '../config/ConfigManager.js';
import redisClient from '../config/redis.js';

export class AuthHelpers {
    // ========================================
    // JWT TOKEN GENERATION
    // ========================================

    /**
     * Generate JWT token with configurable type and claims
     * @param {string} userId - User or candidate ID
     * @param {string} email - User email
     * @param {string} tokenType - 'access', 'refresh', 'email-verification', 'password-reset', 'candidate-email-verification'
     * @param {string} [expiresIn] - Custom expiration (e.g., '24h', '7d')
     * @param {Object} [additionalClaims] - Extra claims to include
     * @returns {string} JWT token
     */
    static generateToken(userId, email, tokenType = 'access', expiresIn = null, additionalClaims = {}) {
        try {
            const secret = config.get('jwt.secret');
            const issuer = config.get('jwt.issuer') || 'itfy-evoting';
            const audience = config.get('jwt.audience') || 'itfy-evoting-users';

            // Default expiration times
            const defaultExpirations = {
                'access': config.get('jwt.expiresIn') || '24h',
                'refresh': config.get('jwt.refreshExpiresIn') || '7d',
                'email-verification': '7d',
                'password-reset': '1h',
                'candidate-email-verification': '7d',
            };

            const expiry = expiresIn || defaultExpirations[tokenType] || '24h';

            const payload = {
                sub: userId,
                email,
                type: tokenType,
                iat: Math.floor(Date.now() / 1000),
                jti: crypto.randomBytes(16).toString('hex'),
                ...additionalClaims,
            };

            return jwt.sign(payload, secret, {
                expiresIn: expiry,
                issuer,
                audience,
                algorithm: 'HS256',
            });
        } catch (error) {
            throw new Error(`Token generation failed: ${error.message}`);
        }
    }

    /**
     * Generate access token for user
     * @param {string} userId
     * @param {string} email
     * @param {number} level - User level (1-4)
     * @param {string} role - User role
     * @returns {string}
     */
    static generateUserAccessToken(userId, email, level, role) {
        return this.generateToken(userId, email, 'access', null, {
            userId,
            level,
            role,
        });
    }

    /**
     * Generate access token for candidate
     * @param {string} candidateId
     * @param {string} email
     * @param {string} eventId
     * @returns {string}
     */
    static generateCandidateAccessToken(candidateId, email, eventId) {
        return this.generateToken(candidateId, email, 'access', null, {
            cId: candidateId,
            candidateId,
            eventId,
            role: 'candidate',
        });
    }

    /**
     * Generate refresh token
     * @param {string} userId
     * @param {string} email
     * @returns {string}
     */
    static generateRefreshToken(userId, email) {
        return this.generateToken(userId, email, 'refresh');
    }

    /**
     * Generate complete token set (access + refresh)
     * @param {string} userId
     * @param {string} email
     * @param {number} level
     * @param {string} role
     * @returns {Object} { accessToken, refreshToken }
     */
    static generateAuthTokens(userId, email, level, role) {
        return {
            accessToken: this.generateUserAccessToken(userId, email, level, role),
            refreshToken: this.generateRefreshToken(userId, email),
        };
    }

    /**
     * Generate email verification token
     * @param {string} userId
     * @param {string} email
     * @param {boolean} isCandidate
     * @returns {string}
     */
    static generateVerificationToken(userId, email, isCandidate = false) {
        const tokenType = isCandidate ? 'candidate-email-verification' : 'email-verification';
        return this.generateToken(userId, email, tokenType);
    }

    /**
     * Generate password reset token
     * @param {string} userId
     * @param {string} email
     * @returns {string}
     */
    static generatePasswordResetToken(userId, email) {
        return this.generateToken(userId, email, 'password-reset', '1h');
    }

    // ========================================
    // JWT TOKEN VERIFICATION
    // ========================================

    /**
     * Verify JWT token and return decoded payload
     * @param {string} token
     * @returns {Object} Decoded token payload
     */
    static verifyToken(token) {
        try {
            const secret = config.get('jwt.secret');
            const issuer = config.get('jwt.issuer') || 'itfy-evoting';
            const audience = config.get('jwt.audience') || 'itfy-evoting-users';

            return jwt.verify(token, secret, {
                issuer,
                audience,
                algorithms: ['HS256'],
                ignoreExpiration: false,
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }

    /**
     * Verify token type matches expected type
     * @param {string} token
     * @param {string} expectedType
     * @returns {Object} Decoded payload if type matches
     */
    static verifyTokenType(token, expectedType) {
        const decoded = this.verifyToken(token);
        
        if (decoded.type !== expectedType) {
            throw new Error(`Invalid token type. Expected ${expectedType}, got ${decoded.type}`);
        }

        return decoded;
    }

    /**
     * Decode token without verification (for debugging)
     * @param {string} token
     * @returns {Object|null}
     */
    static decodeToken(token) {
        try {
            return jwt.decode(token);
        } catch (error) {
            return null;
        }
    }

    // ========================================
    // PASSWORD MANAGEMENT
    // ========================================

    /**
     * Hash a plain password
     * @param {string} plainPassword
     * @returns {Promise<string>} Hashed password
     */
    static async hashPassword(plainPassword) {
        try {
            const saltRounds = config.get('security.bcrypt.rounds') || 10;
            return await bcrypt.hash(plainPassword, saltRounds);
        } catch (error) {
            throw new Error(`Password hashing failed: ${error.message}`);
        }
    }

    /**
     * Compare plain password with hash
     * @param {string} plainPassword
     * @param {string} hashedPassword
     * @returns {Promise<boolean>}
     */
    static async comparePassword(plainPassword, hashedPassword) {
        try {
            return await bcrypt.compare(plainPassword, hashedPassword);
        } catch (error) {
            throw new Error(`Password comparison failed: ${error.message}`);
        }
    }

    /**
     * Generate temporary password
     * @param {number} length - Password length (default: 12)
     * @returns {string}
     */
    static generateTempPassword(length = 12) {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        
        for (let i = 0; i < length; i++) {
            const randomIndex = crypto.randomInt(0, charset.length);
            password += charset[randomIndex];
        }
        
        return password;
    }

    // ========================================
    // REFRESH TOKEN MANAGEMENT (Redis)
    // ========================================

    /**
     * Store refresh token in Redis
     * @param {string} userId
     * @param {string} refreshToken
     * @returns {Promise<void>}
     */
    static async storeRefreshToken(userId, refreshToken) {
        try {
            const key = `refresh:${userId}`;
            const ttlSeconds = this._parseJwtExpiry(config.get('jwt.refreshExpiresIn') || '7d');
            
            await redisClient.setEx(key, ttlSeconds, refreshToken);
        } catch (error) {
            throw new Error(`Failed to store refresh token: ${error.message}`);
        }
    }

    /**
     * Get stored refresh token
     * @param {string} userId
     * @returns {Promise<string|null>}
     */
    static async getStoredRefreshToken(userId) {
        try {
            const key = `refresh:${userId}`;
            return await redisClient.get(key);
        } catch (error) {
            throw new Error(`Failed to get refresh token: ${error.message}`);
        }
    }

    /**
     * Delete refresh token (logout, password reset)
     * @param {string} userId
     * @returns {Promise<void>}
     */
    static async deleteRefreshToken(userId) {
        try {
            const key = `refresh:${userId}`;
            await redisClient.del(key);
        } catch (error) {
            throw new Error(`Failed to delete refresh token: ${error.message}`);
        }
    }

    /**
     * Store multiple device refresh tokens (for multi-device support)
     * @param {string} userId
     * @param {string} deviceId
     * @param {string} refreshToken
     * @returns {Promise<void>}
     */
    static async storeDeviceRefreshToken(userId, deviceId, refreshToken) {
        try {
            const key = `refresh:${userId}:${deviceId}`;
            const ttlSeconds = this._parseJwtExpiry(config.get('jwt.refreshExpiresIn') || '7d');
            
            await redisClient.setEx(key, ttlSeconds, refreshToken);
        } catch (error) {
            throw new Error(`Failed to store device refresh token: ${error.message}`);
        }
    }

    /**
     * Delete all refresh tokens for user (logout all devices)
     * @param {string} userId
     * @returns {Promise<void>}
     */
    static async deleteAllRefreshTokens(userId) {
        try {
            const pattern = `refresh:${userId}*`;
            const keys = await redisClient.keys(pattern);
            
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            throw new Error(`Failed to delete all refresh tokens: ${error.message}`);
        }
    }

    // ========================================
    // PASSWORD RESET TOKEN MANAGEMENT (Redis)
    // ========================================

    /**
     * Generate and store password reset token
     * @param {string} userId
     * @param {string} email
     * @returns {Promise<string>} Reset token
     */
    static async generateAndStoreResetToken(userId, email) {
        try {
            const resetToken = this.generatePasswordResetToken(userId, email);
            const key = `reset:${userId}`;
            const ttlSeconds = this._parseJwtExpiry('1h');

            await redisClient.setEx(key, ttlSeconds, resetToken);
            return resetToken;
        } catch (error) {
            throw new Error(`Failed to generate reset token: ${error.message}`);
        }
    }

    /**
     * Validate password reset token
     * @param {string} resetToken
     * @returns {Promise<Object>} Decoded token payload
     */
    static async validateResetToken(resetToken) {
        try {
            const decoded = this.verifyTokenType(resetToken, 'password-reset');
            const key = `reset:${decoded.sub}`;
            const storedToken = await redisClient.get(key);

            if (storedToken !== resetToken) {
                throw new Error('Invalid or expired reset token');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Reset token validation failed: ${error.message}`);
        }
    }

    /**
     * Delete password reset token (after use)
     * @param {string} userId
     * @returns {Promise<void>}
     */
    static async deleteResetToken(userId) {
        try {
            const key = `reset:${userId}`;
            await redisClient.del(key);
        } catch (error) {
            throw new Error(`Failed to delete reset token: ${error.message}`);
        }
    }

    // ========================================
    // EMAIL VERIFICATION TOKEN (Redis)
    // ========================================

    /**
     * Generate and store email verification token
     * @param {string} userId
     * @param {string} email
     * @param {boolean} isCandidate
     * @returns {Promise<string>} Verification token
     */
    static async generateAndStoreVerificationToken(userId, email, isCandidate = false) {
        try {
            const token = this.generateVerificationToken(userId, email, isCandidate);
            const key = `verify:${userId}`;
            const ttlSeconds = this._parseJwtExpiry('7d');

            await redisClient.setEx(key, ttlSeconds, token);
            return token;
        } catch (error) {
            throw new Error(`Failed to generate verification token: ${error.message}`);
        }
    }

    /**
     * Validate email verification token
     * @param {string} verificationToken
     * @returns {Promise<Object>} Decoded token payload
     */
    static async validateVerificationToken(verificationToken) {
        try {
            const decoded = this.verifyToken(verificationToken);
            
            if (!decoded.type.includes('verification')) {
                throw new Error('Invalid verification token');
            }

            const key = `verify:${decoded.sub}`;
            const storedToken = await redisClient.get(key);

            if (storedToken !== verificationToken) {
                throw new Error('Invalid or expired verification token');
            }

            return decoded;
        } catch (error) {
            throw new Error(`Verification token validation failed: ${error.message}`);
        }
    }

    /**
     * Delete verification token
     * @param {string} userId
     * @returns {Promise<void>}
     */
    static async deleteVerificationToken(userId) {
        try {
            const key = `verify:${userId}`;
            await redisClient.del(key);
        } catch (error) {
            throw new Error(`Failed to delete verification token: ${error.message}`);
        }
    }

    // ========================================
    // TOKEN BLACKLIST (Redis)
    // ========================================

    /**
     * Blacklist a token (for logout, security)
     * @param {string} token
     * @param {number} [ttlSeconds] - Time to keep in blacklist (default: token expiry)
     * @returns {Promise<void>}
     */
    static async blacklistToken(token, ttlSeconds = null) {
        try {
            const decoded = this.decodeToken(token);
            const key = `blacklist:${decoded.jti || token}`;
            
            // Calculate TTL based on token expiry if not provided
            const ttl = ttlSeconds || (decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 60 * 60);
            
            if (ttl > 0) {
                await redisClient.setEx(key, ttl, '1');
            }
        } catch (error) {
            throw new Error(`Failed to blacklist token: ${error.message}`);
        }
    }

    /**
     * Check if token is blacklisted
     * @param {string} token
     * @returns {Promise<boolean>}
     */
    static async isTokenBlacklisted(token) {
        try {
            const decoded = this.decodeToken(token);
            const key = `blacklist:${decoded.jti || token}`;
            const result = await redisClient.get(key);
            
            return result === '1';
        } catch (error) {
            console.warn('Blacklist check failed:', error.message);
            return false;
        }
    }

    /**
     * Blacklist all tokens for a user (security breach, password change)
     * @param {string} userId
     * @returns {Promise<void>}
     */
    static async blacklistAllUserTokens(userId) {
        try {
            const key = `blacklist:user:${userId}`;
            const ttlSeconds = 7 * 24 * 60 * 60; // 7 days
            
            await redisClient.setEx(key, ttlSeconds, Date.now().toString());
        } catch (error) {
            throw new Error(`Failed to blacklist user tokens: ${error.message}`);
        }
    }

    /**
     * Check if all user tokens are blacklisted
     * @param {string} userId
     * @param {number} tokenIat - Token issued at timestamp
     * @returns {Promise<boolean>}
     */
    static async areUserTokensBlacklisted(userId, tokenIat) {
        try {
            const key = `blacklist:user:${userId}`;
            const blacklistTime = await redisClient.get(key);
            
            if (!blacklistTime) return false;
            
            return parseInt(blacklistTime) > tokenIat * 1000;
        } catch (error) {
            console.warn('User blacklist check failed:', error.message);
            return false;
        }
    }

    // ========================================
    // LOGIN ATTEMPT TRACKING (Redis)
    // ========================================

    /**
     * Record failed login attempt
     * @param {string} identifier - Email or username
     * @returns {Promise<number>} Current attempt count
     */
    static async recordFailedLogin(identifier) {
        try {
            const key = `login:failed:${identifier}`;
            const attempts = await redisClient.incr(key);
            
            // Set expiry of 15 minutes on first attempt
            if (attempts === 1) {
                await redisClient.expire(key, 15 * 60);
            }
            
            return attempts;
        } catch (error) {
            throw new Error(`Failed to record login attempt: ${error.message}`);
        }
    }

    /**
     * Get failed login attempt count
     * @param {string} identifier
     * @returns {Promise<number>}
     */
    static async getFailedLoginAttempts(identifier) {
        try {
            const key = `login:failed:${identifier}`;
            const attempts = await redisClient.get(key);
            
            return parseInt(attempts) || 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Clear failed login attempts
     * @param {string} identifier
     * @returns {Promise<void>}
     */
    static async clearFailedLoginAttempts(identifier) {
        try {
            const key = `login:failed:${identifier}`;
            await redisClient.del(key);
        } catch (error) {
            throw new Error(`Failed to clear login attempts: ${error.message}`);
        }
    }

    /**
     * Check if account is locked due to failed attempts
     * @param {string} identifier
     * @param {number} maxAttempts - Default: 5
     * @returns {Promise<boolean>}
     */
    static async isAccountLocked(identifier, maxAttempts = 5) {
        try {
            const attempts = await this.getFailedLoginAttempts(identifier);
            return attempts >= maxAttempts;
        } catch (error) {
            return false;
        }
    }

    // ========================================
    // PRIVATE HELPER METHODS
    // ========================================

    /**
     * Parse JWT expiry string to seconds
     * @param {string} expiry - e.g., '24h', '7d', '60s'
     * @returns {number} Seconds
     */
    static _parseJwtExpiry(expiry) {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) return 3600; // default 1 hour

        const value = parseInt(match[1], 10);
        const unit = match[2];

        const multipliers = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };

        return value * (multipliers[unit] || 3600);
    }

    /**
     * Get default permissions by role
     * @param {string} role
     * @returns {string[]}
     */
    static _getDefaultPermissions(role) {
        const permissions = {
            'voter': ['vote', 'view_events', 'view_results'],
            'organizer': ['vote', 'view_events', 'view_results', 'create_event', 'manage_candidates'],
            'admin': ['vote', 'view_events', 'view_results', 'create_event', 'manage_candidates', 'manage_users', 'view_analytics'],
            'super-admin': ['*'], // All permissions
            'candidate': ['view_profile', 'update_profile', 'view_event'],
        };

        return permissions[role] || ['vote', 'view_events'];
    }

    /**
     * Generate random verification code (6 digits)
     * @returns {string}
     */
    static generateVerificationCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Generate session ID
     * @returns {string}
     */
    static generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }
}

export default AuthHelpers;
