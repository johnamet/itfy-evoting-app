#!/usr/bin/env node

/**
 * Notification Model
 * 
 * Handles system notifications for admin dashboard and user notifications
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

class Notification extends BaseModel {
    constructor() {
        const schemaDefinition = {
            title: {
                type: String,
                required: true,
                trim: true,
                maxlength: 200
            },
            message: {
                type: String,
                required: true,
                trim: true,
                maxlength: 1000
            },
            type: {
                type: String,
                required: true,
                enum: ['info', 'success', 'warning', 'error', 'system'],
                default: 'info'
            },
            category: {
                type: String,
                required: true,
                enum: ['vote', 'payment', 'user', 'event', 'candidate', 'system', 'security', 'form', 'general'],
                default: 'general'
            },
            priority: {
                type: String,
                required: true,
                enum: ['low', 'normal', 'high', 'urgent'],
                default: 'normal'
            },
            // User who should receive this notification (null for system-wide)
            recipientUser: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null
            },
            // Role-based notifications (send to all users with this role)
            recipientRole: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Role',
                default: null
            },
            // Send to all admin users (level >= 3)
            isAdminNotification: {
                type: Boolean,
                default: false
            },
            // Send to all users
            isGlobalNotification: {
                type: Boolean,
                default: false
            },
            // Related entity information
            relatedEntity: {
                entityType: {
                    type: String,
                    enum: ['vote', 'payment', 'user', 'event', 'candidate', 'category', 'form', 'slide'],
                    default: null
                },
                entityId: {
                    type: mongoose.Schema.Types.ObjectId,
                    default: null
                }
            },
            // Action button (optional)
            action: {
                label: {
                    type: String,
                    maxlength: 50
                },
                url: {
                    type: String,
                    maxlength: 500
                },
                type: {
                    type: String,
                    enum: ['link', 'button', 'modal'],
                    default: 'link'
                }
            },
            // Notification status
            isRead: {
                type: Boolean,
                default: false
            },
            readAt: {
                type: Date,
                default: null
            },
            readBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                default: null
            },
            // Scheduled notifications
            scheduledFor: {
                type: Date,
                default: null
            },
            isSent: {
                type: Boolean,
                default: false
            },
            sentAt: {
                type: Date,
                default: null
            },
            // Expiry
            expiresAt: {
                type: Date,
                default: null
            },
            // Display settings
            showOnDashboard: {
                type: Boolean,
                default: true
            },
            showAsPopup: {
                type: Boolean,
                default: false
            },
            // Metadata
            metadata: {
                type: Object,
                default: {}
            },
            // Creator
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            // Settings
            settings: {
                autoDelete: {
                    type: Boolean,
                    default: false
                },
                autoDeleteAfterDays: {
                    type: Number,
                    default: 30
                },
                allowDismiss: {
                    type: Boolean,
                    default: true
                },
                persistAcrossSessions: {
                    type: Boolean,
                    default: true
                }
            }
        };

        super(schemaDefinition, { collection: 'notifications' });
    }

    getSchema() {
        const schema = super.getSchema();
        
        // Indexes for better performance
        schema.index({ recipientUser: 1, isRead: 1 });
        schema.index({ recipientRole: 1, isRead: 1 });
        schema.index({ isAdminNotification: 1, isRead: 1 });
        schema.index({ isGlobalNotification: 1, isRead: 1 });
        schema.index({ type: 1, category: 1 });
        schema.index({ priority: 1, createdAt: -1 });
        schema.index({ scheduledFor: 1, isSent: 1 });
        schema.index({ expiresAt: 1 });
        schema.index({ 'relatedEntity.entityType': 1, 'relatedEntity.entityId': 1 });
        
        // Text search
        schema.index({ 
            title: 'text', 
            message: 'text' 
        }, { 
            name: 'notification_text_index',
            weights: { title: 10, message: 5 }
        });

        // Virtual for checking if notification is expired
        schema.virtual('isExpired').get(function() {
            return this.expiresAt && this.expiresAt < new Date();
        });

        // Virtual for checking if notification is scheduled
        schema.virtual('isScheduled').get(function() {
            return this.scheduledFor && this.scheduledFor > new Date() && !this.isSent;
        });

        // Virtual for checking if notification is overdue
        schema.virtual('isOverdue').get(function() {
            return this.scheduledFor && this.scheduledFor < new Date() && !this.isSent;
        });

        // Pre-save middleware to set sentAt when isSent becomes true
        schema.pre('save', function(next) {
            if (this.isModified('isSent') && this.isSent && !this.sentAt) {
                this.sentAt = new Date();
            }
            
            if (this.isModified('isRead') && this.isRead && !this.readAt) {
                this.readAt = new Date();
            }
            
            next();
        });

        // Static methods
        schema.statics.findUnreadForUser = function(userId) {
            return this.find({
                $or: [
                    { recipientUser: userId },
                    { isGlobalNotification: true },
                    { isAdminNotification: true } // This should be filtered by user role in service
                ],
                isRead: false,
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: null },
                    { expiresAt: { $gt: new Date() } }
                ]
            }).sort({ priority: -1, createdAt: -1 });
        };

        schema.statics.findByEntityReference = function(entityType, entityId) {
            return this.find({
                'relatedEntity.entityType': entityType,
                'relatedEntity.entityId': entityId
            }).sort({ createdAt: -1 });
        };

        schema.statics.markAsRead = function(notificationId, userId) {
            return this.findByIdAndUpdate(notificationId, {
                isRead: true,
                readAt: new Date(),
                readBy: userId
            }, { new: true });
        };

        schema.statics.deleteExpired = function() {
            return this.deleteMany({
                expiresAt: { $lt: new Date() }
            });
        };

        return schema;
    }
}

export default mongoose.model('Notification', new Notification().getSchema());
