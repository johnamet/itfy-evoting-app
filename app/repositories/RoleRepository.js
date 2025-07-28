#!/usr/bin/env node
/**
 * Role Repository
 * 
 * Extends BaseRepository to provide Role-specific database operations.
 * Includes role management, level-based operations, and permission handling.
 */

import BaseRepository from './BaseRepository.js';
import Role from '../models/Role.js';

class RoleRepository extends BaseRepository {
    
    constructor() {
        // Get the Role model
        super(Role);
    }

    /**
     * Create a new role
     * @param {Object} roleData - Role data
     * @returns {Promise<Object>} Created role
     */
    async createRole(roleData) {
        try {
            // Check if role name already exists
            const existingRole = await this.findByName(roleData.name);
            if (existingRole) {
                throw new Error(`Role with name '${roleData.name}' already exists`);
            }

            // Check if role level already exists
            const existingLevel = await this.findByLevel(roleData.level);
            if (existingLevel) {
                throw new Error(`Role with level '${roleData.level}' already exists`);
            }

            return await this.create(roleData);
        } catch (error) {
            throw this._handleError(error, 'createRole');
        }
    }

    /**
     * Find role by name
     * @param {String} name - Role name
     * @returns {Promise<Object|null>} Role or null
     */
    async findByName(name) {
        try {
            return await this.findOne({ name: name.trim() });
        } catch (error) {
            throw this._handleError(error, 'findByName');
        }
    }

    /**
     * Find role by level
     * @param {Number} level - Role level
     * @returns {Promise<Object|null>} Role or null
     */
    async findByLevel(level) {
        try {
            return await this.findOne({ level: level });
        } catch (error) {
            throw this._handleError(error, 'findByLevel');
        }
    }

    /**
     * Get all roles ordered by level
     * @param {String} order - Sort order ('asc' or 'desc')
     * @returns {Promise<Array>} Roles ordered by level
     */
    async getAllRolesByLevel(order = 'asc') {
        try {
            const sortOrder = order === 'desc' ? -1 : 1;
            return await this.find({}, {
                sort: { level: sortOrder }
            });
        } catch (error) {
            throw this._handleError(error, 'getAllRolesByLevel');
        }
    }

    /**
     * Get roles by level range
     * @param {Number} minLevel - Minimum level
     * @param {Number} maxLevel - Maximum level
     * @returns {Promise<Array>} Roles within level range
     */
    async getRolesByLevelRange(minLevel, maxLevel) {
        try {
            return await this.find({
                level: { 
                    $gte: minLevel, 
                    $lte: maxLevel 
                }
            }, {
                sort: { level: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getRolesByLevelRange');
        }
    }

    /**
     * Get roles above a certain level
     * @param {Number} level - Minimum level (exclusive)
     * @returns {Promise<Array>} Roles above the specified level
     */
    async getRolesAboveLevel(level) {
        try {
            return await this.find({
                level: { $gt: level }
            }, {
                sort: { level: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getRolesAboveLevel');
        }
    }

    /**
     * Get roles below a certain level
     * @param {Number} level - Maximum level (exclusive)
     * @returns {Promise<Array>} Roles below the specified level
     */
    async getRolesBelowLevel(level) {
        try {
            return await this.find({
                level: { $lt: level }
            }, {
                sort: { level: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getRolesBelowLevel');
        }
    }

    /**
     * Update role by name
     * @param {String} name - Role name
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} Updated role
     */
    async updateRoleByName(name, updateData) {
        try {
            const role = await this.findByName(name);
            if (!role) {
                throw new Error(`Role with name '${name}' not found`);
            }

            // If updating name, check for conflicts
            if (updateData.name && updateData.name !== name) {
                const existingRole = await this.findByName(updateData.name);
                if (existingRole) {
                    throw new Error(`Role with name '${updateData.name}' already exists`);
                }
            }

            // If updating level, check for conflicts
            if (updateData.level && updateData.level !== role.level) {
                const existingLevel = await this.findByLevel(updateData.level);
                if (existingLevel) {
                    throw new Error(`Role with level '${updateData.level}' already exists`);
                }
            }

            return await this.updateById(role._id, updateData);
        } catch (error) {
            throw this._handleError(error, 'updateRoleByName');
        }
    }

    /**
     * Delete role by name
     * @param {String} name - Role name
     * @returns {Promise<Object|null>} Deleted role
     */
    async deleteRoleByName(name) {
        try {
            const role = await this.findByName(name);
            if (!role) {
                throw new Error(`Role with name '${name}' not found`);
            }

            return await this.deleteById(role._id);
        } catch (error) {
            throw this._handleError(error, 'deleteRoleByName');
        }
    }

    

    /**
     * Get role statistics
     * @returns {Promise<Object>} Role statistics
     */
    async getRoleStatistics() {
        try {         
            const pipeline = [
                {
                    $group: {
                        _id: null,
                        totalRoles: { $sum: 1 },
                        minLevel: { $min: '$level' },
                        maxLevel: { $max: '$level' },
                        avgLevel: { $avg: '$level' },
                        roles: { $push: { name: '$name', level: '$level' } }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalRoles: 1,
                        minLevel: 1,
                        maxLevel: 1,
                        avgLevel: { $round: ['$avgLevel', 2] },
                        levelRange: { $subtract: ['$maxLevel', '$minLevel'] },
                        roles: 1
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            
            return stats || {
                totalRoles: 0,
                minLevel: null,
                maxLevel: null,
                avgLevel: null,
                levelRange: null,
                roles: []
            };
        } catch (error) {
            throw this._handleError(error, 'getRoleStatistics');
        }
    }

    /**
     * Get highest level role
     * @returns {Promise<Object|null>} Highest level role
     */
    async getHighestLevelRole() {
        try {
            const roles = await this.find({}, {
                sort: { level: -1 },
                limit: 1
            });
            
            return roles.length > 0 ? roles[0] : null;
        } catch (error) {
            throw this._handleError(error, 'getHighestLevelRole');
        }
    }

    /**
     * Get lowest level role
     * @returns {Promise<Object|null>} Lowest level role
     */
    async getLowestLevelRole() {
        try {
            const roles = await this.find({}, {
                sort: { level: 1 },
                limit: 1
            });
            
            return roles.length > 0 ? roles[0] : null;
        } catch (error) {
            throw this._handleError(error, 'getLowestLevelRole');
        }
    }

    /**
     * Search roles by name pattern
     * @param {String} pattern - Search pattern
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching roles
     */
    async searchRolesByName(pattern, options = {}) {
        try {
            const searchRegex = new RegExp(pattern, 'i');
            return await this.find({
                name: { $regex: searchRegex }
            }, {
                ...options,
                sort: { level: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'searchRolesByName');
        }
    }

    /**
     * Validate role data
     * @param {Object} roleData - Role data to validate
     * @returns {Promise<Boolean>} True if valid
     */
    async validateRoleData(roleData) {
        try {
            const errors = [];

            // Validate name
            if (!roleData.name || typeof roleData.name !== 'string') {
                errors.push('Role name is required and must be a string');
            } else if (roleData.name.trim().length < 2) {
                errors.push('Role name must be at least 2 characters long');
            } else if (roleData.name.trim().length > 50) {
                errors.push('Role name must be less than 50 characters');
            }

            // Validate level
            if (roleData.level === undefined || roleData.level === null) {
                errors.push('Role level is required');
            } else if (!Number.isInteger(roleData.level)) {
                errors.push('Role level must be an integer');
            } else if (roleData.level < 0) {
                errors.push('Role level must be non-negative');
            } else if (roleData.level > 1000) {
                errors.push('Role level must be less than or equal to 1000');
            }

            if (errors.length > 0) {
                throw new Error(`Validation errors: ${errors.join(', ')}`);
            }

            return true;
        } catch (error) {
            throw this._handleError(error, 'validateRoleData');
        }
    }

    /**
     * Bulk create roles
     * @param {Array} rolesData - Array of role data
     * @returns {Promise<Array>} Created roles
     */
    async bulkCreateRoles(rolesData) {
        try {
            const createdRoles = [];
            const errors = [];

            for (const roleData of rolesData) {
                try {
                    await this.validateRoleData(roleData);
                    const role = await this.createRole(roleData);
                    createdRoles.push(role);
                } catch (error) {
                    errors.push({
                        roleData,
                        error: error.message
                    });
                }
            }

            return {
                success: createdRoles,
                errors: errors,
                successCount: createdRoles.length,
                errorCount: errors.length
            };
        } catch (error) {
            throw this._handleError(error, 'bulkCreateRoles');
        }
    }

    /**
     * Get roles with pagination
     * @param {Number} page - Page number (1-based)
     * @param {Number} limit - Items per page
     * @param {Object} filter - Filter criteria
     * @returns {Promise<Object>} Paginated roles
     */
    async getRolesWithPagination(page = 1, limit = 10, filter = {}) {
        try {
            const skip = (page - 1) * limit;
            
            const roles = await this.find(filter, {
                skip,
                limit,
                sort: { level: 1 }
            });

            const total = await this.countDocuments(filter);
            const totalPages = Math.ceil(total / limit);

            return {
                roles,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw this._handleError(error, 'getRolesWithPagination');
        }
    }
}

export default RoleRepository;
