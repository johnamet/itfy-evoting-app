#!/usr/bin/env node
/**
 * User model
 **/

import BaseModel from "./BaseModel.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

class User extends BaseModel {
    constructor() {
        const schemaDefinition = {
            name: {
                type: String,
                required: true,
                trim: true
            },
            role: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Role',
                required: true
            },
            email: {
                type: String,
                required: true,
                unique: true,
                lowercase: true,
                trim: true,
                validate: {
                    validator: function (v) {
                        return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(v);
                    },
                }
            },
            password: {
                type: String,
                required: true,
                validate: {
                    validator: function (v) {
                        return v.length >= 6 && v.length <= 100 && !/^\s+$/.test(v);
                    },
                    message: 'Password must be at least 6 characters long.'
                },
            },
            bio: {
                type: String,
                trim: true,
            },
            image: {
                type: String,
                trim: true
            },
            passwordResetToken: {
                type: String,
                default: null
            },
            passwordResetExpires: {
                type: Date,
                default: null
            },
            lastLogin: {
                type: Date,
                default: null
            },
            lastLoginIP: {
                type: String,
                default: null
            },
            lastLoginLocation: {
                type: String,
                default: null
            },
            isActive: {
                type: Boolean,
                default: true
            },
            status: {
                type: String,
                default: "active"
            }
        };

        super(schemaDefinition, { collection: 'users' });

        // Pre-save middleware to hash password
        this.schema.pre('save', async function(next) {
            if (!this.isModified('password')) return next();
            
            try {
                const saltRounds = 12;
                this.password = await bcrypt.hash(this.password, saltRounds);
                next();
            } catch (error) {
                next(error);
            }
        });

        // Instance method to verify password
        this.schema.methods.verifyPassword = async function(candidatePassword) {
            return await bcrypt.compare(candidatePassword, this.password);
        };

        // Static method to find user by email and verify password
        this.schema.statics.findByEmailAndPassword = async function(email, password) {
            console.log('🔍 Finding user by email:', email);
            const user = await this.findOne({ email: email.toLowerCase() });
            if (!user) return null;
            console.log('🔑 Verifying password for user:', user._id);
            if (!user.password) {
                console.log('⚠️ User has no password set');
                return null;
            }

            console.log('🔐 Password found, verifying...');

            console.log('🔐 Comparing passwords...', password);
            const isMatch = await user.verifyPassword(password);
            return isMatch ? user : null;
        };
    }

    getSchema() {
        const schema = super.getSchema();

        // Override toJSON to exclude password from serialization
        schema.methods.toJSON = function() {
            const obj = this.toObject();
            delete obj.__v; // Exclude version key
            delete obj.password; // Exclude password
            return obj;
        };
        
        return schema;
    }
}

export default mongoose.model('User', new User().getSchema());