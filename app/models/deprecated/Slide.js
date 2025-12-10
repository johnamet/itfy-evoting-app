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
            },
            button: {
                label: {
                    type: String,
                    required: true,
                    trim: true
                },
                link: {
                    type: String,
                    required: true,
                    trim: true
                }
            },
            isActive: {
                type: Boolean,
                default: true
            },
            published: {
                type: Boolean,
                default: false
            },
            settings: {
                type: Object,
                default: {}
            },
            order: {
                type: Number,
                required: true
            }
        }

        super(schemaDefinition, {collection: 'slides'})
    }

    getSchema(){
        const schema = super.getSchema()
        schema.index({ title: 1 }, { unique: true });
        schema.index({ subtitle: 1 });
        schema.index({title: "text", subtitle: "text"}, {name: "text_index"});
        return schema
    }
}

export default mongoose.model('Slide', new Slide().getSchema())