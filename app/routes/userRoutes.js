#!/usr/bin/env node
/**
 * User Routes
 * 
 * Defines API endpoints for user management operations.
 */

import express from 'express';
import multer from 'multer';
import UserController from '../controllers/UserController.js';
import { 
    optionalAuth, 
    requireRead, 
    requireUpdate, 
    requireDelete, 
    requireCreate,
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const userController = new UserController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/avatars/' });

// User CRUD operations
router.get('/', (req, res) => userController.getUsers(req, res));
router.get('/search', (req, res) => userController.searchUsers(req, res));
router.get('/role/:role', (req, res) => userController.getUsersByRole(req, res));
router.get('/:id', (req, res) => userController.getUserById(req, res));
router.put('/:id', (req, res) => userController.updateUser(req, res));
router.delete('/:id', (req, res) => userController.deleteUser(req, res));

// User operations
router.get('/:id/activity', (req, res) => userController.getUserActivity(req, res));
router.get('/:id/stats', (req, res) => userController.getUserStats(req, res));

// File operations
router.post('/:id/avatar', requireUpdate, upload.single('avatar'), (req, res) => userController.uploadAvatar(req, res));

// Admin operations (require higher level access)
router.patch('/:id/role', requireLevel(3), (req, res) => userController.updateUserRole(req, res));
router.patch('/:id/status', requireLevel(3), (req, res) => userController.updateUserStatus(req, res));
router.patch('/bulk-update', requireLevel(4), (req, res) => userController.bulkUpdateUsers(req, res));

// Role management operations (require admin-level access)
router.get('/roles', requireRead, (req, res) => userController.getRoles(req, res));
router.post('/roles', requireCreate, (req, res) => userController.createRole(req, res));
router.get('/roles/:roleId', requireRead, (req, res) => userController.getRoleById(req, res));
router.put('/roles/:roleId', requireUpdate, (req, res) => userController.updateRole(req, res));
router.delete('/roles/:roleId', requireDelete, (req, res) => userController.deleteRole(req, res));
router.get('/roles/:roleId/permissions', requireRead, (req, res) => userController.getRolePermissions(req, res));
router.put('/roles/:roleId/permissions', requireLevel(3), (req, res) => userController.updateRolePermissions(req, res));
router.post('/:userId/roles/:roleId', requireLevel(3), (req, res) => userController.assignRoleToUser(req, res));
router.delete('/:userId/roles/:roleId', requireLevel(3), (req, res) => userController.removeRoleFromUser(req, res));
router.get('/:id/roles', requireRead, (req, res) => userController.getUserRoles(req, res));

export default router;
