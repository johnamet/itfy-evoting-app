#!/usr/bin/env node

/**
 * Settings Routes
 * 
 * Defines all HTTP routes for Settings operations
 */

import express from 'express';
import SettingsController from '../controllers/SettingsController.js';

const router = express.Router();
const settingsController = new SettingsController();

/**
 * Public Settings Routes (No authentication required)
 */

/**
 * @swagger
 * /api/v1/settings/public:
 *   get:
 *     summary: Get public settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Public settings retrieved successfully
 */
router.get('/public', settingsController.getPublicSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/site-config:
 *   get:
 *     summary: Get site configuration
 *     tags: [Settings]
 */
router.get('/site-config', settingsController.getSiteConfig.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/theme:
 *   get:
 *     summary: Get theme settings
 *     tags: [Settings]
 */
// router.get('/theme', settingsController.get.bind(settingsController));

/**
 * Protected Settings Routes (Authentication required)
 */

/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: Get all settings
 *     tags: [Settings]
 */
router.get('/', settingsController.getAllSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/model/{model}:
 *   get:
 *     summary: Get model-specific settings
 *     tags: [Settings]
 */
router.get('/model/:model',  settingsController.getModelSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/category/{category}:
 *   get:
 *     summary: Get settings by category
 *     tags: [Settings]
 */
router.get('/category/:category',  settingsController.getSettingsByCategory.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings:
 *   post:
 *     summary: Create new setting
 *     tags: [Settings]
 */
// router.post('/', settingsController.createSetting.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/bulk:
 *   post:
 *     summary: Create multiple settings
 *     tags: [Settings]
 */
// router.post('/bulk', settingsController.createBulkSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/initialize:
 *   post:
 *     summary: Initialize default settings
 *     tags: [Settings]
 */
router.post('/initialize', settingsController.initializeDefaultSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/{id}:
 *   put:
 *     summary: Update setting
 *     tags: [Settings]
 */
router.put('/:id', settingsController.updateSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/bulk-update:
 *   put:
 *     summary: Update multiple settings
 *     tags: [Settings]
 */
// router.put('/bulk-update', settingsController.updateBulkSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/site-config:
 *   put:
 *     summary: Update site configuration
 *     tags: [Settings]
 */
router.put('/site-config', settingsController.updateSiteConfig.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/theme:
 *   put:
 *     summary: Update theme settings
 *     tags: [Settings]
 */
    // router.put('/theme', settingsController.update.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/{id}:
 *   delete:
 *     summary: Delete setting
 *     tags: [Settings]
 */
router.delete('/:id', settingsController.deleteSetting.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/reset:
 *   delete:
 *     summary: Reset all settings to defaults
 *     tags: [Settings]
 */
router.delete('/reset', settingsController.restoreSettings.bind(settingsController));

/**
 * Backup & Restore Routes
 */

/**
 * @swagger
 * /api/v1/settings/backup:
 *   post:
 *     summary: Create settings backup
 *     tags: [Settings]
 */
// router.post('/backup', settingsController.c.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/restore:
 *   post:
 *     summary: Restore settings from backup
 *     tags: [Settings]
 */
router.post('/restore', settingsController.restoreSettings.bind(settingsController));

/**
 * @swagger
 * /api/v1/settings/backup/list:
 *   get:
 *     summary: List available backups
 *     tags: [Settings]
 */
// router.get('/backup/list', settingsController.listBackups.bind(settingsController));

export default router;
