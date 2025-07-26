#!/usr/bin/env node
/**
 * Forms model class for the application.
 * This file defines the Forms class which extends the BaseModel class.
 */
import BaseModel from "./BaseModel.js";
import mongoose from "mongoose";

class Form extends BaseModel {
     
    constructor(){
        const schemaDefinition = {
            modelId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                trim: true
            },
            model: {
                type: String,
                required: true,
                trim: true
            },
            fields: {
                type: [Object],
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
                ref: 'User'
            }
        }

        super(schemaDefinition, {collection: "forms"});
    }

    getSchema(){
        const schema = super.getSchema();
        schema.index({ modelId: 1, model: 1 }, { unique: true});

        schema.index({ isActive: 1, isDeleted: 1 });
        schema.index({ createdBy: 1, updatedBy: 1 });   
        return schema;
    }
}

export default mongoose.model('Form', Form.getSchema());