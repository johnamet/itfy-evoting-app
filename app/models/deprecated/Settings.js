#!/usr/bin/env node

/**
 * Settings Model
 * 
 * Handles system settings, model-specific settings, and general site settings
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

class Settings extends BaseModel {
    constructor() {
        const schemaDefinition = {
            // Setting identification
            key: {
                type: String,
                required: true,
                trim: true,
                maxlength: 100
            },
            
            // Setting type - determines what kind of setting this is
            type: {
                type: String,
                required: true,
                enum: ['general', 'model', 'system', 'theme', 'security', 'payment', 'email', 'sms'],
                default: 'general'
            },
            
            // For model-specific settings
            modelType: {
                type: String,
                enum: ['user', 'event', 'candidate', 'category', 'vote', 'payment', 'notification', 'form', 'slide'],
                default: null
            },
            
            // For instance-specific settings (specific model instance)
            modelId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null
            },
            
            // Setting metadata
            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 200
            },
            
            description: {
                type: String,
                trim: true,
                maxlength: 500
            },
            
            // Setting value (flexible schema)
            value: {
                type: mongoose.Schema.Types.Mixed,
                required: true
            },
            
            // Default value for reference
            defaultValue: {
                type: mongoose.Schema.Types.Mixed,
                default: null
            },
            
            // Value type for validation
            valueType: {
                type: String,
                required: true,
                enum: ['string', 'number', 'boolean', 'object', 'array', 'date', 'url', 'email', 'color', 'file'],
                default: 'string'
            },
            
            // Validation rules
            validation: {
                required: {
                    type: Boolean,
                    default: false
                },
                min: {
                    type: Number,
                    default: null
                },
                max: {
                    type: Number,
                    default: null
                },
                minLength: {
                    type: Number,
                    default: null
                },
                maxLength: {
                    type: Number,
                    default: null
                },
                pattern: {
                    type: String,
                    default: null
                },
                allowedValues: [{
                    type: mongoose.Schema.Types.Mixed
                }]
            },
            
            // UI settings for admin panel
            ui: {
                category: {
                    type: String,
                    default: 'General'
                },
                section: {
                    type: String,
                    default: 'Basic'
                },
                order: {
                    type: Number,
                    default: 0
                },
                inputType: {
                    type: String,
                    enum: ['text', 'textarea', 'number', 'select', 'checkbox', 'radio', 'color', 'file', 'url', 'email', 'date', 'json'],
                    default: 'text'
                },
                placeholder: {
                    type: String,
                    default: ''
                },
                helpText: {
                    type: String,
                    default: ''
                },
                isVisible: {
                    type: Boolean,
                    default: true
                },
                isEditable: {
                    type: Boolean,
                    default: true
                }
            },
            
            // Access control
            isPublic: {
                type: Boolean,
                default: false // If true, can be read by frontend
            },
            
            requiresRestart: {
                type: Boolean,
                default: false // If true, system restart needed after change
            },
            
            // Environment specific
            environment: {
                type: String,
                enum: ['all', 'development', 'staging', 'production'],
                default: 'all'
            },
            
            // Version tracking
            version: {
                type: String,
                default: '1.0.0'
            },
            
            // History tracking
            previousValues: [{
                value: mongoose.Schema.Types.Mixed,
                changedAt: {
                    type: Date,
                    default: Date.now
                },
                changedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                reason: String
            }],
            
            // Last change info
            lastChangedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            
            lastChangedAt: {
                type: Date,
                default: Date.now
            },
            
            // Settings metadata
            metadata: {
                type: Object,
                default: {}
            }
        };

        super(schemaDefinition, { collection: 'settings' });
    }

    getSchema() {
        const schema = super.getSchema();
        
        // Compound unique index for key + type + modelType + modelId
        schema.index({ 
            key: 1, 
            type: 1, 
            modelType: 1, 
            modelId: 1 
        }, { unique: true });
        
        // Other useful indexes
        schema.index({ type: 1, isPublic: 1 });
        schema.index({ modelType: 1, modelId: 1 });
        schema.index({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        schema.index({ environment: 1 });
        schema.index({ lastChangedAt: -1 });
        
        // Text search
        schema.index({ 
            name: 'text', 
            description: 'text',
            key: 'text'
        }, { 
            name: 'settings_text_index',
            weights: { name: 10, key: 8, description: 5 }
        });

        // Virtual for checking if setting has been modified from default
        schema.virtual('isModified').get(function() {
            return JSON.stringify(this.value) !== JSON.stringify(this.defaultValue);
        });

        // Pre-save middleware to track changes
        schema.pre('save', function(next) {
            if (this.isModified('value') && !this.isNew) {
                // Store previous value in history
                this.previousValues.push({
                    value: this._original?.value || this.value,
                    changedAt: new Date(),
                    changedBy: this.lastChangedBy,
                    reason: this.metadata?.changeReason || 'Setting updated'
                });
                
                // Limit history to last 50 changes
                if (this.previousValues.length > 50) {
                    this.previousValues = this.previousValues.slice(-50);
                }
                
                this.lastChangedAt = new Date();
            }
            next();
        });

        // Static methods
        schema.statics.findByKey = function(key, type = 'general') {
            return this.findOne({ key, type });
        };

        schema.statics.findModelSettings = function(modelType, modelId = null) {
            const query = { type: 'model', modelType };
            if (modelId) {
                query.modelId = modelId;
            }
            return this.find(query).sort({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        };

        schema.statics.findPublicSettings = function() {
            return this.find({ isPublic: true }).sort({ 'ui.category': 1, 'ui.section': 1, 'ui.order': 1 });
        };

        schema.statics.findByCategory = function(category, type = 'general') {
            return this.find({ 
                type, 
                'ui.category': category 
            }).sort({ 'ui.section': 1, 'ui.order': 1 });
        };

        schema.statics.updateSetting = function(key, value, userId, type = 'general', modelType = null, modelId = null) {
            return this.findOneAndUpdate(
                { key, type, modelType, modelId },
                { 
                    value, 
                    lastChangedBy: userId,
                    lastChangedAt: new Date()
                },
                { new: true, upsert: true }
            );
        };

        schema.statics.resetToDefault = function(key, type = 'general', modelType = null, modelId = null) {
            return this.findOne({ key, type, modelType, modelId }).then(setting => {
                if (setting && setting.defaultValue !== null) {
                    setting.value = setting.defaultValue;
                    return setting.save();
                }
                return setting;
            });
        };

        return schema;
    }
}

export default mongoose.model('Settings', new Settings().getSchema());
