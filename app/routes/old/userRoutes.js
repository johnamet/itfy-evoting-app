#!/usr/bin/env node
/**
 * User Routes
 * 
 * Defines API endpoints for user management operations.
 */

import express from 'express';
import multer from 'multer';
import UserController from '../controllers/UserController.js';
import auth, { 
    optionalAuth, 
    requireRead, 
    requireUpdate, 
    requireDelete, 
    requireCreate,
    requireLevel, 
    authenticate
} from '../middleware/auth.js';

const router = express.Router();
const userController = new UserController();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/avatars/' });


router.use(authenticate);

// Role management operations (require admin-level access)
router.get('/roles',   requireLevel(1), (req, res) => userController.getRoles(req, res));
router.post('/roles',   requireLevel(3), (req, res) => userController.createRole(req, res));
router.get('/roles/:roleId',   requireLevel(1), (req, res) => userController.getRoleById(req, res));
router.put('/roles/:roleId',   requireLevel(2), (req, res) => userController.updateRole(req, res));
router.delete('/roles/:roleId',   requireLevel(4), (req, res) => userController.deleteRole(req, res));
router.get('/roles/:roleId/permissions',   requireLevel(1), (req, res) => userController.getRolePermissions(req, res));
router.put('/roles/:roleId/permissions',   requireLevel(3), (req, res) => userController.updateRolePermissions(req, res));
router.post('/:userId/roles/:roleId',   requireLevel(3), (req, res) => userController.assignRoleToUser(req, res));
router.delete('/:userId/roles/:roleId',   requireLevel(3), (req, res) => userController.removeRoleFromUser(req, res));
router.get('/:id/roles',   requireLevel(1), (req, res) => userController.getUserRoles(req, res));

// User CRUD operations
router.get('/',  requireLevel(1, "read"), (req, res) => userController.getUsers(req, res));
router.get('/search',   requireLevel(1, "read"), (req, res) => userController.searchUsers(req, res));
router.get('/role/:role',  requireLevel(1, "read"),  (req, res) => userController.getUsersByRole(req, res));
router.get('/:id',   requireLevel(1, "read"), (req, res) => userController.getUserById(req, res));
router.put('/:id',   requireLevel(2, "update"), (req, res) => userController.updateUser(req, res));
router.delete('/:id', (req, res) => userController.deleteUser(req, res));
router.post('/', requireLevel(3, "create"), (req, res) => userController.createUser(req, res));
router.get('/:id/stats',  (req, res) => userController.getUserStats(req, res));

// User operations
router.get('/:id/activity',   requireLevel(1, "read"),  (req, res) => userController.getUserActivity(req, res));

// File operations
router.post('/:id/avatar',   requireLevel(3, "create"), requireUpdate, upload.single('avatar'), (req, res) => userController.uploadAvatar(req, res));

// Admin operations (require higher level access)
router.patch('/:id/role',   requireLevel(3, "update"), (req, res) => userController.updateUserRole(req, res));
router.patch('/:id/status',   requireLevel(3, "update"),  (req, res) => userController.updateUserStatus(req, res));
router.patch('/bulk-update',   requireLevel(4) , (req, res) => userController.bulkUpdateUsers(req, res));


export default router;
