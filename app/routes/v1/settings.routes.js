#!/usr/bin/env node
/**
 * Settings Routes
 * 
 * @module routes/v1/settings
 */

import express from 'express';
import SettingsController from '../../controllers/SettingsController.js';
import { requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const settingsController = new SettingsController();

/**
 * @route GET /api/v1/settings
 * @desc Get all settings
 * @access Private (Admin - Level 3+)
 */
router.get('/', requireLevel(3), (req, res) => settingsController.getAllSettings(req, res));

/**
 * @route GET /api/v1/settings/:key
 * @desc Get setting by key
 * @access Private (Admin - Level 3+)
 */
router.get('/:key', requireLevel(3), (req, res) => settingsController.getSettingByKey(req, res));

/**
 * @route PUT /api/v1/settings/:key
 * @desc Update setting
 * @access Private (Super Admin - Level 4+)
 */
router.put('/:key', requireLevel(4), (req, res) => settingsController.updateSetting(req, res));

/**
 * @route POST /api/v1/settings
 * @desc Create new setting
 * @access Private (Super Admin - Level 4+)
 */
router.post('/', requireLevel(4), (req, res) => settingsController.createSetting(req, res));

/**
 * @route DELETE /api/v1/settings/:key
 * @desc Delete setting
 * @access Private (Super Admin - Level 4+)
 */
router.delete('/:key', requireLevel(4), (req, res) => settingsController.deleteSetting(req, res));

/**
 * @route GET /api/v1/settings/group/:group
 * @desc Get settings by group
 * @access Private (Admin - Level 3+)
 */
router.get('/group/:group', requireLevel(3), (req, res) => settingsController.getSettingsByGroup(req, res));

/**
 * @route PUT /api/v1/settings/bulk/update
 * @desc Bulk update settings
 * @access Private (Super Admin - Level 4+)
 */
router.put('/bulk/update', requireLevel(4), (req, res) => settingsController.bulkUpdateSettings(req, res));

export default router;
