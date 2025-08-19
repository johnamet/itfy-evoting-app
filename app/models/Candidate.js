#!/usr/bin/env node
/**
 * The Candidate model for the application.
 * This file defines the Candidate class which extends the BaseModel class.
 * 
 * */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';


class Candidate extends BaseModel {

    constructor() {

        const schemaDefinition = {
            name: {
                type: String,
                required: true,
                trim: true,
                index: true // Index for faster lookups
            },
            email: {
                type: String,
                required: true,
                trim: true,
                unique: true,
                index: true // Index for faster lookups
            },
            bio: {
                type: String,
                required: true,
                trim: true
            },
            isActive: {
                type: Boolean,
                default: true
            },
            isDeleted: {
                type: Boolean,
                default: false
            },
            categories: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'Category',
                required: true
            },
            projects: {
                type: [Object],
                default: []
            },
            status: {
                type: String,
                default: "pending"
            },
            event: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },
            votes: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'Vote',
                default: []
            },
            skills: {
                type: [String],
                default: []
            },
            nominatedBy: {
                type: String,
                required: true,
                trim: true
            },
            socialLinks: {
                type: Object,
                default: {}
            },
            education: {
                type: Object,
                default: {}
            },
            experience: {
                type: Object,
                default: {}
            },
            achievements: {
                type: Object,
                default: {}
            },
            photo: {
                type: String,
                trim: true
            },
            title: {
                type: String,
                required: true,
                trim: true
            },
            location: {
                type: String,
                required: true,
                trim: true
            },
            cId: {
                type: String,
                required: true,
                unique: true,
                trim: true,
                index: true // Index for faster lookups
            }
        };

        super(schemaDefinition, {collection: "candidates"});

        this.schema.pre('save', function(next) {
            if (!this.isModified('cId')) return next();

            // Ensure cId is unique and properly formatted
            this.cId = this.cId.trim().toUpperCase();
            next();
        });
    }

    getSchema() {
        const schema = super.getSchema();

        // Add indexes for better query performance
        schema.index({ event: 1 });
        schema.index({ isActive: 1 });
        schema.index({ isDeleted: 1 });

        return schema;
    }
}

export default mongoose.model('Candidate', new Candidate().getSchema());
