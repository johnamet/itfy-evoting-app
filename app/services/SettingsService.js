/**
 * SettingsService
 * 
 * Handles settings CRUD operations, validation, import/export,
 * and category management for platform-wide configuration.
 * 
 * @extends BaseService
 * @module services/SettingsService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class SettingsService extends BaseService {
    constructor(repositories) {
        super(repositories, {
            serviceName: 'SettingsService',
            primaryRepository: 'settings',
        });

        this.validCategories = [
            'system',
            'email',
            'payment',
            'voting',
            'security',
            'notification',
            'events',
            'uploads',
        ];

        this.validDataTypes = ['string', 'number', 'boolean', 'json', 'array'];
    }

    /**
     * Get setting by key
     */
    async getSetting(key, defaultValue = null) {
        return this.runInContext('getSetting', async () => {
            const setting = await this.repo('settings').findOne({ key });

            if (!setting) {
                return this.handleSuccess({
                    key,
                    value: defaultValue,
                    exists: false,
                }, 'Setting not found, using default value');
            }

            return this.handleSuccess({
                key: setting.key,
                value: setting.value,
                category: setting.category,
                dataType: setting.dataType,
                exists: true,
            }, 'Setting retrieved successfully');
        });
    }

    /**
     * Get settings by category
     */
    async getSettingsByCategory(category) {
        return this.runInContext('getSettingsByCategory', async () => {
            if (!this.validCategories.includes(category)) {
                throw new Error(`Invalid category. Must be one of: ${this.validCategories.join(', ')}`);
            }

            const settings = await this.repo('settings').find({ category });

            const settingsMap = {};
            settings.forEach(setting => {
                settingsMap[setting.key] = setting.value;
            });

            return this.handleSuccess({
                category,
                settings: settingsMap,
                count: settings.length,
            }, 'Settings retrieved successfully');
        });
    }

    /**
     * Get all settings
     */
    async getAllSettings(filters = {}, pagination = {}) {
        return this.runInContext('getAllSettings', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = {};

            // Filter by category
            if (filters.category) {
                query.category = filters.category;
            }

            // Search by key or description
            if (filters.search) {
                query.$or = [
                    { key: { $regex: filters.search, $options: 'i' } },
                    { description: { $regex: filters.search, $options: 'i' } },
                ];
            }

            // Filter by public visibility
            if (filters.isPublic !== undefined) {
                query.isPublic = filters.isPublic === 'true';
            }

            const settings = await this.repo('settings').findWithPagination(query, {
                page,
                limit,
                sort: filters.sort || { category: 1, key: 1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(settings.docs, settings.total, page, limit),
                'Settings retrieved successfully'
            );
        });
    }

    /**
     * Create or update setting
     */
    async setSetting(key, value, metadata = {}, userId) {
        return this.runInContext('setSetting', async () => {
            // Validate key format (alphanumeric, dots, underscores)
            if (!/^[a-zA-Z0-9._]+$/.test(key)) {
                throw new Error('Invalid key format. Use alphanumeric characters, dots, and underscores only.');
            }

            // Validate category if provided
            if (metadata.category && !this.validCategories.includes(metadata.category)) {
                throw new Error(`Invalid category. Must be one of: ${this.validCategories.join(', ')}`);
            }

            // Validate data type if provided
            if (metadata.dataType && !this.validDataTypes.includes(metadata.dataType)) {
                throw new Error(`Invalid data type. Must be one of: ${this.validDataTypes.join(', ')}`);
            }

            // Check if setting exists
            const existingSetting = await this.repo('settings').findOne({ key });

            let setting;

            if (existingSetting) {
                // Update existing setting
                setting = await this.repo('settings').update(existingSetting._id, {
                    value,
                    ...metadata,
                    updatedBy: userId,
                });

                await this.logActivity(userId, 'update', 'settings', {
                    settingId: setting._id,
                    key,
                    previousValue: existingSetting.value,
                    newValue: value,
                });
            } else {
                // Create new setting
                setting = await this.repo('settings').create({
                    key,
                    value,
                    category: metadata.category || 'system',
                    dataType: metadata.dataType || this._inferDataType(value),
                    description: metadata.description || '',
                    isPublic: metadata.isPublic !== undefined ? metadata.isPublic : false,
                    createdBy: userId,
                    updatedBy: userId,
                });

                await this.logActivity(userId, 'create', 'settings', {
                    settingId: setting._id,
                    key,
                    value,
                });
            }

            return this.handleSuccess(
                { setting },
                existingSetting ? 'Setting updated successfully' : 'Setting created successfully'
            );
        });
    }

    /**
     * Update multiple settings at once
     */
    async updateSettings(settings, userId) {
        return this.runInContext('updateSettings', async () => {
            const results = [];

            for (const [key, value] of Object.entries(settings)) {
                try {
                    const result = await this.setSetting(key, value, {}, userId);
                    results.push({ key, success: true, data: result.data });
                } catch (error) {
                    results.push({ key, success: false, error: error.message });
                }
            }

            const successCount = results.filter(r => r.success).length;

            return this.handleSuccess({
                total: results.length,
                successful: successCount,
                failed: results.length - successCount,
                results,
            }, `Settings update completed: ${successCount}/${results.length} successful`);
        });
    }

    /**
     * Delete setting
     */
    async deleteSetting(key, userId) {
        return this.runInContext('deleteSetting', async () => {
            const setting = await this.repo('settings').findOne({ key });

            if (!setting) {
                throw new Error('Setting not found');
            }

            await this.repo('settings').delete(setting._id);

            await this.logActivity(userId, 'delete', 'settings', {
                settingId: setting._id,
                key,
                value: setting.value,
            });

            return this.handleSuccess(null, 'Setting deleted successfully');
        });
    }

    /**
     * Reset setting to default value
     */
    async resetSetting(key, userId) {
        return this.runInContext('resetSetting', async () => {
            const setting = await this.repo('settings').findOne({ key });

            if (!setting) {
                throw new Error('Setting not found');
            }

            if (!setting.defaultValue) {
                throw new Error('No default value defined for this setting');
            }

            const updatedSetting = await this.repo('settings').update(setting._id, {
                value: setting.defaultValue,
                updatedBy: userId,
            });

            await this.logActivity(userId, 'reset', 'settings', {
                settingId: setting._id,
                key,
                previousValue: setting.value,
                defaultValue: setting.defaultValue,
            });

            return this.handleSuccess(
                { setting: updatedSetting },
                'Setting reset to default value'
            );
        });
    }

    /**
     * Export settings
     */
    async exportSettings(filters = {}) {
        return this.runInContext('exportSettings', async () => {
            const query = {};

            // Filter by category
            if (filters.category) {
                query.category = filters.category;
            }

            // Only export public settings if specified
            if (filters.publicOnly === true) {
                query.isPublic = true;
            }

            const settings = await this.repo('settings').find(query);

            const exportData = {};

            settings.forEach(setting => {
                if (!exportData[setting.category]) {
                    exportData[setting.category] = {};
                }

                exportData[setting.category][setting.key] = {
                    value: setting.value,
                    dataType: setting.dataType,
                    description: setting.description,
                };
            });

            return this.handleSuccess({
                exportedAt: new Date(),
                categories: Object.keys(exportData).length,
                totalSettings: settings.length,
                data: exportData,
            }, 'Settings exported successfully');
        });
    }

    /**
     * Import settings
     */
    async importSettings(settingsData, userId, options = {}) {
        return this.runInContext('importSettings', async () => {
            const results = [];
            let imported = 0;
            let skipped = 0;
            let errors = 0;

            for (const [category, settings] of Object.entries(settingsData)) {
                // Validate category
                if (!this.validCategories.includes(category)) {
                    this.log('warn', `Invalid category: ${category}`, { userId });
                    continue;
                }

                for (const [key, data] of Object.entries(settings)) {
                    try {
                        // Check if setting exists
                        const existingSetting = await this.repo('settings').findOne({ key });

                        if (existingSetting && !options.overwrite) {
                            skipped++;
                            results.push({ key, status: 'skipped', reason: 'Already exists' });
                            continue;
                        }

                        // Import setting
                        await this.setSetting(
                            key,
                            data.value,
                            {
                                category,
                                dataType: data.dataType,
                                description: data.description,
                            },
                            userId
                        );

                        imported++;
                        results.push({ key, status: 'imported' });
                    } catch (error) {
                        errors++;
                        results.push({ key, status: 'error', error: error.message });
                    }
                }
            }

            await this.logActivity(userId, 'import', 'settings', {
                imported,
                skipped,
                errors,
            });

            return this.handleSuccess({
                imported,
                skipped,
                errors,
                results,
            }, `Settings import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);
        });
    }

    /**
     * Validate setting value against constraints
     */
    validateSettingValue(dataType, value, constraints = {}) {
        switch (dataType) {
            case 'number':
                if (typeof value !== 'number') {
                    throw new Error('Value must be a number');
                }
                if (constraints.min !== undefined && value < constraints.min) {
                    throw new Error(`Value must be at least ${constraints.min}`);
                }
                if (constraints.max !== undefined && value > constraints.max) {
                    throw new Error(`Value must not exceed ${constraints.max}`);
                }
                break;

            case 'string':
                if (typeof value !== 'string') {
                    throw new Error('Value must be a string');
                }
                if (constraints.minLength && value.length < constraints.minLength) {
                    throw new Error(`Value must be at least ${constraints.minLength} characters`);
                }
                if (constraints.maxLength && value.length > constraints.maxLength) {
                    throw new Error(`Value must not exceed ${constraints.maxLength} characters`);
                }
                if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
                    throw new Error('Value does not match required pattern');
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    throw new Error('Value must be a boolean');
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    throw new Error('Value must be an array');
                }
                break;

            case 'json':
                if (typeof value !== 'object') {
                    throw new Error('Value must be a valid JSON object');
                }
                break;

            default:
                // No validation for unknown types
                break;
        }

        return true;
    }

    /**
     * Get public settings (for frontend)
     */
    async getPublicSettings() {
        return this.runInContext('getPublicSettings', async () => {
            const settings = await this.repo('settings').find({ isPublic: true });

            const publicSettings = {};

            settings.forEach(setting => {
                if (!publicSettings[setting.category]) {
                    publicSettings[setting.category] = {};
                }

                publicSettings[setting.category][setting.key] = setting.value;
            });

            return this.handleSuccess({
                settings: publicSettings,
            }, 'Public settings retrieved successfully');
        });
    }

    /**
     * Infer data type from value
     */
    _inferDataType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object' && value !== null) return 'json';
        return 'string';
    }
}
