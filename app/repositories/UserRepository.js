#!/usr/bin/env node
/**
 * User Repository
 * 
 * Extends BaseRepository to provide User-specific database operations.
 * Includes user authentication, role management, and user-specific queries.
 */

import BaseRepository from './BaseRepository.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

class UserRepository extends BaseRepository {
    
    constructor() {
        // Get the User model - we need to handle this properly based on how models are exported
        super(User);
    }

    /**
     * Create a new user with hashed password
     * @param {Object} userData - User data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData, options = {}) {
        try {
            if (Object.keys(userData).length === 0){
                throw this._handleError(new Error("The User Data is Empty"), 'createUser')
            }
            const password = this._hashPassword(userData.password)
            userData.password = password
            console.log(password)
            const user = await this.create(userData, options)
            return user.toJSON()
        } catch (error) {
            throw this._handleError(error, 'createUser');
        }
    }

    /**
     * Find user by email
     * @param {String} email - User email
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} Found user or null
     */
    async findByEmail(email, options = {}) {
        try {
            const criteria = { email: email.toLowerCase().trim() };
            return await this.findOne(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findByEmail');
        }
    }

    /**
     * Find user by email with password included
     * @param {String} email - User email
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} Found user with password or null
     */
    async findByEmailWithPassword(email, options = {}) {
        try {
            const criteria = { email: email.toLowerCase().trim() };
            return await this.findOne(criteria, { 
                ...options, 
                select: '+password' // Include password field
            });
        } catch (error) {
            throw this._handleError(error, 'findByEmailWithPassword');
        }
    }

    /**
     * Authenticate user with email and password
     * @param {String} email - User email
     * @param {String} password - User password
     * @returns {Promise<Object|null>} Authenticated user or null
     */
    async authenticate(email, password) {
        try {
            const user = await this.findByEmailWithPassword(email, {
                populate: 'role'
            });
            
            if (!user) {
                return null;
            }
            
            const isValidPassword = await bcrypt.compare(password, user.password);
            
            if (!isValidPassword) {
                return null;
            }
            
            // Remove password from returned object
            const userObj = user.toJSON();            
            return userObj;
        } catch (error) {
            throw this._handleError(error, 'authenticate');
        }
    }

    /**
     * Update user password
     * @param {String|ObjectId} userId - User ID
     * @param {String} newPassword - New password
     * @param {String} currentPassword - Current password (for verification)
     * @returns {Promise<Boolean>} True if password updated successfully
     */
    async updatePassword(userId, newPassword, currentPassword = null) {
        try {
            const user = await this.findById(userId, { select: '+password' });
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Verify current password if provided
            if (currentPassword) {
                const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
                if (!isValidCurrentPassword) {
                    throw new Error('Current password is incorrect');
                }
            }
            
            const hashedNewPassword = await this._hashPassword(newPassword);

            await this.updateById(userId, { password: hashedNewPassword });
            
            return true;
        } catch (error) {
            throw this._handleError(error, 'updatePassword');
        }
    }

    /**
     * Find users by role
     * @param {String|ObjectId} roleId - Role ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Users with the specified role
     */
    async findByRole(roleId, options = {}) {
        try {
            const criteria = { role: roleId };
            return await this.find(criteria, {
                ...options,
                populate: 'role'
            });
        } catch (error) {
            throw this._handleError(error, 'findByRole');
        }
    }

    /**
     * Find users by role name
     * @param {String} roleName - Role name
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Users with the specified role
     */
    async findByRoleName(roleName, options = {}) {
        try {
            const pipeline = [
                {
                    $lookup: {
                        from: 'roles',
                        localField: 'role',
                        foreignField: '_id',
                        as: 'roleInfo'
                    }
                },
                {
                    $match: {
                        'roleInfo.name': roleName
                    }
                }
            ];
            
            return await this.aggregate(pipeline, options);
        } catch (error) {
            throw this._handleError(error, 'findByRoleName');
        }
    }

    /**
     * Get user profile with populated references
     * @param {String|ObjectId} userId - User ID
     * @returns {Promise<Object|null>} User profile or null
     */
    async getProfile(userId) {
        try {
            return await this.findById(userId, {
                populate: [
                    { path: 'role', select: 'name level' }
                ],
                select: '-password'
            });
        } catch (error) {
            throw this._handleError(error, 'getProfile');
        }
    }

    /**
     * Update user profile
     * @param {String|ObjectId} userId - User ID
     * @param {Object} profileData - Profile data to update
     * @returns {Promise<Object|null>} Updated user profile
     */
    async updateUser(userId, profileData) {
        try {
            // Remove sensitive fields that shouldn't be updated via profile
            const { password, role, email, ...safeProfileData } = profileData;
            
            return await this.updateById(userId, safeProfileData, {
                select: '-password',
                populate: 'role'
            });
        } catch (error) {
            throw this._handleError(error, 'updateUser');
        }
    }

    /**
     * Soft delete user (mark as inactive)
     * @param {String|ObjectId} userId - User ID
     * @returns {Promise<Object|null>} Updated user
     */
    async softDelete(userId) {
        try {
            return await this.updateById(userId, {
                isActive: false,
                deletedAt: new Date()
            });
        } catch (error) {
            throw this._handleError(error, 'softDelete');
        }
    }

    /**
     * Restore soft deleted user
     * @param {String|ObjectId} userId - User ID
     * @returns {Promise<Object|null>} Updated user
     */
    async restore(userId) {
        try {
            return await this.updateById(userId, {
                isActive: true,
                $unset: { deletedAt: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'restore');
        }
    }

    /**
     * Find active users
     * @param {Object} criteria - Additional search criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Active users
     */
    async findActive(criteria = {}, options = {}) {
        try {
            const activeCriteria = {
                ...criteria,
                isActive: { $ne: false }
            };
            return await this.find(activeCriteria, options);
        } catch (error) {
            throw this._handleError(error, 'findActive');
        }
    }

    /**
     * Get all the users
     * @param {Object} criteria - The search criteria
     * @param {Number} page - The page number
     * @param {Number} limit - The number of users per page
     * @param {Object} options - Other query options
     * @returns {Promise<Object>} An object containing the number of pages, page number and
     * and limit 
     */
    async getUsers(criteria={}, options={}){
        try{
            const result = this.find(criteria, {
                ...options,
                select: '-password',
                populate: 'role',
                sort: { createdAt: -1 } // Sort by creation date descending
            });
            return result
        }catch(error){
            this._handleError(error, "getUsers")
        }
    }

    /**
     * Search users by name or email
     * @param {String} searchTerm - Search term
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching users
     */
    async search(searchTerm, options = {}) {
        try {
            const searchRegex = new RegExp(searchTerm, 'i');
            const criteria = {
                $or: [
                    { name: { $regex: searchRegex } },
                    { email: { $regex: searchRegex } }
                ],
                isActive: { $ne: false }
            };
            
            return await this.find(criteria, {
                ...options,
                select: '-password',
                populate: 'role'
            });
        } catch (error) {
            throw this._handleError(error, 'search');
        }
    }

    /**
     * Get user statistics
     * @returns {Promise<Object>} User statistics
     */
    async getUserStats() {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: null,
                        totalUsers: { $sum: 1 },
                        activeUsers: {
                            $sum: {
                                $cond: [{ $ne: ['$isActive', false] }, 1, 0]
                            }
                        },
                        inactiveUsers: {
                            $sum: {
                                $cond: [{ $eq: ['$isActive', false] }, 1, 0]
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'roles',
                        pipeline: [
                            {
                                $group: {
                                    _id: '$name',
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        as: 'roleStats'
                    }
                }
            ];
            
            const [stats] = await this.aggregate(pipeline);
            return stats || {
                totalUsers: 0,
                activeUsers: 0,
                inactiveUsers: 0,
                roleStats: []
            };
        } catch (error) {
            throw this._handleError(error, 'getUserStats');
        }
    }

    /**
     * Check if email is available
     * @param {String} email - Email to check
     * @param {String|ObjectId} excludeUserId - User ID to exclude from check
     * @returns {Promise<Boolean>} True if email is available
     */
    async isEmailAvailable(email, excludeUserId = null) {
        try {
            const criteria = { email: email.toLowerCase().trim() };
            
            if (excludeUserId) {
                criteria._id = { $ne: excludeUserId };
            }
            
            const existingUser = await this.findOne(criteria);
            return !existingUser;
        } catch (error) {
            throw this._handleError(error, 'isEmailAvailable');
        }
    }

    /**
     * Hash password
     * @private
     * @param {String} password - Password to hash
     * @returns {Promise<String>} Hashed password
     */
    async _hashPassword(password) {
          if (typeof password !== 'string' || password.length < 6 || password.length > 100 || /^\s+$/.test(password)) {
            throw new Error('Password must be at least 6 characters long and not just whitespace.');
        }
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds)
    }
}

export default UserRepository;