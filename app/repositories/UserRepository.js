#!/usr/bin/env node
/**
 * Enhanced User Repository
 * 
 * Provides user-specific database operations with intelligent caching.
 * All user data is automatically cached and invalidated when updated.
 * 
 * @module UserRepository
 * @version 2.0.0
 */

import BaseRepository from '../BaseRepository.js';
import User from '../../models/User.js';
import bcrypt from 'bcrypt';
import { userCacheManager } from '../../utils/engine/CacheManager.js';

class UserRepository extends BaseRepository {
    constructor() {
        super(User, {
            enableCache: true,
            cacheManager: userCacheManager,
        });
    }

    // ============================================
    // USER MANAGEMENT
    // ============================================

    /**
     * Create a new user with hashed password
     * @param {Object} userData - User data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData, options = {}) {
        try {
            this.validateRequiredFields(userData, ['email', 'password', 'firstName', 'lastName']);

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(userData.password, salt);

            const userDataWithHashedPassword = {
                ...userData,
                password: hashedPassword,
                email: userData.email.toLowerCase().trim(),
            };

            const user = await this.create(userDataWithHashedPassword, options);
            
            // Return without password
            const userObj = user.toJSON ? user.toJSON() : user;
            delete userObj.password;

            this.log('createUser', { email: userData.email, success: true });
            
            return userObj;
        } catch (error) {
            throw this.handleError(error, 'createUser', { email: userData.email });
        }
    }

    /**
     * Update user by ID
     * @param {String} userId - User ID
     * @param {Object} updateData - Data to update
     * @param {Object} options - Update options
     * @returns {Promise<Object>}
     */
    async updateUser(userId, updateData, options = {}) {
        try {
            this.validateObjectId(userId, 'User ID');

            // Don't allow direct password updates through this method
            if (updateData.password) {
                delete updateData.password;
            }

            // Normalize email if provided
            if (updateData.email) {
                updateData.email = updateData.email.toLowerCase().trim();
            }

            const user = await this.updateById(userId, updateData, {
                ...options,
                new: true,
                runValidators: true,
            });

            if (!user) {
                return null;
            }

            // Return without password
            const userObj = user.toJSON ? user.toJSON() : user;
            delete userObj.password;

            return userObj;
        } catch (error) {
            throw this.handleError(error, 'updateUser', { userId });
        }
    }

    // ============================================
    // USER QUERIES
    // ============================================

    /**
     * Find user by email
     * @param {String} email - User email
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>}
     */
    async findByEmail(email, options = {}) {
        try {
            if (!email) {
                throw new Error('Email is required');
            }

            const normalizedEmail = email.toLowerCase().trim();
            const user = await this.findOne(
                { email: normalizedEmail },
                { ...options, lean: true }
            );

            if (user && user.password) {
                delete user.password;
            }

            return user;
        } catch (error) {
            throw this.handleError(error, 'findByEmail', { email });
        }
    }

    /**
     * Find user by email with password (for authentication)
     * @param {String} email - User email
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>}
     */
    async findByEmailWithPassword(email, options = {}) {
        try {
            if (!email) {
                throw new Error('Email is required');
            }

            const normalizedEmail = email.toLowerCase().trim();
            
            // Skip cache for sensitive operations
            const user = await this.findOne(
                { email: normalizedEmail },
                { 
                    ...options,
                    select: '+password',
                    skipCache: true,
                }
            );

            return user;
        } catch (error) {
            throw this.handleError(error, 'findByEmailWithPassword', { email });
        }
    }

    /**
     * Find users by role
     * @param {String} roleId - Role ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByRole(roleId, options = {}) {
        try {
            this.validateObjectId(roleId, 'Role ID');

            return await this.find(
                { role: roleId },
                { ...options, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByRole', { roleId });
        }
    }

    /**
     * Find users by level
     * @param {Number} level - User level
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByLevel(level, options = {}) {
        try {
            return await this.find(
                { level },
                { ...options, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByLevel', { level });
        }
    }

    /**
     * Find active users
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findActiveUsers(options = {}) {
        try {
            return await this.find(
                { active: true, deleted: false },
                { ...options, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findActiveUsers');
        }
    }

    /**
     * Search users by text
     * @param {String} searchText - Search query
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async searchUsers(searchText, options = {}) {
        try {
            if (!searchText) {
                return [];
            }

            return await this.textSearch(searchText, {}, options);
        } catch (error) {
            throw this.handleError(error, 'searchUsers', { searchText });
        }
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    /**
     * Authenticate user with email and password
     * @param {String} email - User email
     * @param {String} password - User password
     * @returns {Promise<Object|null>} User object or null if authentication fails
     */
    async authenticate(email, password) {
        try {
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            const user = await this.findByEmailWithPassword(email, {
                populate: ['role'],
            });

            if (!user) {
                this.log('authenticate', { email, success: false, reason: 'user_not_found' });
                return null;
            }

            // Check if user is active
            if (!user.active) {
                this.log('authenticate', { email, success: false, reason: 'user_inactive' });
                return null;
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                this.log('authenticate', { email, success: false, reason: 'invalid_password' });
                return null;
            }

            // Update last login
            await this.updateById(user._id, {
                lastLogin: new Date(),
                $inc: { loginCount: 1 },
            }, { skipCache: true });

            // Remove password from returned object
            const userObj = user.toJSON ? user.toJSON() : { ...user };
            delete userObj.password;

            this.log('authenticate', { email, success: true });
            
            return userObj;
        } catch (error) {
            throw this.handleError(error, 'authenticate', { email });
        }
    }

    /**
     * Change user password
     * @param {String} userId - User ID
     * @param {String} oldPassword - Current password
     * @param {String} newPassword - New password
     * @returns {Promise<Boolean>}
     */
    async changePassword(userId, oldPassword, newPassword) {
        try {
            this.validateObjectId(userId, 'User ID');

            if (!oldPassword || !newPassword) {
                throw new Error('Old and new passwords are required');
            }

            if (oldPassword === newPassword) {
                throw new Error('New password must be different from old password');
            }

            // Get user with password
            const user = await this.findById(userId, {
                select: '+password',
                skipCache: true,
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Verify old password
            const isValidPassword = await bcrypt.compare(oldPassword, user.password);

            if (!isValidPassword) {
                this.log('changePassword', { userId, success: false, reason: 'invalid_old_password' });
                return false;
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update password
            await this.updateById(userId, {
                password: hashedPassword,
                passwordChangedAt: new Date(),
            }, { skipCache: true });

            this.log('changePassword', { userId, success: true });
            
            return true;
        } catch (error) {
            throw this.handleError(error, 'changePassword', { userId });
        }
    }

    /**
     * Reset user password (admin function)
     * @param {String} userId - User ID
     * @param {String} newPassword - New password
     * @returns {Promise<Boolean>}
     */
    async resetPassword(userId, newPassword) {
        try {
            this.validateObjectId(userId, 'User ID');

            if (!newPassword) {
                throw new Error('New password is required');
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update password
            await this.updateById(userId, {
                password: hashedPassword,
                passwordChangedAt: new Date(),
            }, { skipCache: true });

            this.log('resetPassword', { userId, success: true });
            
            return true;
        } catch (error) {
            throw this.handleError(error, 'resetPassword', { userId });
        }
    }

    // ============================================
    // USER STATUS MANAGEMENT
    // ============================================

    /**
     * Activate user account
     * @param {String} userId - User ID
     * @returns {Promise<Object>}
     */
    async activateUser(userId) {
        try {
            this.validateObjectId(userId, 'User ID');

            return await this.updateById(userId, {
                active: true,
                activatedAt: new Date(),
            });
        } catch (error) {
            throw this.handleError(error, 'activateUser', { userId });
        }
    }

    /**
     * Deactivate user account
     * @param {String} userId - User ID
     * @param {String} reason - Reason for deactivation
     * @returns {Promise<Object>}
     */
    async deactivateUser(userId, reason = null) {
        try {
            this.validateObjectId(userId, 'User ID');

            return await this.updateById(userId, {
                active: false,
                deactivatedAt: new Date(),
                deactivationReason: reason,
            });
        } catch (error) {
            throw this.handleError(error, 'deactivateUser', { userId });
        }
    }

    /**
     * Verify user email
     * @param {String} userId - User ID
     * @returns {Promise<Object>}
     */
    async verifyEmail(userId) {
        try {
            this.validateObjectId(userId, 'User ID');

            return await this.updateById(userId, {
                emailVerified: true,
                emailVerifiedAt: new Date(),
            });
        } catch (error) {
            throw this.handleError(error, 'verifyEmail', { userId });
        }
    }

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Get user statistics
     * @param {String} userId - User ID
     * @returns {Promise<Object>}
     */
    async getUserStats(userId) {
        try {
            this.validateObjectId(userId, 'User ID');

            const user = await this.findById(userId);

            if (!user) {
                throw new Error('User not found');
            }

            return {
                userId,
                loginCount: user.loginCount || 0,
                lastLogin: user.lastLogin,
                eventsCreated: user.eventsCreated || 0,
                votesCount: user.votesCount || 0,
                active: user.active,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
            };
        } catch (error) {
            throw this.handleError(error, 'getUserStats', { userId });
        }
    }

    /**
     * Get total user count
     * @param {Object} filter - Optional filter
     * @returns {Promise<Number>}
     */
    async getUserCount(filter = {}) {
        try {
            return await this.count({ ...filter, deleted: false });
        } catch (error) {
            throw this.handleError(error, 'getUserCount');
        }
    }

    /**
     * Get active user count
     * @returns {Promise<Number>}
     */
    async getActiveUserCount() {
        try {
            return await this.count({ active: true, deleted: false });
        } catch (error) {
            throw this.handleError(error, 'getActiveUserCount');
        }
    }
}

export default UserRepository;
