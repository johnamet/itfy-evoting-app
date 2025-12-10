import BaseRepository from '../BaseRepository.js';
import Role from '../../models/Role.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

/**
 * RoleRepository
 * 
 * Manages user roles and permissions with intelligent caching. Roles are cached with a 2-hour TTL
 * since they rarely change but are checked frequently for authorization.
 * 
 * Cache Strategy:
 * - Read operations are cached with long TTL (2 hours)
 * - Name-based lookups are heavily cached
 * - Level-based queries are cached
 * - Permission checks use cached role data
 * 
 * @extends BaseRepository
 */
class RoleRepository extends BaseRepository {
    constructor() {
        super(Role, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 7200 // 2 hours
        });
    }

    /**
     * Create a new role
     * 
     * @param {Object} roleData - Role data
     * @param {string} roleData.name - Role name (unique)
     * @param {number} roleData.level - Authorization level (1-4)
     * @param {Array<string>} [roleData.permissions=[]] - Array of permission strings
     * @param {string} [roleData.description] - Role description
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created role
     */
    async createRole(roleData, options = {}) {
        this._validateRequiredFields(roleData, ['name', 'level']);

        // Validate level range
        if (roleData.level < 1 || roleData.level > 4) {
            throw new Error('Role level must be between 1 and 4');
        }

        // Check if role name already exists
        const existing = await this.findByName(roleData.name, { skipCache: true });
        if (existing) {
            throw new Error('Role name already exists');
        }

        const roleToCreate = {
            ...roleData,
            permissions: roleData.permissions || []
        };

        return await this.create(roleToCreate, options);
    }

    /**
     * Find role by name
     * Heavily cached for authorization checks
     * 
     * @param {string} name - Role name
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Object|null>} Role or null
     */
    async findByName(name, options = {}) {
        if (!name) {
            throw new Error('Role name is required');
        }

        return await this.findOne({ name }, options);
    }

    /**
     * Find roles by level
     * 
     * @param {number} level - Authorization level
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Roles at level
     */
    async findByLevel(level, options = {}) {
        if (!level) {
            throw new Error('Level is required');
        }

        if (level < 1 || level > 4) {
            throw new Error('Level must be between 1 and 4');
        }

        return await this.find(
            { level },
            {
                ...options,
                sort: options.sort || { name: 1 }
            }
        );
    }

    /**
     * Find roles at or above a level
     * 
     * @param {number} minLevel - Minimum level
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Roles at or above level
     */
    async findByMinLevel(minLevel, options = {}) {
        if (!minLevel) {
            throw new Error('Minimum level is required');
        }

        if (minLevel < 1 || minLevel > 4) {
            throw new Error('Level must be between 1 and 4');
        }

        return await this.find(
            { level: { $gte: minLevel } },
            {
                ...options,
                sort: options.sort || { level: 1, name: 1 }
            }
        );
    }

    /**
     * Update role permissions
     * 
     * @param {string} roleId - Role ID
     * @param {Array<string>} permissions - New permissions array
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated role
     */
    async updatePermissions(roleId, permissions, options = {}) {
        if (!roleId) {
            throw new Error('Role ID is required');
        }

        if (!Array.isArray(permissions)) {
            throw new Error('Permissions must be an array');
        }

        return await this.updateById(roleId, { permissions }, options);
    }

    /**
     * Add permission to role
     * 
     * @param {string} roleId - Role ID
     * @param {string} permission - Permission to add
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated role
     */
    async addPermission(roleId, permission, options = {}) {
        if (!roleId || !permission) {
            throw new Error('Role ID and permission are required');
        }

        const role = await this.findById(roleId, { skipCache: true });
        
        if (!role) {
            throw new Error('Role not found');
        }

        if (role.permissions.includes(permission)) {
            return role; // Permission already exists
        }

        const updatedPermissions = [...role.permissions, permission];
        return await this.updateById(roleId, { permissions: updatedPermissions }, options);
    }

    /**
     * Remove permission from role
     * 
     * @param {string} roleId - Role ID
     * @param {string} permission - Permission to remove
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated role
     */
    async removePermission(roleId, permission, options = {}) {
        if (!roleId || !permission) {
            throw new Error('Role ID and permission are required');
        }

        const role = await this.findById(roleId, { skipCache: true });
        
        if (!role) {
            throw new Error('Role not found');
        }

        const updatedPermissions = role.permissions.filter(p => p !== permission);
        return await this.updateById(roleId, { permissions: updatedPermissions }, options);
    }

    /**
     * Check if role has permission
     * 
     * @param {string} roleId - Role ID
     * @param {string} permission - Permission to check
     * @returns {Promise<boolean>} True if role has permission
     */
    async hasPermission(roleId, permission) {
        if (!roleId || !permission) {
            throw new Error('Role ID and permission are required');
        }

        const role = await this.findById(roleId);
        
        if (!role) {
            return false;
        }

        return role.permissions.includes(permission);
    }

    /**
     * Update role level
     * 
     * @param {string} roleId - Role ID
     * @param {number} newLevel - New level (1-4)
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated role
     */
    async updateLevel(roleId, newLevel, options = {}) {
        if (!roleId) {
            throw new Error('Role ID is required');
        }

        if (newLevel < 1 || newLevel > 4) {
            throw new Error('Level must be between 1 and 4');
        }

        return await this.updateById(roleId, { level: newLevel }, options);
    }

    /**
     * Update role
     * Prevents updating name after creation
     * 
     * @param {string} roleId - Role ID
     * @param {Object} updateData - Update data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated role
     */
    async updateRole(roleId, updateData, options = {}) {
        if (!roleId) {
            throw new Error('Role ID is required');
        }

        // Prevent updating name (immutable)
        const { name, ...safeUpdateData } = updateData;

        return await this.updateById(roleId, safeUpdateData, options);
    }

    /**
     * Delete a role
     * Should check if role is assigned to users before deletion
     * 
     * @param {string} roleId - Role ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Deleted role
     */
    async deleteRole(roleId, options = {}) {
        if (!roleId) {
            throw new Error('Role ID is required');
        }

        return await this.deleteById(roleId, options);
    }

    /**
     * Get all roles sorted by level
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} All roles
     */
    async getAllRoles(options = {}) {
        return await this.find(
            {},
            {
                ...options,
                sort: options.sort || { level: 1, name: 1 }
            }
        );
    }

    /**
     * Get role hierarchy
     * Returns roles organized by level
     * 
     * @returns {Promise<Object>} Role hierarchy
     */
    async getRoleHierarchy() {
        const roles = await this.getAllRoles();

        const hierarchy = {
            level1: [],
            level2: [],
            level3: [],
            level4: []
        };

        roles.forEach(role => {
            hierarchy[`level${role.level}`].push({
                id: role._id,
                name: role.name,
                permissions: role.permissions,
                description: role.description
            });
        });

        return hierarchy;
    }

    /**
     * Get all unique permissions across all roles
     * 
     * @returns {Promise<Array<string>>} List of unique permissions
     */
    async getAllPermissions() {
        const roles = await this.getAllRoles();
        
        const permissionsSet = new Set();
        roles.forEach(role => {
            role.permissions.forEach(permission => {
                permissionsSet.add(permission);
            });
        });

        return Array.from(permissionsSet).sort();
    }

    /**
     * Find roles with specific permission
     * 
     * @param {string} permission - Permission to search for
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Roles with permission
     */
    async findByPermission(permission, options = {}) {
        if (!permission) {
            throw new Error('Permission is required');
        }

        return await this.find(
            { permissions: permission },
            {
                ...options,
                sort: options.sort || { level: 1, name: 1 }
            }
        );
    }

    /**
     * Count roles by level
     * 
     * @param {number} level - Level to count
     * @returns {Promise<number>} Role count
     */
    async countByLevel(level) {
        if (!level) {
            throw new Error('Level is required');
        }

        return await this.count({ level });
    }

    /**
     * Get role statistics
     * 
     * @returns {Promise<Object>} Role statistics
     */
    async getRoleStats() {
        const [totalRoles, levelCounts, allPermissions] = await Promise.all([
            this.count({}),
            this.Model.aggregate([
                {
                    $group: {
                        _id: '$level',
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { '_id': 1 }
                }
            ]),
            this.getAllPermissions()
        ]);

        const levelBreakdown = levelCounts.reduce((acc, item) => {
            acc[`level${item._id}`] = item.count;
            return acc;
        }, {});

        return {
            totalRoles,
            levelBreakdown,
            totalUniquePermissions: allPermissions.length
        };
    }

    /**
     * Clone role permissions to another role
     * 
     * @param {string} sourceRoleId - Source role ID
     * @param {string} targetRoleId - Target role ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated target role
     */
    async clonePermissions(sourceRoleId, targetRoleId, options = {}) {
        if (!sourceRoleId || !targetRoleId) {
            throw new Error('Source and target role IDs are required');
        }

        const sourceRole = await this.findById(sourceRoleId);
        
        if (!sourceRole) {
            throw new Error('Source role not found');
        }

        return await this.updatePermissions(targetRoleId, sourceRole.permissions, options);
    }

    /**
     * Validate role structure
     * Ensures default roles exist
     * 
     * @param {Array<string>} requiredRoles - Array of required role names
     * @returns {Promise<Object>} Validation result
     */
    async validateRequiredRoles(requiredRoles) {
        if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
            throw new Error('Required roles array is required');
        }

        const existingRoles = await this.find({ name: { $in: requiredRoles } });
        const existingNames = existingRoles.map(r => r.name);
        const missingRoles = requiredRoles.filter(name => !existingNames.includes(name));

        return {
            valid: missingRoles.length === 0,
            missingRoles,
            existingRoles: existingNames
        };
    }
}

export default RoleRepository;
