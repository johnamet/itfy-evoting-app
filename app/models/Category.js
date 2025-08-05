#!/usr/bin/env node
/**
 * Category model class for the application.
 * Extends the BaseModel class and defines the schema for categories.
 *
 * @class Category
 * @extends BaseModel
 *
 * @property {String} name - The name of the category. Required.
 * @property {String} description - The description of the category. Required.
 * @property {Boolean} isActive - Indicates if the category is active. Defaults to true.
 * @property {Boolean} isDeleted - Indicates if the category is deleted. Defaults to false.
 * @property {mongoose.Schema.Types.ObjectId} createdBy - Reference to the user who created the category. Required.
 * @property {mongoose.Schema.Types.ObjectId} updatedBy - Reference to the user who last updated the category. Required.
 * @property {String} icon - The icon associated with the category. Required.
 * @property {Array<mongoose.Schema.Types.ObjectId>} candidates - Array of candidate references. Defaults to empty array.
 *
 * @constructor
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';


class Category extends BaseModel {

    constructor() {

        const schemaDefinition = {
            name: {
                type: String,
                required: true,
                trim: true
            },
            description: {
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
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            icon: {
                type: String,
                required: true,
                trim: true
            },
            candidates: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'Candidate',
                default: []
            },
            status: {
                type: String,
                default: "active"
            },
            event:{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },
            votingDeadline: {
                type: Date,
                required: true
            },
            isVotingOpen: {
                type: Boolean,
                default: false
            },
        };

        super(schemaDefinition, {collection: "categories"});
    }

    getSchema() {
        const schema = super.getSchema();
        schema.index({ name: 'text', description: 'text' }); // Text index for search
        schema.index({ createdAt: -1 }); // Index for sorting by creation date
        schema.index({ isActive: 1, isDeleted: 1 }); // Index for
        return  schema;
    }
}

export default mongoose.model('Category', new Category().getSchema());