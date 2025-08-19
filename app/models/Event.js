#!/usr/bin/env node

/**
 * The Event model for the application.
 * This file defines the Event class which extends the BaseModel class.
 * It includes the schema definition for the Event model and methods specific to events.
 */

import { type } from 'os';
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
                type: {
                    name: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    address: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    city: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    coordinates: {
                        type: {
                            lat: {
                                type: Number,
                                required: true
                            },
                            lng: {
                                type: Number,
                                required: true
                            }
                        },
                        required: false
                    },
                    country: {
                        type: String,
                        required: false,
                        trim: true
                    },
                    zipCode: {
                        type: String,
                        required: false,
                        trim: true
                    },
                    website: {
                        type: String,
                        required: false,
                        trim: true
                    },
                    phone: {
                        type: String,
                        required: false,
                        trim: true
                    },
                    venueInfo: {
                        type: [String],
                        required: false,
                        trim: true
                    },
                    directions: {
                        type: [String],
                        required: false,
                        trim: true
                    }
                },
                required: true,
                default: {}
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
                required: false
            },

            speakers: {
                type: [Object],
                default: []
            },
            guestOfHonor: {
                type: [Object],
                default: []
            },
            name: {
                type: String,
                required: true,
                trim: true
            },
            requirements: {
                type: [String],
                required: false,
                default: []
            },
            sponsors: {
                type: [Object],
                default: []
            },

            relatedEvents: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                default: []
            }],

            categories: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Category',
                default: []
            }],
            status: {
                type: String,
                default: "active"
            },
            timeline: {
                type: [{
                    title: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    description: {
                        type: String,
                        required: false,
                        trim: true
                    },
                    time: {
                        type: Date,
                        required: true
                    }
                }],
                default: []
            },
            registrations: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Form',
                required: false
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