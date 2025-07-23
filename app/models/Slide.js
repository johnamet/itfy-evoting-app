#!/usr/bin/env node

/**
 * Slide
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

class Slide  extends BaseModel{

    constructor(){
        const schemaDefinition = {
            title: {
                type: String,
                required: true,
                trim: true
            },

            subtitle: {
                type: String,
                required: true,
                trim: true
            },
            image: {
                type: String,
                required: true,
                trim: true
            }
        }
    }

    getSchema(){
        const schema = super.getSchema()
        return schema
    }
}

export default mongoose.model('Slide', new Slide().getSchema())