#!/usr/bin/env node

/**
 * Role 
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';


class Role extends BaseModel {

    constructor(){
        const schemaDefinition = {
            name: {
                type: String,
                required: true,
                unique: true,
                trim: true,
                index: true // Index for faster lookups
            },
            level : {
                type: Number,
                required: true
            },
        }

        super(schemaDefinition, {collection: 'roles'})
    }

    getSchema() {
        const schema = super.getSchema();

        return schema;
    }
}

export default mongoose.model('Role', new Role().getSchema())