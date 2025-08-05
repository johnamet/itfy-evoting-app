#!/usr/bin/env node
/**
 * Vote model class for the application.
 * This file defines the Vote class which extends the BaseModel class.
 * 
 * @module Vote
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

/**
 * Vote model class extending BaseModel.
 * Represents a vote cast in an event for a candidate in a specific category.
 * 
 * @class
 * @extends BaseModel
 */
class Vote extends BaseModel {
    /**
     * Initializes the Vote schema with fields for candidate, voter, event, category, and vote bundles.
     */
    constructor() {
        const schemaDefinition = {
            candidate: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Candidate',
                required: true
            },
            voter: {
                type: {
                    name: { type: String, trim: true },
                    email: { type: String, trim: true }
                },
                required: false // Optional voter information
            },
            event: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },
            category: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Category',
                required: true
            },
            voteBundles: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'VoteBundle',
                required: true
            }],
            votedAt: {
                type: Date,
                default: () => Date.now(),
                immutable: true
            },
            ipAddress: {
                type: String,
                required: false
            }
        };
        super(schemaDefinition, { collection: 'votes' });
    }

    /**
     * Returns the Mongoose schema with additional indexes.
     * @returns {mongoose.Schema} The constructed schema.
     */
    getSchema() {
        const schema = super.getSchema();

        schema.index({ voteBundles: 1 });
        schema.index({ category: 1 });
        schema.index({ event: 1 });
        schema.index({ candidate: 1 });
        schema.index({ 'voter.email': 1 }); // Index for vote limit checks

        return schema;
    }
}

export default mongoose.model('Vote', new Vote().getSchema());