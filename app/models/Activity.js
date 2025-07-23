#!/usr/bin/env node

/**
 * Activity Tracker
 */

import BaseModel from "./BaseModel";
import mongoose from "mongoose";

class Activity extends BaseModel{

    constructor(){
        const schemaDefinition = {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            action: {
                type: String,
                required: true,
                enum: ['create', 'update', 'delete', 'view']
            },
            targetType: {
                type: String,
                required: true,
                enum: ['user', 'candidate', 'event', 'vote']
            },
            targetId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }

        super(schemaDefinition, {collection: 'activities'})
    }

    getSchema(){
        const schema = super.getSchema();
        schema.index({ user: 1, timestamp: -1 });
        return schema;
    }
}

export default mongoose.model('Activity', Activity.getSchema());
