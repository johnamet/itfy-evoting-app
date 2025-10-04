#!/usr/bin/env node
/**
 * Forms model class for the application.
 * This file defines the Forms class which extends the BaseModel class.
 */
import BaseModel from "./BaseModel.js";
import mongoose from "mongoose";

class Form extends BaseModel {
     
    constructor(){
        const submissionSchema = new mongoose.Schema({
            submittedBy: {
            type:  String,
            required: false
            },
            submittedAt: {
            type: Date,
            default: Date.now
            },
            data: {
            type: Object,
            required: true
            },
            ipAddress: {
            type: String,
            required: true
            },
            userAgent: {
            type: String,
            required: false
            },
            createdAt: {
            type: Date,
            default: Date.now
            },
            status: {
            type: String,
            default: "pending",
            enum: ["pending", "approved", "rejected"]
            },
            updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
            },
            updatedAt: {
            type: Date
            }
        });

        const schemaDefinition = {
            title: {
                type: String,
                required: true,
                trim: true
            },
            description:{
                type: String,
                required: false,
            },
            modelId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            trim: true
            },
            model: {
            type: String,
            required: true,
            trim: true,
            enum: ['Event', 'Candidate', 'Category'] // Restrict to known models
            },
            fields: {
            type: [Object],
            default: [{label:"Your Name", type: "text", options: [], required: true}]
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
            },
            submissionCount: {
            type: Number,
            default: 0
            },
            submissions: [submissionSchema],
            maxSubmissions: {
                type: Number,
                default: 0
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

export default mongoose.model('Form', new Form().getSchema());