#!/usr/bin/env node
/**
 * The base model for the application.
 * This file defines the BaseModel class which can be extended by other models.
 * 
 * It includes common methods and properties that can be reused across different models.
 */

import mongoose from 'mongoose';

/**
 * BaseModel is a base class for creating Mongoose models with common schema fields and methods.
 * It automatically adds `createdAt` and `updatedAt` fields to the schema, and provides utility methods.
 *
 * @class
 * @param {Object} schemaDefinition - The Mongoose schema definition object.
 * @param {Object} [options={}] - Optional Mongoose schema options.
 *
 * @property {mongoose.Schema} schema - The constructed Mongoose schema with base fields and methods.
 *
 * @method getSchema - Returns the constructed Mongoose schema.
 *
 * @example
 * const userModel = new BaseModel({ name: String }).getSchema();
 */
class BaseModel {

    constructor(schemaDefinition, options= {}) {
        if (new.target === BaseModel) {
            throw new Error("BaseModel is an abstract class and cannot be instantiated directly.");
        }
        this.schemaDefinition = schemaDefinition;
        this.options = options;

        const baseSchema = {
            ...this.schemaDefinition,
            createdAt: {
                type: Date,
                default: () => Date.now(),
                immutable: true,
            },

            updatedAt: {
                type: Date,
                default: () => Date.now(),
            }
        }

        this.schema = new mongoose.Schema(baseSchema, this.options);

        this.schema.pre('save', function(next) {
            this.updatedAt = Date.now();
            next();
        });

        this.schema.methods.toJSON = function() {
            const obj = this.toObject();
            delete obj.__v; // Exclude version key

            if (obj.password) {
                delete obj.password; // Exclude password field
            }
            return obj;
        }

        this.schema.methods.all = async function(page=1, pageSize=10, filters={}) {
            return this.find(filters)
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .sort({ createdAt: -1 })
                .exec();
        }

        this.schema.methods.findOne = async function findOne(params) {
            return this.findOne(params);
        }
    }

    getSchema() {
        return this.schema;
    }
}

export default BaseModel;