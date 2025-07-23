#!/usr/bin/env node
/**
 * Vote model class for the application.
 * This file defines the Vote class which extends the BaseModel class.
 * */
import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

class Vote extends BaseModel {

    constructor() {
        const schemaDefinition = {
            candidate: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Candidate',
                required: true
            },
            voter: {
                type: Object,
                required: true
            },
            event: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },
            createdAt: {
                type: Date,
                default: () => Date.now(),
                immutable: true
            },
            category: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Category',
                required: true
            },

            voteBundles: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'VoteBundle',
                required: true
            }
          
        }
        super(schemaDefinition, {collection: "votes"})
    }

    getSchema(){
        const schema = super.getSchema()

        schema.index({voteBundles: 1})
        schema.index({category: 1})
        schema.index({event: 1})
        schema.index({candidate: 1})

        return schema
    }
}

export default mongoose.model('Vote', new Vote().getSchema());