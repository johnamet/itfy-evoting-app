#!/usr/bin/env node

/**
 * Settings Repository
 * 
 * Data access layer for Settings operations
 */

import BaseRepository from './BaseRepository.js';
import Settings from '../models/Settings.js';

class SettingsRepository extends BaseRepository {
    constructor() {
        super(Settings);
    }

    /**
     * Find setting by key and type
     */
    async findByKey(key, type = 'general', modelType = null, modelId = null) {
        try {
            const query = { key, type };
            if (modelType) query.modelType = modelType;
            if (modelId) query.modelId = modelId;

            return await this.model.findOne(query)
                .populate('lastChangedBy', 'name email')
                .populate('modelId');
        } catch (error) {
            throw new Error(`Error finding setting by key: ${error.message}`);
        }
    }

    /**
     * Get all general settings (site configuration)
     */
    async getGeneralSettings() {
        try {
            return await this.model.find({ type: 'general' })
                .populate('lastChangedBy', 'name email')
                .sort({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        } catch (error) {
            throw new Error(`Error getting general settings: ${error.message}`);
        }
    }

    /**
     * Get public settings (accessible to frontend)
     */
    async getPublicSettings() {
        try {
            return await this.model.find({ isPublic: true })
                .select('-previousValues -metadata')
                .sort({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        } catch (error) {
            throw new Error(`Error getting public settings: ${error.message}`);
        }
    }

    /**
     * Get settings by category
     */
    async getByCategory(category, type = 'general') {
        try {
            return await this.model.find({ 
                type, 
                'ui.category': category 
            })
            .populate('lastChangedBy', 'name email')
            .sort({ 'ui.section': 1, 'ui.order': 1 });
        } catch (error) {
            throw new Error(`Error getting settings by category: ${error.message}`);
        }
    }

    /**
     * Get model-specific settings
     */
    async getModelSettings(modelType, modelId = null) {
        try {
            const query = { type: 'model', modelType };
            if (modelId) query.modelId = modelId;

            return await this.model.find(query)
                .populate('lastChangedBy', 'name email')
                .populate('modelId')
                .sort({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        } catch (error) {
            throw new Error(`Error getting model settings: ${error.message}`);
        }
    }

    /**
     * Update or create setting
     */
    async updateSetting(key, value, userId, type = 'general', modelType = null, modelId = null, metadata = {}) {
        try {
            const query = { key, type };
            if (modelType) query.modelType = modelType;
            if (modelId) query.modelId = modelId;

            const updateData = {
                value,
                lastChangedBy: userId,
                lastChangedAt: new Date(),
                metadata: { ...metadata, changeReason: metadata.changeReason || 'Setting updated' }
            };

            return await this.model.findOneAndUpdate(
                query,
                updateData,
                { new: true, upsert: true }
            ).populate('lastChangedBy', 'name email');
        } catch (error) {
            throw new Error(`Error updating setting: ${error.message}`);
        }
    }

    /**
     * Update multiple settings at once
     */
    async updateMultipleSettings(settings, userId) {
        try {
            const operations = settings.map(setting => ({
                updateOne: {
                    filter: {
                        key: setting.key,
                        type: setting.type || 'general',
                        modelType: setting.modelType || null,
                        modelId: setting.modelId || null
                    },
                    update: {
                        value: setting.value,
                        lastChangedBy: userId,
                        lastChangedAt: new Date(),
                        metadata: {
                            ...setting.metadata,
                            changeReason: setting.metadata?.changeReason || 'Bulk setting update'
                        }
                    },
                    upsert: true
                }
            }));

            return await this.model.bulkWrite(operations);
        } catch (error) {
            throw new Error(`Error updating multiple settings: ${error.message}`);
        }
    }

    /**
     * Reset setting to default value
     */
    async resetToDefault(key, type = 'general', modelType = null, modelId = null, userId = null) {
        try {
            const query = { key, type };
            if (modelType) query.modelType = modelType;
            if (modelId) query.modelId = modelId;

            const setting = await this.model.findOne(query);
            if (!setting) {
                throw new Error('Setting not found');
            }

            if (setting.defaultValue === null) {
                throw new Error('No default value available for this setting');
            }

            setting.value = setting.defaultValue;
            if (userId) {
                setting.lastChangedBy = userId;
                setting.lastChangedAt = new Date();
                setting.metadata.changeReason = 'Reset to default value';
            }

            return await setting.save();
        } catch (error) {
            throw new Error(`Error resetting setting to default: ${error.message}`);
        }
    }

    /**
     * Get settings by environment
     */
    async getByEnvironment(environment = 'all') {
        try {
            return await this.model.find({
                $or: [
                    { environment: environment },
                    { environment: 'all' }
                ]
            })
            .populate('lastChangedBy', 'name email')
            .sort({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        } catch (error) {
            throw new Error(`Error getting settings by environment: ${error.message}`);
        }
    }

    /**
     * Search settings
     */
    async search(searchTerm, filters = {}) {
        try {
            const query = {
                $text: { $search: searchTerm }
            };

            // Apply filters
            if (filters.type) query.type = filters.type;
            if (filters.modelType) query.modelType = filters.modelType;
            if (filters.category) query['ui.category'] = filters.category;
            if (filters.isPublic !== undefined) query.isPublic = filters.isPublic;

            return await this.model.find(query, { score: { $meta: 'textScore' } })
                .populate('lastChangedBy', 'name email')
                .sort({ score: { $meta: 'textScore' }, 'ui.order': 1 })
                .limit(filters.limit || 50);
        } catch (error) {
            throw new Error(`Error searching settings: ${error.message}`);
        }
    }

    /**
     * Get setting history
     */
    async getSettingHistory(key, type = 'general', modelType = null, modelId = null) {
        try {
            const query = { key, type };
            if (modelType) query.modelType = modelType;
            if (modelId) query.modelId = modelId;

            const setting = await this.model.findOne(query)
                .populate('previousValues.changedBy', 'name email')
                .populate('lastChangedBy', 'name email');

            if (!setting) {
                throw new Error('Setting not found');
            }

            return {
                current: {
                    value: setting.value,
                    changedAt: setting.lastChangedAt,
                    changedBy: setting.lastChangedBy
                },
                history: setting.previousValues.sort((a, b) => b.changedAt - a.changedAt)
            };
        } catch (error) {
            throw new Error(`Error getting setting history: ${error.message}`);
        }
    }

    /**
     * Get modified settings (different from default)
     */
    async getModifiedSettings() {
        try {
            const settings = await this.model.find({})
                .populate('lastChangedBy', 'name email');

            return settings.filter(setting => 
                JSON.stringify(setting.value) !== JSON.stringify(setting.defaultValue)
            );
        } catch (error) {
            throw new Error(`Error getting modified settings: ${error.message}`);
        }
    }

    /**
     * Export settings configuration
     */
    async exportSettings(includeHistory = false) {
        try {
            const selectFields = includeHistory 
                ? {} 
                : { previousValues: 0 };

            return await this.model.find({}, selectFields)
                .populate('lastChangedBy', 'name email')
                .sort({ type: 1, 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        } catch (error) {
            throw new Error(`Error exporting settings: ${error.message}`);
        }
    }

    /**
     * Import settings configuration
     */
    async importSettings(settingsData, userId, overwrite = false) {
        try {
            const operations = [];

            for (const settingData of settingsData) {
                const query = {
                    key: settingData.key,
                    type: settingData.type || 'general'
                };

                if (settingData.modelType) query.modelType = settingData.modelType;
                if (settingData.modelId) query.modelId = settingData.modelId;

                const updateData = {
                    ...settingData,
                    lastChangedBy: userId,
                    lastChangedAt: new Date(),
                    metadata: {
                        ...settingData.metadata,
                        changeReason: 'Settings import'
                    }
                };

                if (overwrite) {
                    operations.push({
                        replaceOne: {
                            filter: query,
                            replacement: updateData,
                            upsert: true
                        }
                    });
                } else {
                    operations.push({
                        updateOne: {
                            filter: query,
                            update: { $setOnInsert: updateData },
                            upsert: true
                        }
                    });
                }
            }

            return await this.model.bulkWrite(operations);
        } catch (error) {
            throw new Error(`Error importing settings: ${error.message}`);
        }
    }

    /**
     * Get settings requiring restart
     */
    async getSettingsRequiringRestart() {
        try {
            return await this.model.find({ requiresRestart: true })
                .populate('lastChangedBy', 'name email')
                .sort({ lastChangedAt: -1 });
        } catch (error) {
            throw new Error(`Error getting settings requiring restart: ${error.message}`);
        }
    }
}

export default SettingsRepository;
