import BaseRepository from '../BaseRepository.js';
import Settings from '../models/Settings.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

/**
 * SettingsRepository
 * 
 * Manages application settings with intelligent caching. Settings are cached with a 2-hour TTL
 * since they rarely change but are accessed frequently.
 * 
 * Cache Strategy:
 * - Read operations are cached with long TTL (2 hours)
 * - Key-based lookups are heavily cached
 * - Updates invalidate all settings caches
 * - Category-based queries are cached
 * 
 * @extends BaseRepository
 */
class SettingsRepository extends BaseRepository {
    constructor() {
        super(Settings, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 7200 // 2 hours
        });
    }

    /**
     * Create or update a setting
     * Settings are typically accessed by key, so this method handles upsert
     * 
     * @param {Object} settingData - Setting data
     * @param {string} settingData.key - Unique setting key
     * @param {*} settingData.value - Setting value (any type)
     * @param {string} [settingData.category='general'] - Setting category
     * @param {string} [settingData.description] - Setting description
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created or updated setting
     */
    async upsertSetting(settingData, options = {}) {
        this._validateRequiredFields(settingData, ['key', 'value']);

        const settingToUpsert = {
            ...settingData,
            category: settingData.category || 'general'
        };

        const existing = await this.findByKey(settingData.key, { skipCache: true });

        if (existing) {
            return await this.updateById(existing._id, settingToUpsert, options);
        }

        return await this.create(settingToUpsert, options);
    }

    /**
     * Find setting by key
     * Heavily cached since settings are accessed frequently
     * 
     * @param {string} key - Setting key
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Object|null>} Setting or null
     */
    async findByKey(key, options = {}) {
        if (!key) {
            throw new Error('Setting key is required');
        }

        return await this.findOne({ key }, options);
    }

    /**
     * Get setting value by key
     * Returns only the value, not the entire setting object
     * 
     * @param {string} key - Setting key
     * @param {*} [defaultValue=null] - Default value if setting not found
     * @returns {Promise<*>} Setting value or default
     */
    async getValue(key, defaultValue = null) {
        if (!key) {
            throw new Error('Setting key is required');
        }

        const setting = await this.findByKey(key);
        return setting ? setting.value : defaultValue;
    }

    /**
     * Set setting value
     * Convenient method for updating just the value
     * 
     * @param {string} key - Setting key
     * @param {*} value - New value
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated setting
     */
    async setValue(key, value, options = {}) {
        if (!key) {
            throw new Error('Setting key is required');
        }

        return await this.upsertSetting({ key, value }, options);
    }

    /**
     * Find settings by category
     * 
     * @param {string} category - Setting category
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Settings in category
     */
    async findByCategory(category, options = {}) {
        if (!category) {
            throw new Error('Category is required');
        }

        return await this.find(
            { category },
            {
                ...options,
                sort: options.sort || { key: 1 }
            }
        );
    }

    /**
     * Get all settings as key-value object
     * Useful for loading all settings at once
     * 
     * @param {string} [category] - Optional category filter
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async getAllAsObject(category = null) {
        const query = category ? { category } : {};
        const settings = await this.find(query);

        return settings.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});
    }

    /**
     * Get settings by keys
     * Batch retrieval of multiple settings
     * 
     * @param {Array<string>} keys - Array of setting keys
     * @returns {Promise<Object>} Object with requested settings
     */
    async getByKeys(keys) {
        if (!Array.isArray(keys) || keys.length === 0) {
            throw new Error('Keys array is required and must not be empty');
        }

        const settings = await this.find({ key: { $in: keys } });

        return settings.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});
    }

    /**
     * Update multiple settings at once
     * Efficient bulk update operation
     * 
     * @param {Object} settings - Object with key-value pairs
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Array>} Updated settings
     */
    async updateMultiple(settings, options = {}) {
        if (!settings || typeof settings !== 'object') {
            throw new Error('Settings object is required');
        }

        const keys = Object.keys(settings);
        if (keys.length === 0) {
            throw new Error('Settings object must not be empty');
        }

        return await this.withTransaction(async (session) => {
            const updates = keys.map(key => 
                this.upsertSetting(
                    { key, value: settings[key] },
                    { ...options, session }
                )
            );

            return await Promise.all(updates);
        });
    }

    /**
     * Delete setting by key
     * 
     * @param {string} key - Setting key
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object|null>} Deleted setting
     */
    async deleteByKey(key, options = {}) {
        if (!key) {
            throw new Error('Setting key is required');
        }

        const setting = await this.findByKey(key, { skipCache: true });
        
        if (!setting) {
            return null;
        }

        return await this.deleteById(setting._id, options);
    }

    /**
     * Delete settings by category
     * 
     * @param {string} category - Category to delete
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result
     */
    async deleteByCategory(category, options = {}) {
        if (!category) {
            throw new Error('Category is required');
        }

        return await this.deleteMany({ category }, options);
    }

    /**
     * Get all categories
     * 
     * @returns {Promise<Array<string>>} List of unique categories
     */
    async getAllCategories() {
        const categories = await this.Model.distinct('category');
        return categories.sort();
    }

    /**
     * Count settings by category
     * 
     * @param {string} category - Category to count
     * @returns {Promise<number>} Setting count
     */
    async countByCategory(category) {
        if (!category) {
            throw new Error('Category is required');
        }

        return await this.count({ category });
    }

    /**
     * Search settings by key pattern
     * 
     * @param {string} pattern - Search pattern (regex)
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Matching settings
     */
    async searchByKeyPattern(pattern, options = {}) {
        if (!pattern) {
            throw new Error('Search pattern is required');
        }

        return await this.find(
            { key: { $regex: pattern, $options: 'i' } },
            {
                ...options,
                sort: options.sort || { key: 1 }
            }
        );
    }

    /**
     * Export all settings
     * Returns settings in a format suitable for backup/export
     * 
     * @param {string} [category] - Optional category filter
     * @returns {Promise<Object>} Export data
     */
    async exportSettings(category = null) {
        const query = category ? { category } : {};
        const settings = await this.find(query, { sort: { category: 1, key: 1 } });

        return {
            exportDate: new Date(),
            category: category || 'all',
            count: settings.length,
            settings: settings.map(setting => ({
                key: setting.key,
                value: setting.value,
                category: setting.category,
                description: setting.description
            }))
        };
    }

    /**
     * Import settings
     * Bulk import from exported data
     * 
     * @param {Array<Object>} settings - Array of setting objects
     * @param {boolean} [overwrite=false] - Whether to overwrite existing settings
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Import result
     */
    async importSettings(settings, overwrite = false, options = {}) {
        if (!Array.isArray(settings) || settings.length === 0) {
            throw new Error('Settings array is required and must not be empty');
        }

        return await this.withTransaction(async (session) => {
            const results = {
                imported: 0,
                skipped: 0,
                errors: []
            };

            for (const setting of settings) {
                try {
                    const existing = await this.findByKey(setting.key, { 
                        skipCache: true,
                        session
                    });

                    if (existing && !overwrite) {
                        results.skipped++;
                        continue;
                    }

                    await this.upsertSetting(setting, { ...options, session });
                    results.imported++;
                } catch (error) {
                    results.errors.push({
                        key: setting.key,
                        error: error.message
                    });
                }
            }

            return results;
        });
    }

    /**
     * Reset settings to defaults
     * Useful for testing or resetting configuration
     * 
     * @param {Object} defaults - Object with default settings
     * @param {string} [category] - Optional category to reset
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Reset result
     */
    async resetToDefaults(defaults, category = null, options = {}) {
        if (!defaults || typeof defaults !== 'object') {
            throw new Error('Defaults object is required');
        }

        return await this.withTransaction(async (session) => {
            // Delete existing settings in category
            if (category) {
                await this.deleteByCategory(category, { ...options, session });
            }

            // Create new settings
            const keys = Object.keys(defaults);
            const creates = keys.map(key => 
                this.upsertSetting(
                    {
                        key,
                        value: defaults[key],
                        category: category || 'general'
                    },
                    { ...options, session }
                )
            );

            await Promise.all(creates);

            return {
                success: true,
                count: keys.length
            };
        });
    }

    /**
     * Validate settings structure
     * Check if required settings exist
     * 
     * @param {Array<string>} requiredKeys - Array of required setting keys
     * @returns {Promise<Object>} Validation result
     */
    async validateRequiredSettings(requiredKeys) {
        if (!Array.isArray(requiredKeys) || requiredKeys.length === 0) {
            throw new Error('Required keys array is required');
        }

        const existingSettings = await this.find({ key: { $in: requiredKeys } });
        const existingKeys = existingSettings.map(s => s.key);
        const missingKeys = requiredKeys.filter(key => !existingKeys.includes(key));

        return {
            valid: missingKeys.length === 0,
            missingKeys,
            existingKeys
        };
    }

    /**
     * Get settings with metadata
     * Returns settings with usage statistics
     * 
     * @param {string} [category] - Optional category filter
     * @returns {Promise<Array>} Settings with metadata
     */
    async getSettingsWithMetadata(category = null) {
        const query = category ? { category } : {};
        const settings = await this.find(query, { sort: { category: 1, key: 1 } });

        return settings.map(setting => ({
            key: setting.key,
            value: setting.value,
            category: setting.category,
            description: setting.description,
            type: typeof setting.value,
            createdAt: setting.createdAt,
            updatedAt: setting.updatedAt
        }));
    }
}

export default SettingsRepository;
