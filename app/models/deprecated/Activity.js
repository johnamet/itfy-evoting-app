#!/usr/bin/env node

/**
 * Activity Tracker
 */

import BaseModel from "./BaseModel.js";
import mongoose from "mongoose";

class Activity extends BaseModel{

    constructor(){
        const schemaDefinition = {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                refPath: 'userModel',
                required: false, // Made optional to support anonymous site visits
            },
            userModel: {
                type: String,
                default: 'User',
                enum: ['User', 'Candidate'],
                required: false
            },
            action: {
                type: String,
                required: true,
                enum: ['create', 'update', 'delete', 'view', 'site_visit', 'login']
            },
            targetType: {
                type: String,
                required: true,
                enum: ['user', 'candidate', 'event', 'votebundle', 'coupon', 'site', 'category', 'slide', 'form', 'form_submission']
            },
            targetId: {
                type: mongoose.Schema.Types.ObjectId,
                required: false
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            siteVisits: {
                date: String,
                totalVisits: {
                    type: Number,
                    default: 0
                },
                pages: {
                    type: Map,
                    of: Number,
                    default: {}
                },
                hourly: {
                    type: Map,
                    of: Number,
                    default: {}
                },
                users: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                }],
                anonymousVisits: {
                    type: Number,
                    default: 0
                },
                lastUpdated: {
                    type: Date,
                    default: Date.now
                },
                metadata: [{
                    type: mongoose.Schema.Types.Mixed,
                    default: []
                }]
            }
        }

        super(schemaDefinition, {collection: 'activities'})
    }

    getSchema(){
        const schema = super.getSchema();
        schema.index({ user: 1, timestamp: -1 });
        schema.index({ action: 1, targetType: 1 });
        schema.index({ action: 1, 'siteVisits.date': 1 }); // For site visit queries
        schema.index({ targetType: 1, targetId: 1 });
        schema.index({ timestamp: -1 }); // For recent activities
        return schema;
    }
}

export default mongoose.model('Activity', new Activity().getSchema());

