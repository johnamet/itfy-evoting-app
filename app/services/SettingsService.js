#!/usr/bin/env node

/**
 * Settings Service
 * 
 * Business logic for Settings operations
 */

import BaseService from './BaseService.js';
import SettingsRepository from '../repositories/SettingsRepository.js';

class SettingsService extends BaseService {
    constructor() {
        super();
        this.repository = new SettingsRepository();
    }

    /**
     * Get setting by key
     */
    async getSetting(key, type = 'general', modelType = null, modelId = null) {
        try {
            const setting = await this.repository.findByKey(key, type, modelType, modelId);
            return setting ? setting.value : null;
        } catch (error) {
            throw new Error(`Error getting setting: ${error.message}`);
        }
    }

    /**
     * Set setting value
     */
    async setSetting(key, value, type = 'general', userId = null, options = {}) {
        try {
            const settingData = {
                key,
                value,
                type,
                lastChangedBy: userId,
                lastChangedAt: new Date(),
                ...options
            };

            return await this.repository.upsertSetting(settingData);
        } catch (error) {
            throw new Error(`Error setting value: ${error.message}`);
        }
    }

    /**
     * Get all general settings (for frontend)
     */
    async getGeneralSettings() {
        try {
            const settings = await this.repository.findByType('general');
            const settingsObj = {};
            
            settings.forEach(setting => {
                settingsObj[setting.key] = setting.value;
            });

            return settingsObj;
        } catch (error) {
            throw new Error(`Error getting general settings: ${error.message}`);
        }
    }

    /**
     * Get model-specific settings
     */
    async getModelSettings(modelType, modelId = null) {
        try {
            const settings = await this.repository.findByModelType(modelType, modelId);
            const settingsObj = {};
            
            settings.forEach(setting => {
                settingsObj[setting.key] = setting.value;
            });

            return settingsObj;
        } catch (error) {
            throw new Error(`Error getting model settings: ${error.message}`);
        }
    }

    /**
     * Update multiple settings at once
     */
    async updateSettings(settingsData, userId = null) {
        try {
            const results = [];
            
            for (const [key, data] of Object.entries(settingsData)) {
                const setting = await this.setSetting(
                    key, 
                    data.value, 
                    data.type || 'general', 
                    userId,
                    {
                        name: data.name,
                        description: data.description,
                        category: data.category,
                        modelType: data.modelType,
                        modelId: data.modelId
                    }
                );
                results.push(setting);
            }

            return results;
        } catch (error) {
            throw new Error(`Error updating settings: ${error.message}`);
        }
    }

    /**
     * Initialize default system settings
     */
    async initializeDefaultSettings(userId = null) {
        try {
            const defaultSettings = {
                // General site settings
                'site.name': {
                    value: 'ITFY E-Voting System',
                    name: 'Site Name',
                    description: 'The name of the website displayed in headers and footers',
                    category: 'general',
                    type: 'general'
                },
                'site.description': {
                    value: 'Ghana\'s premier technology awards and voting platform',
                    name: 'Site Description',
                    description: 'Brief description of the website',
                    category: 'general',
                    type: 'general'
                },
                'site.logo': {
                    value: '/images/logo.png',
                    name: 'Site Logo',
                    description: 'Path to the main site logo',
                    category: 'general',
                    type: 'general'
                },
                'site.favicon': {
                    value: '/images/favicon.ico',
                    name: 'Site Favicon',
                    description: 'Path to the site favicon',
                    category: 'general',
                    type: 'general'
                },

                // Contact information
                'contact.email': {
                    value: 'info@itfy.com',
                    name: 'Contact Email',
                    description: 'Main contact email address',
                    category: 'contact',
                    type: 'general'
                },
                'contact.phone': {
                    value: '+233 24 123 4567',
                    name: 'Contact Phone',
                    description: 'Main contact phone number',
                    category: 'contact',
                    type: 'general'
                },
                'contact.address': {
                    value: 'Accra Digital Centre, Ridge, Accra, Ghana',
                    name: 'Contact Address',
                    description: 'Physical address of the organization',
                    category: 'contact',
                    type: 'general'
                },

                // Social media links
                'social.facebook': {
                    value: 'https://facebook.com/itfyghana',
                    name: 'Facebook URL',
                    description: 'Facebook page URL',
                    category: 'social',
                    type: 'general'
                },
                'social.twitter': {
                    value: 'https://twitter.com/itfyghana',
                    name: 'Twitter URL',
                    description: 'Twitter profile URL',
                    category: 'social',
                    type: 'general'
                },
                'social.linkedin': {
                    value: 'https://linkedin.com/company/itfyghana',
                    name: 'LinkedIn URL',
                    description: 'LinkedIn company page URL',
                    category: 'social',
                    type: 'general'
                },
                'social.instagram': {
                    value: 'https://instagram.com/itfyghana',
                    name: 'Instagram URL',
                    description: 'Instagram profile URL',
                    category: 'social',
                    type: 'general'
                },
                'social.youtube': {
                    value: 'https://youtube.com/itfyghana',
                    name: 'YouTube URL',
                    description: 'YouTube channel URL',
                    category: 'social',
                    type: 'general'
                },

                // Theme settings
                'theme.primary_color': {
                    value: '#007bff',
                    name: 'Primary Color',
                    description: 'Main brand color',
                    category: 'theme',
                    type: 'theme'
                },
                'theme.secondary_color': {
                    value: '#6c757d',
                    name: 'Secondary Color',
                    description: 'Secondary brand color',
                    category: 'theme',
                    type: 'theme'
                },
                'theme.dark_mode': {
                    value: false,
                    name: 'Dark Mode',
                    description: 'Enable dark mode by default',
                    category: 'theme',
                    type: 'theme'
                },

                // System settings
                'system.maintenance_mode': {
                    value: false,
                    name: 'Maintenance Mode',
                    description: 'Put the site in maintenance mode',
                    category: 'system',
                    type: 'system'
                },
                'system.registration_enabled': {
                    value: true,
                    name: 'Registration Enabled',
                    description: 'Allow new user registration',
                    category: 'system',
                    type: 'system'
                },
                'system.voting_enabled': {
                    value: true,
                    name: 'Voting Enabled',
                    description: 'Enable voting functionality',
                    category: 'system',
                    type: 'system'
                },

                // Email settings
                'email.notifications_enabled': {
                    value: true,
                    name: 'Email Notifications',
                    description: 'Enable email notifications',
                    category: 'email',
                    type: 'email'
                },
                'email.smtp_host': {
                    value: 'smtp.gmail.com',
                    name: 'SMTP Host',
                    description: 'SMTP server hostname',
                    category: 'email',
                    type: 'email'
                },
                'email.smtp_port': {
                    value: 587,
                    name: 'SMTP Port',
                    description: 'SMTP server port',
                    category: 'email',
                    type: 'email'
                },

                // Payment settings
                'payment.default_currency': {
                    value: 'GHS',
                    name: 'Default Currency',
                    description: 'Default currency for payments',
                    category: 'payment',
                    type: 'payment'
                },
                'payment.paystack_enabled': {
                    value: true,
                    name: 'Paystack Enabled',
                    description: 'Enable Paystack payment gateway',
                    category: 'payment',
                    type: 'payment'
                }
            };

            return await this.updateSettings(defaultSettings, userId);
        } catch (error) {
            throw new Error(`Error initializing default settings: ${error.message}`);
        }
    }

    /**
     * Get settings by category
     */
    async getSettingsByCategory(category) {
        try {
            return await this.repository.findByCategory(category);
        } catch (error) {
            throw new Error(`Error getting settings by category: ${error.message}`);
        }
    }

    /**
     * Delete setting
     */
    async deleteSetting(key, type = 'general', modelType = null, modelId = null) {
        try {
            return await this.repository.deleteSetting(key, type, modelType, modelId);
        } catch (error) {
            throw new Error(`Error deleting setting: ${error.message}`);
        }
    }

    /**
     * Get public settings (for frontend without sensitive data)
     */
    async getPublicSettings() {
        try {
            const publicCategories = ['general', 'contact', 'social', 'theme'];
            const settings = {};

            for (const category of publicCategories) {
                const categorySettings = await this.getSettingsByCategory(category);
                categorySettings.forEach(setting => {
                    // Only include non-sensitive settings
                    if (!setting.key.includes('password') && 
                        !setting.key.includes('secret') && 
                        !setting.key.includes('key')) {
                        settings[setting.key] = setting.value;
                    }
                });
            }

            return settings;
        } catch (error) {
            throw new Error(`Error getting public settings: ${error.message}`);
        }
    }

    /**
     * Backup all settings
     */
    async backupSettings() {
        try {
            const allSettings = await this.repository.findAll();
            return {
                timestamp: new Date().toISOString(),
                settings: allSettings
            };
        } catch (error) {
            throw new Error(`Error backing up settings: ${error.message}`);
        }
    }

    /**
     * Restore settings from backup
     */
    async restoreSettings(backupData, userId = null) {
        try {
            const results = [];
            
            for (const setting of backupData.settings) {
                const restored = await this.setSetting(
                    setting.key,
                    setting.value,
                    setting.type,
                    userId,
                    {
                        name: setting.name,
                        description: setting.description,
                        category: setting.category,
                        modelType: setting.modelType,
                        modelId: setting.modelId
                    }
                );
                results.push(restored);
            }

            return results;
        } catch (error) {
            throw new Error(`Error restoring settings: ${error.message}`);
        }
    }
}

export default SettingsService;
