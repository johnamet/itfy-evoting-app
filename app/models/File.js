#!/usr/bin/env node
/**
 * File Model
 * 
 * Defines the schema for storing file metadata in the database.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import BaseModel from './BaseModel.js';

class File extends BaseModel {
    constructor() {
        const schemaDefinition = {
            fileId: {
                type: String,
                unique: true,
                default: () => crypto.randomBytes(16).toString('hex'),
                required: [true, 'File ID is required']
            },
            filename: {
                type: String,
                required: [true, 'Filename is required']
            },
            originalName: {
                type: String,
                required: [true, 'Original name is required']
            },
            path: {
                type: String,
                required: [true, 'Path is required']
            },
            relativePath: {
                type: String,
                required: [true, 'Relative path is required']
            },
            size: {
                type: Number,
                required: [true, 'Size is required']
            },
            mimetype: {
                type: String,
                required: [true, 'MIME type is required']
            },
            uploadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: [true, 'Uploaded by is required']
            },
            entityType: {
                type: String,
                enum: ['candidate', 'event', 'document'],
                required: [true, 'Entity type is required']
            },
            entityId: {
                type: mongoose.Schema.Types.ObjectId,
                required: [true, 'Entity ID is required']
            },
            category: {
                type: String,
                default: null
            },
            status: {
                type: String,
                enum: ['pending', 'processed', 'deleted'],
                default: 'processed',
                required: [true, 'Status is required']
            },
        }
        super(schemaDefinition, { collection: "files" });
    }

    getSchema() {
        const schema = super.getSchema();
        schema.index({ entityType: 1, entityId: 1 });
        return schema;
    }
}

export default mongoose.model('File', new File().getSchema());