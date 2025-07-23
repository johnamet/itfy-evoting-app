#!/usr/bin/env node

/**
 * The Event model for the application.
 * This file defines the Event class which extends the BaseModel class.
 * It includes the schema definition for the Event model and methods specific to events.
 */

import BaseModel from './BaseModel.js';
import mongoose, { mongo } from 'mongoose';

class Event extends BaseModel {

    constructor(){

        const schemaDefinition = {
            description: {
                type: String,
                required: true,
                trim: true
            },

            startDate: {
                type: Date,
                required: true,
                default: () => Date.now()
            },

            location: {
                type: String,
                required: true,
                trim: true
            },

            endDate: {
                type: Date,
                required: true,
                default: () => Date.now()
            },

            gallery: {
                type: [String],
                default: []
            },
            isActive: {
                type: Boolean,
                default: true
            },
            isDeleted: {
                type: Boolean,
                default: false
            },

            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },

            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },

            speakers: {
                type: [Object],
                default: []
            },
            name: {
                type: String,
                required: true,
                trim: true
            },

            relatedEvents: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'Event',
                default: []
            },

            categories: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'Category',
                default: []
            },
            status: {
                type: String,
                default: "active"
            }
        }
        super(schemaDefinition, { collection: 'events' });
    }

    getSchema() {
        const schema = super.getSchema();
        schema.index({ name: 'text', description: 'text' }); // Text index for search
        schema.index({ startDate: 1, endDate: 1 }); // Index for date range queries
        return schema;
    }
}

export default mongoose.model('Event', new Event().getSchema());