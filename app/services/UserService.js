#!/usr/bin/env node
/**
 * User Service
 * 
 * Handles user management operations including profile management,
 * user creation, updates, and user-related business logic.
 */

import BaseService from './BaseService.js';
import UserRepository from '../repositories/UserRepository.js';
import RoleRepository from '../repositories/RoleRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import EmailService from './EmailService.js';
import { populate } from 'dotenv';
import mongoose from 'mongoose';

class UserService extends BaseService {
    constructor() {
        super();
        this.userRepository = new UserRepository();
        this.roleRepository = new RoleRepository();
        this.activityRepository = new ActivityRepository();
        this.emailService = new EmailService();
    }

    /**
     * Create a new user
     * @param {Object} userData - User data
     * @param {String} createdBy - ID of user creating this user
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData, createdBy = null) {
        try {
            this._log('create_user', { email: userData.email, createdBy });

            // Validate required fields
            this._validateRequiredFields(userData, ['name', 'email', 'password', 'role']);
            this._validateEmail(userData.email);

            // Check if email already exists
            const existingUser = await this.userRepository.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('Email already exists');
            }

            // Validate role exists
            this._validateObjectId(userData.role, 'Role ID');
            const role = await this.roleRepository.findById(userData.role);
            if (!role) {
                throw new Error('Role not found');
            }

            // Create user
            const userToCreate = {
                ...this._sanitizeData(userData),
                isActive: userData.isActive !== undefined ? userData.isActive : true,
                emailVerified: false,
                createdAt: new Date()
            };

            const user = await this.userRepository.create(userToCreate);

            // Log activity
            if (createdBy) {
                await this.activityRepository.logActivity({
                    user: createdBy,
                    action: 'create',
                    targetType: 'user',
                    targetId: user._id,
                    metadata: { userEmail: user.email, roleName: role.name }
                });
            }

            // Send welcome email
            try {
                await this.emailService.sendWelcomeEmail({
                    name: user.name,
                    email: user.email,
                    role: role.name,
                    createdAt: user.createdAt
                });
                this._log('welcome_email_sent', { userId: user._id, email: user.email });
            } catch (emailError) {
                this._handleError('welcome_email_failed', emailError, { userId: user._id, email: user.email });
                // Don't throw error - user creation should succeed even if email fails
            }

            this._log('create_user_success', { userId: user._id, email: user.email });

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
                    isActive: user.isActive,
                    createdAt: user.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_user', { email: userData.email });
        }
    }


    /**
     * Get user by ID
     * @param {String} userId - User ID
     * @param {Boolean} includeRole - Whether to include role information
     * @returns {Promise<Object>} User data
     */
    async getUserById(userId, includeRole = true) {
        try {
            this._log('get_user_by_id', { userId });

            this._validateObjectId(userId, 'User ID');

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            let roleInfo = null;
            if (includeRole) {
                const role = await this.roleRepository.findById(user.role);
                if (role) {
                    roleInfo = {
                        id: role._id,
                        name: role.name,
                        level: role.level
                    };
                }
            }

            return {
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: roleInfo,
                    isActive: user.isActive,
                    emailVerified: user.emailVerified,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_user_by_id', { userId });
        }
    }

    /**
     * Update user profile
     * @param {String} userId - User ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user making the update
     * @returns {Promise<Object>} Updated user
     */
    async updateUser(userId, updateData, updatedBy = null) {
        try {
            this._log('update_user', { userId, updatedBy });

            this._validateObjectId(userId, 'User ID');

            // Get current user
            const currentUser = await this.userRepository.findById(userId);
            if (!currentUser) {
                throw new Error('User not found');
            }

            // Validate email if being updated
            if (updateData.email) {
                this._validateEmail(updateData.email);
                
                // Check if new email already exists (excluding current user)
                const existingUser = await this.userRepository.findByEmail(updateData.email);
                if (existingUser && existingUser._id.toString() !== userId) {
                    throw new Error('Email already exists');
                }
            }

            // Validate role if being updated
            if (updateData.role) {
                this._validateObjectId(updateData.role, 'Role ID');
                const role = await this.roleRepository.findById(updateData.role);
                if (!role) {
                    throw new Error('Role not found');
                }
            }

            // Sanitize and prepare update data
            const sanitizedData = this._sanitizeData(updateData);
            
            // Remove fields that shouldn't be updated directly
            delete sanitizedData.password; // Use changePassword method
            delete sanitizedData._id;
            delete sanitizedData.createdAt;

            sanitizedData.updatedAt = new Date();

            // Update user
            const updatedUser = await this.userRepository.updateById(userId, sanitizedData);

            // Log activity
            if (updatedBy) {
                await this.activityRepository.logActivity({
                    user: updatedBy,
                    action: 'update',
                    targetType: 'user',
                    targetId: userId,
                    metadata: { 
                        updatedFields: Object.keys(sanitizedData),
                        targetEmail: updatedUser.email 
                    }
                });
            }

            this._log('update_user_success', { userId });

            return {
                success: true,
                user: {
                    id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    isActive: updatedUser.isActive,
                    updatedAt: updatedUser.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_user', { userId });
        }
    }

    /**
     * Deactivate user account
     * @param {String} userId - User ID
     * @param {String} deactivatedBy - ID of user performing deactivation
     * @returns {Promise<Object>} Deactivation result
     */
    async deactivateUser(userId, deactivatedBy) {
        try {
            this._log('deactivate_user', { userId, deactivatedBy });

            this._validateObjectId(userId, 'User ID');
            this._validateObjectId(deactivatedBy, 'Deactivated By User ID');

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            if (!user.isActive) {
                throw new Error('User is already deactivated');
            }

            // Deactivate user
            const updatedUser = await this.userRepository.updateById(userId, {
                isActive: false,
                deactivatedAt: new Date(),
                deactivatedBy
            });

            // Log activity
            await this.activityRepository.logActivity({
                user: deactivatedBy,
                action: 'user_deactivate',
                targetType: 'user',
                targetId: userId,
                metadata: { targetEmail: user.email }
            });

            this._log('deactivate_user_success', { userId });

            return {
                success: true,
                message: 'User deactivated successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'deactivate_user', { userId });
        }
    }

    /**
     * Reactivate user account
     * @param {String} userId - User ID
     * @param {String} reactivatedBy - ID of user performing reactivation
     * @returns {Promise<Object>} Reactivation result
     */
    async reactivateUser(userId, reactivatedBy) {
        try {
            this._log('reactivate_user', { userId, reactivatedBy });

            this._validateObjectId(userId, 'User ID');
            this._validateObjectId(reactivatedBy, 'Reactivated By User ID');

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            if (user.isActive) {
                throw new Error('User is already active');
            }

            // Reactivate user
            await this.userRepository.updateById(userId, {
                isActive: true,
                reactivatedAt: new Date(),
                reactivatedBy,
                deactivatedAt: null,
                deactivatedBy: null
            });

            // Log activity
            await this.activityRepository.logActivity({
                user: reactivatedBy,
                action: 'user_reactivate',
                targetType: 'user',
                targetId: userId,
                metadata: { targetEmail: user.email }
            });

            this._log('reactivate_user_success', { userId });

            return {
                success: true,
                message: 'User reactivated successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'reactivate_user', { userId });
        }
    }

    /**
     * Get users with pagination and filtering
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Paginated users
     */
    async getUsers(query = {}) {
        try {
            this._log('get_users', { query });

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                100
            );

            // Create search filter
            const filter = this._createSearchFilter(query, ['name', 'email', 'status']);

            // Add role filter if specified
            if (query.role) {
                this._validateObjectId(query.role, 'Role ID');
                filter.role = new mongoose.Types.ObjectId(query.role);
            }

            // Get users with pagination
            const users = await this.userRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                populate: 'role',
                select: '-password -__v',
            });

            const totalItems = await this.userRepository.countDocuments(filter);

            console.log(users);

            return {
                success: true,
                data: this._formatPaginationResponse(users, totalItems, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_users', { query });
        }
    }

    /**
     * Get detailed stats for a user
     * @param {String} userId - User ID
     * @returns {Promise<Object>} User stats
     */
    async getUserStats(userId) {
        try {
            this._log('get_user_stats', { userId });

            this._validateObjectId(userId, 'User ID');

            // Events created by user
            const events = await this.activityRepository.find({
                user: userId,
                action: 'create',
                targetType: 'event'
            });

            // Categories created by user
            const categories = await this.activityRepository.find({
                user: userId,
                action: 'create',
                targetType: 'category'
            });

            // VoteBundles created by user
            const voteBundles = await this.activityRepository.find({
                user: userId,
                action: 'create',
                targetType: 'votebundle'
            });

            // Coupons created by user
            const coupons = await this.activityRepository.find({
                user: userId,
                action: 'create',
                targetType: 'coupon'
            });

            // Updates made by user
            const updates = await this.activityRepository.find({
                user: userId,
                action: 'update'
            });

            // Logins made by user
            const logins = await this.activityRepository.find({
                user: userId,
                action: 'login'
            });

            const recentActivity = await this.activityRepository.find({
                user: userId,
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
            });

            return {
                success: true,
                data: {
                    eventsCreated: events.length,
                    categoriesCreated: categories.length,
                    voteBundlesCreated: voteBundles.length,
                    couponsCreated: coupons.length,
                    updatesMade: updates.length,
                    recentActivity,
                    totalLogins: logins.length,
                    events,
                    categories,
                    voteBundles,
                    coupons,
                    updates
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_user_stats', { userId });
        }
    }

    /**
     * Get user statistics
     * @returns {Promise<Object>} User statistics
     */
    async getUserStatistics() {
        try {
            this._log('get_user_statistics');

            const stats = await this.userRepository.getUserStats();

            return {
                success: true,
                data: {
                    ...stats,
                    generatedAt: new Date()
                }
            };
        } catch (error) {
            throw this._handleError(error, 'get_user_statistics');
        }
    }

    /**
     * Search users by criteria
     * @param {String} searchTerm - Search term
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async searchUsers(searchTerm, options = {}) {
        try {
            this._log('search_users', { searchTerm, options });

            if (!searchTerm || searchTerm.trim().length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            const searchCriteria = {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { email: { $regex: searchTerm, $options: 'i' } }
                ]
            };

            // Add additional filters
            if (options.isActive !== undefined) {
                searchCriteria.isActive = options.isActive;
            }

            if (options.role) {
                this._validateObjectId(options.role, 'Role ID');
                searchCriteria.role = options.role;
            }

            const users = await this.userRepository.search(searchCriteria);

            // Format results
            const formattedUsers = await Promise.all(
                users.map(async (user) => {
                    const role = await this.roleRepository.findById(user.role);
                    return {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: role ? {
                            id: role._id,
                            name: role.name,
                            level: role.level
                        } : null,
                        isActive: user.isActive
                    };
                })
            );

            return {
                success: true,
                data: formattedUsers
            };
        } catch (error) {
            throw this._handleError(error, 'search_users', { searchTerm });
        }
    }

    /**
     * Get roles
     */
    async getRoles() {
        try {
            this._log('get_roles');

            const roles = await this.roleRepository.find();

            return {
                success: true,
                data: roles
            };
        } catch (error) {
            throw this._handleError(error, 'get_roles');
        }
    }
}

export default UserService;
