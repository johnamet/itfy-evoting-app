#!/usr/bin/env node
/**
 * User Controller
 * 
 * Handles user management operations.
 *
 * @swagger
 * tags:
 *   name: Users
 *   description: Manages user operations such as registration and roles
 */

import BaseController from './BaseController.js';
import UserService from '../services/UserService.js';

export default class UserController extends BaseController {
    constructor() {
        super();
        this.userService = new UserService();
    }

    /**
     * Get current user profile
     * GET /api/users/profile
     */
    async getProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return this.sendError(res, 'User not authenticated', 401);
            }

            const user = await this.userService.getUserById(userId, true);
            
            if (!user) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, user, 'Profile retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get profile');
        }
    }

    /**
     * Update current user profile
     * PUT /api/users/profile
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return this.sendError(res, 'User not authenticated', 401);
            }

            const updateData = req.body;
            
            // Remove sensitive fields that shouldn't be updated via profile
            delete updateData.role;
            delete updateData.status;
            delete updateData.permissions;

            const user = await this.userService.updateUser(userId, {
                ...updateData,
                updatedBy: userId
            });

            if (!user) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, user, 'Profile updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update profile');
        }
    }

    /**
     * Get all users with filtering and pagination
     */
    async getUsers(req, res) {
        try {
            const query = req.query;
            const users = await this.userService.getUsers(query);
            return this.sendSuccess(res, users, 'Users retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get users');
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const includeActivity = req.query.include === 'activity';

            const user = await this.userService.getUserById(id, includeActivity);
            
            if (!user) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, user, 'User retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get user');
        }
    }

    /**
     * Update user
     */
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            // Check if user is updating their own profile or has admin rights
            if (id !== updatedBy && req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const user = await this.userService.updateUser(id, {
                ...updateData,
                updatedBy
            });

            if (!user) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, user, 'User updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update user');
        }
    }

    /**
     * Delete user (soft delete)
     */
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            // Only admins can delete users
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.userService.deleteUser(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, null, 'User deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete user');
        }
    }

    /**
     * Update user role
     */
    async updateUserRole(req, res) {
        try {
            const { id } = req.params;
            const { role } = req.body;
            const updatedBy = req.user?.id;

            // Only admins can update user roles
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!role) {
                return this.sendError(res, 'Role is required', 400);
            }

            const user = await this.userService.updateUserRole(id, role, updatedBy);

            if (!user) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, user, 'User role updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update user role');
        }
    }

    /**
     * Update user status (active/inactive)
     */
    async updateUserStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedBy = req.user?.id;

            // Only admins can update user status
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const user = await this.userService.updateUserStatus(id, status, updatedBy);

            if (!user) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, user, 'User status updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update user status');
        }
    }

    /**
     * Get user activity log
     */
    async getUserActivity(req, res) {
        try {
            const { id } = req.params;
            const query = req.query;

            // Users can only view their own activity unless they're admin
            if (id !== req.user?.id && req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const activity = await this.userService.getUserActivity(id, query);
            return this.sendSuccess(res, activity, 'User activity retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get user activity');
        }
    }

    /**
     * Upload user avatar
     */
    async uploadAvatar(req, res) {
        try {
            const { id } = req.params;
            const file = req.file;

            // Users can only upload their own avatar unless they're admin
            if (id !== req.user?.id && req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!file) {
                return this.sendError(res, 'Avatar file is required', 400);
            }

            const avatarUrl = await this.userService.uploadAvatar(id, file);

            if (!avatarUrl) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, { avatarUrl }, 'Avatar uploaded successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to upload avatar');
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(req, res) {
        try {
            const { id } = req.params;

            // Users can only view their own stats unless they're admin
            if (id !== req.user?.id && req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const stats = await this.userService.getUserStats(id);

            if (!stats) {
                return this.sendError(res, 'User not found', 404);
            }

            return this.sendSuccess(res, stats, 'User statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get user statistics');
        }
    }

    /**
     * Search users
     */
    async searchUsers(req, res) {
        try {
            const { q } = req.query;

            if (!q) {
                return this.sendError(res, 'Search query is required', 400);
            }

            const users = await this.userService.searchUsers(q, req.query);
            return this.sendSuccess(res, users, 'User search completed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to search users');
        }
    }

    /**
     * Get users by role
     */
    async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            const query = req.query;

            const users = await this.userService.getUsersByRole(role, query);
            return this.sendSuccess(res, users, 'Users by role retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get users by role');
        }
    }

    /**
     * Bulk update users
     */
    async bulkUpdateUsers(req, res) {
        try {
            const { userIds, updateData } = req.body;
            const updatedBy = req.user?.id;

            // Only admins can perform bulk updates
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return this.sendError(res, 'User IDs array is required', 400);
            }

            const result = await this.userService.bulkUpdateUsers(userIds, updateData, updatedBy);
            return this.sendSuccess(res, result, 'Bulk user update completed successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to bulk update users');
        }
    }

    // ========== ROLE MANAGEMENT METHODS ==========

    /**
     * Get all available roles
     */
    async getRoles(req, res) {
        try {
            const roles = await this.userService.getRoles();
            return this.sendSuccess(res, roles, 'Roles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get roles');
        }
    }

    /**
     * Create a new role
     */
    async createRole(req, res) {
        try {
            const roleData = req.body;
            const createdBy = req.user?.id;

            // Only admins can create roles
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const role = await this.userService.createRole({
                ...roleData,
                createdBy
            });

            return this.sendSuccess(res, role, 'Role created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create role');
        }
    }

    /**
     * Get role by ID
     */
    async getRoleById(req, res) {
        try {
            const { roleId } = req.params;

            const role = await this.userService.getRoleById(roleId);
            
            if (!role) {
                return this.sendError(res, 'Role not found', 404);
            }

            return this.sendSuccess(res, role, 'Role retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get role');
        }
    }

    /**
     * Update role
     */
    async updateRole(req, res) {
        try {
            const { roleId } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            // Only admins can update roles
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const role = await this.userService.updateRole(roleId, {
                ...updateData,
                updatedBy
            });

            if (!role) {
                return this.sendError(res, 'Role not found', 404);
            }

            return this.sendSuccess(res, role, 'Role updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update role');
        }
    }

    /**
     * Delete role
     */
    async deleteRole(req, res) {
        try {
            const { roleId } = req.params;
            const deletedBy = req.user?.id;

            // Only admins can delete roles
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.userService.deleteRole(roleId, deletedBy);

            if (!result) {
                return this.sendError(res, 'Role not found', 404);
            }

            return this.sendSuccess(res, null, 'Role deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete role');
        }
    }

    /**
     * Get role permissions
     */
    async getRolePermissions(req, res) {
        try {
            const { roleId } = req.params;

            const permissions = await this.userService.getRolePermissions(roleId);
            
            if (!permissions) {
                return this.sendError(res, 'Role not found', 404);
            }

            return this.sendSuccess(res, permissions, 'Role permissions retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get role permissions');
        }
    }

    /**
     * Update role permissions
     */
    async updateRolePermissions(req, res) {
        try {
            const { roleId } = req.params;
            const { permissions } = req.body;
            const updatedBy = req.user?.id;

            // Only admins can update role permissions
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!permissions || !Array.isArray(permissions)) {
                return this.sendError(res, 'Permissions array is required', 400);
            }

            const role = await this.userService.updateRolePermissions(roleId, permissions, updatedBy);

            if (!role) {
                return this.sendError(res, 'Role not found', 404);
            }

            return this.sendSuccess(res, role, 'Role permissions updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update role permissions');
        }
    }

    /**
     * Assign role to user
     */
    async assignRoleToUser(req, res) {
        try {
            const { userId, roleId } = req.params;
            const assignedBy = req.user?.id;

            // Only admins can assign roles
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.userService.assignRoleToUser(userId, roleId, assignedBy);

            if (!result) {
                return this.sendError(res, 'User or role not found', 404);
            }

            return this.sendSuccess(res, result, 'Role assigned to user successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to assign role to user');
        }
    }

    /**
     * Remove role from user
     */
    async removeRoleFromUser(req, res) {
        try {
            const { userId, roleId } = req.params;
            const removedBy = req.user?.id;

            // Only admins can remove roles
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.userService.removeRoleFromUser(userId, roleId, removedBy);

            if (!result) {
                return this.sendError(res, 'User or role not found', 404);
            }

            return this.sendSuccess(res, null, 'Role removed from user successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to remove role from user');
        }
    }

    /**
     * Get user roles
     */
    async getUserRoles(req, res) {
        try {
            const { id } = req.params;

            // Users can only view their own roles unless they're admin
            if (id !== req.user?.id && req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const roles = await this.userService.getUserRoles(id);
            return this.sendSuccess(res, roles, 'User roles retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get user roles');
        }
    }
}
