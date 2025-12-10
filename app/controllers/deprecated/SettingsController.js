#!/usr/bin/env node

/**
 * Settings Controller
 * 
 * Handles HTTP requests for Settings operations
 */

import BaseController from './BaseController.js';
import SettingsService from '../services/SettingsService.js';

class SettingsController extends BaseController {
    constructor() {
        super();
        this.settingsService = new SettingsService();
    }

    /**
     * Get all settings
     * GET /api/v1/settings
     */
    async getAllSettings(req, res) {
        try {
            const { type, category, modelType, modelId } = req.query;
            const filters = {};

            if (type) filters.type = type;
            if (category) filters.category = category;
            if (modelType) filters.modelType = modelType;
            if (modelId) filters.modelId = modelId;

            const settings = await this.settingsService.findAll(filters, {
                sort: { category: 1, key: 1 },
                populate: [
                    { path: 'lastChangedBy', select: 'name email' },
                    { path: 'modelId' }
                ]
            });

            this.sendResponse(res, 200, settings, 'Settings retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get general settings (public)
     * GET /api/v1/settings/general
     */
    async getGeneralSettings(req, res) {
        try {
            const settings = await this.settingsService.getGeneralSettings();

            this.sendResponse(res, 200, settings, 'General settings retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get public settings (for frontend)
     * GET /api/v1/settings/public
     */
    async getPublicSettings(req, res) {
        try {
            const settings = await this.settingsService.getPublicSettings();

            this.sendResponse(res, 200, settings, 'Public settings retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get model settings
     * GET /api/v1/settings/model/:modelType
     */
    async getModelSettings(req, res) {
        try {
            const { modelType } = req.params;
            const { modelId } = req.query;

            const settings = await this.settingsService.getModelSettings(modelType, modelId);

            this.sendResponse(res, 200, settings, `${modelType} settings retrieved successfully`);
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get settings by category
     * GET /api/v1/settings/category/:category
     */
    async getSettingsByCategory(req, res) {
        try {
            const { category } = req.params;

            const settings = await this.settingsService.getSettingsByCategory(category);

            this.sendResponse(res, 200, settings, `${category} settings retrieved successfully`);
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get single setting
     * GET /api/v1/settings/:key
     */
    async getSetting(req, res) {
        try {
            const { key } = req.params;
            const { type = 'general', modelType, modelId } = req.query;

            const value = await this.settingsService.getSetting(key, type, modelType, modelId);

            if (value === null) {
                return this.sendError(res, 404, 'Setting not found');
            }

            this.sendResponse(res, 200, { key, value }, 'Setting retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Set single setting
     * PUT /api/v1/settings/:key
     */
    async setSetting(req, res) {
        try {
            const { key } = req.params;
            const { value, type = 'general', name, description, category, modelType, modelId } = req.body;
            const userId = req.user?._id;

            const setting = await this.settingsService.setSetting(key, value, type, userId, {
                name,
                description,
                category,
                modelType,
                modelId
            });

            this.sendResponse(res, 200, setting, 'Setting updated successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Update multiple settings
     * PUT /api/v1/settings
     */
    async updateSettings(req, res) {
        try {
            const settingsData = req.body;
            const userId = req.user?._id;

            const results = await this.settingsService.updateSettings(settingsData, userId);

            this.sendResponse(res, 200, results, 'Settings updated successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Delete setting
     * DELETE /api/v1/settings/:key
     */
    async deleteSetting(req, res) {
        try {
            const { key } = req.params;
            const { type = 'general', modelType, modelId } = req.query;

            const deleted = await this.settingsService.deleteSetting(key, type, modelType, modelId);

            if (!deleted) {
                return this.sendError(res, 404, 'Setting not found');
            }

            this.sendResponse(res, 200, null, 'Setting deleted successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Initialize default settings
     * POST /api/v1/settings/initialize
     */
    async initializeDefaultSettings(req, res) {
        try {
            const userId = req.user?._id;

            const results = await this.settingsService.initializeDefaultSettings(userId);

            this.sendResponse(res, 201, results, 'Default settings initialized successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Backup settings
     * GET /api/v1/settings/backup
     */
    async backupSettings(req, res) {
        try {
            const backup = await this.settingsService.backupSettings();

            // Set headers for file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="settings-backup-${Date.now()}.json"`);

            this.sendResponse(res, 200, backup, 'Settings backup created successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Restore settings
     * POST /api/v1/settings/restore
     */
    async restoreSettings(req, res) {
        try {
            const backupData = req.body;
            const userId = req.user?._id;

            if (!backupData.settings || !Array.isArray(backupData.settings)) {
                return this.sendError(res, 400, 'Invalid backup data format');
            }

            const results = await this.settingsService.restoreSettings(backupData, userId);

            this.sendResponse(res, 200, results, 'Settings restored successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Get site configuration (for frontend)
     * GET /api/v1/settings/site-config
     */
    async getSiteConfig(req, res) {
        try {
            const publicSettings = await this.settingsService.getPublicSettings();
            
            // Structure the response for frontend consumption
            const siteConfig = {
                site: {
                    name: publicSettings['site.name'] || 'ITFY E-Voting System',
                    description: publicSettings['site.description'] || 'Ghana\'s premier technology awards platform',
                    logo: publicSettings['site.logo'] || '/images/logo.png',
                    favicon: publicSettings['site.favicon'] || '/images/favicon.ico'
                },
                contact: {
                    email: publicSettings['contact.email'] || 'info@itfy.com',
                    phone: publicSettings['contact.phone'] || '+233 24 123 4567',
                    address: publicSettings['contact.address'] || 'Accra Digital Centre, Ridge, Accra, Ghana'
                },
                social: {
                    facebook: publicSettings['social.facebook'],
                    twitter: publicSettings['social.twitter'],
                    linkedin: publicSettings['social.linkedin'],
                    instagram: publicSettings['social.instagram'],
                    youtube: publicSettings['social.youtube']
                },
                theme: {
                    primaryColor: publicSettings['theme.primary_color'] || '#007bff',
                    secondaryColor: publicSettings['theme.secondary_color'] || '#6c757d',
                    darkMode: publicSettings['theme.dark_mode'] || false
                }
            };

            this.sendResponse(res, 200, siteConfig, 'Site configuration retrieved successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }

    /**
     * Update site configuration
     * PUT /api/v1/settings/site-config
     */
    async updateSiteConfig(req, res) {
        try {
            const { site, contact, social, theme } = req.body;
            const userId = req.user?._id;
            const results = [];

            // Update site settings
            if (site) {
                for (const [key, value] of Object.entries(site)) {
                    const setting = await this.settingsService.setSetting(
                        `site.${key}`, 
                        value, 
                        'general', 
                        userId,
                        { category: 'general' }
                    );
                    results.push(setting);
                }
            }

            // Update contact settings
            if (contact) {
                for (const [key, value] of Object.entries(contact)) {
                    const setting = await this.settingsService.setSetting(
                        `contact.${key}`, 
                        value, 
                        'general', 
                        userId,
                        { category: 'contact' }
                    );
                    results.push(setting);
                }
            }

            // Update social settings
            if (social) {
                for (const [key, value] of Object.entries(social)) {
                    const setting = await this.settingsService.setSetting(
                        `social.${key}`, 
                        value, 
                        'general', 
                        userId,
                        { category: 'social' }
                    );
                    results.push(setting);
                }
            }

            // Update theme settings
            if (theme) {
                for (const [key, value] of Object.entries(theme)) {
                    const setting = await this.settingsService.setSetting(
                        `theme.${key}`, 
                        value, 
                        'theme', 
                        userId,
                        { category: 'theme' }
                    );
                    results.push(setting);
                }
            }

            this.sendResponse(res, 200, results, 'Site configuration updated successfully');
        } catch (error) {
            this.sendError(res, 500, error.message);
        }
    }
}

export default SettingsController;
