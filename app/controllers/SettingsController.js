/**
 * SettingsController
 * 
 * Handles system settings management:
 * - CRUD operations for settings
 * - Settings categories
 * - Import/export settings
 * - Public settings access
 * 
 * @module controllers/SettingsController
 */

import BaseController from './BaseController.js';
import { settingsService } from '../services/index.js';

class SettingsController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get all settings
     * GET /api/v1/settings
     * Access: Admin only
     */
    getAllSettings = this.asyncHandler(async (req, res) => {
        const pagination = this.getPagination(req);
        const { category, isPublic } = this.getRequestQuery(req);

        const filters = {};
        if (category) filters.category = category;
        if (isPublic !== undefined) filters.isPublic = isPublic === 'true';

        try {
            const result = await settingsService.getAllSettings({
                ...filters,
                ...pagination
            });

            return this.sendPaginatedResponse(
                res,
                result.settings,
                { total: result.total, ...pagination },
                'Settings retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get setting by key
     * GET /api/v1/settings/:key
     * Access: Admin (all settings), Public (public settings only)
     */
    getSettingByKey = this.asyncHandler(async (req, res) => {
        const { key } = this.getRequestParams(req);

        try {
            const setting = await settingsService.getSettingByKey(key);
            
            if (!setting) {
                return this.sendNotFound(res, 'Setting not found');
            }

            // Check if setting is public or user is admin
            if (!setting.isPublic && !this.isAdmin(req)) {
                return this.sendForbidden(res, 'This setting is not publicly accessible');
            }

            return this.sendSuccess(res, setting, 'Setting retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get settings by category
     * GET /api/v1/settings/category/:category
     * Access: Admin only
     */
    getSettingsByCategory = this.asyncHandler(async (req, res) => {
        const { category } = this.getRequestParams(req);

        try {
            const settings = await settingsService.getSettingsByCategory(category);
            return this.sendSuccess(res, settings, 'Settings retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Create new setting
     * POST /api/v1/settings
     * Access: Admin only
     */
    createSetting = this.asyncHandler(async (req, res) => {
        const settingData = this.getRequestBody(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            settingData,
            ['key', 'value', 'category']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate key format (alphanumeric, dots, underscores, hyphens)
        const keyRegex = /^[a-zA-Z0-9._-]+$/;
        if (!keyRegex.test(settingData.key)) {
            return this.sendBadRequest(res, 'Invalid key format. Use only alphanumeric characters, dots, underscores, and hyphens');
        }

        // Validate category
        const validCategories = ['general', 'email', 'payment', 'voting', 'security', 'ui', 'api'];
        if (!this.isValidEnum(settingData.category, validCategories)) {
            return this.sendBadRequest(res, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
        }

        try {
            const setting = await settingsService.createSetting(settingData);
            return this.sendCreated(res, setting, 'Setting created successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Update setting
     * PUT /api/v1/settings/:key
     * Access: Admin only
     */
    updateSetting = this.asyncHandler(async (req, res) => {
        const { key } = this.getRequestParams(req);
        const updates = this.getRequestBody(req);

        // Prevent key changes
        delete updates.key;

        // Validate category if provided
        if (updates.category) {
            const validCategories = ['general', 'email', 'payment', 'voting', 'security', 'ui', 'api'];
            if (!this.isValidEnum(updates.category, validCategories)) {
                return this.sendBadRequest(res, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
            }
        }

        try {
            const setting = await settingsService.updateSetting(key, updates);
            
            if (!setting) {
                return this.sendNotFound(res, 'Setting not found');
            }

            return this.sendSuccess(res, setting, 'Setting updated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Delete setting
     * DELETE /api/v1/settings/:key
     * Access: Admin only
     */
    deleteSetting = this.asyncHandler(async (req, res) => {
        const { key } = this.getRequestParams(req);

        try {
            const deleted = await settingsService.deleteSetting(key);
            
            if (!deleted) {
                return this.sendNotFound(res, 'Setting not found');
            }

            return this.sendNoContent(res);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get public settings
     * GET /api/v1/settings/public
     * Access: Public
     */
    getPublicSettings = this.asyncHandler(async (req, res) => {
        try {
            const settings = await settingsService.getPublicSettings();
            return this.sendSuccess(res, settings, 'Public settings retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Bulk update settings
     * PUT /api/v1/settings/bulk
     * Access: Admin only
     */
    bulkUpdateSettings = this.asyncHandler(async (req, res) => {
        const { settings } = this.getRequestBody(req);

        if (!settings || !Array.isArray(settings) || settings.length === 0) {
            return this.sendBadRequest(res, 'settings must be a non-empty array');
        }

        // Validate each setting
        for (const setting of settings) {
            if (!setting.key || !setting.value) {
                return this.sendBadRequest(res, 'Each setting must have a key and value');
            }
        }

        try {
            const result = await settingsService.bulkUpdateSettings(settings);
            return this.sendSuccess(res, result, 'Settings updated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Export settings
     * GET /api/v1/settings/export
     * Access: Admin only
     */
    exportSettings = this.asyncHandler(async (req, res) => {
        const { category, format = 'json' } = this.getRequestQuery(req);

        // Validate format
        if (!this.isValidEnum(format, ['json', 'env'])) {
            return this.sendBadRequest(res, 'Invalid format. Must be: json or env');
        }

        try {
            const exported = await settingsService.exportSettings({
                category,
                format
            });

            // Set appropriate content type
            const contentType = format === 'json' ? 'application/json' : 'text/plain';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="settings-${Date.now()}.${format === 'env' ? 'txt' : 'json'}"`);

            return res.send(exported);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Import settings
     * POST /api/v1/settings/import
     * Access: Admin only
     */
    importSettings = this.asyncHandler(async (req, res) => {
        const { settings, overwrite = false } = this.getRequestBody(req);

        if (!settings || !Array.isArray(settings) || settings.length === 0) {
            return this.sendBadRequest(res, 'settings must be a non-empty array');
        }

        // Validate each setting
        for (const setting of settings) {
            if (!setting.key || !setting.value || !setting.category) {
                return this.sendBadRequest(res, 'Each setting must have key, value, and category');
            }
        }

        try {
            const result = await settingsService.importSettings(settings, overwrite);
            return this.sendSuccess(res, result, 'Settings imported successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Reset settings to defaults
     * POST /api/v1/settings/reset
     * Access: Admin only
     */
    resetSettings = this.asyncHandler(async (req, res) => {
        const { category } = this.getRequestBody(req);

        try {
            const result = await settingsService.resetToDefaults(category);
            return this.sendSuccess(res, result, 'Settings reset to defaults');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get setting history/audit log
     * GET /api/v1/settings/:key/history
     * Access: Admin only
     */
    getSettingHistory = this.asyncHandler(async (req, res) => {
        const { key } = this.getRequestParams(req);
        const pagination = this.getPagination(req);

        try {
            const result = await settingsService.getSettingHistory(key, pagination);

            return this.sendPaginatedResponse(
                res,
                result.history,
                { total: result.total, ...pagination },
                'Setting history retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default SettingsController;
