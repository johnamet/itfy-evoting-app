#!/usr/bin/env node
/**
 * Nomination Model for ITFY E-Voting System
 * 
 * Handles candidate nominations from external users (non-registered)
 * Supports self-nomination and multiple nominations per person
 * 
 * @module Nomination
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import validator from 'validator';
import BaseModel from './BaseModel.js';

const NominationSchema = {
    // Event & Category
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: [true, 'Event reference is required'],
        index: true
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category reference is required'],
        index: true
    },

    // Nominator Information (Anonymous - not a system user)
    nominator: {
        name: {
            type: String,
            required: [true, 'Nominator name is required'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Nominator email is required'],
            lowercase: true,
            trim: true,
            validate: {
                validator: validator.isEmail,
                message: 'Invalid nominator email format'
            }
        },
        phone: {
            type: String,
            trim: true
        },
        relationship: {
            type: String,
            trim: true,
            maxlength: [100, 'Relationship description cannot exceed 100 characters']
        }
    },

    // Nominee Information
    nominee: {
        name: {
            type: String,
            required: [true, 'Nominee name is required'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Nominee email is required'],
            lowercase: true,
            trim: true,
            validate: {
                validator: validator.isEmail,
                message: 'Invalid nominee email format'
            },
            index: true
        },
        phone: {
            type: String,
            trim: true
        },
        reasonForNomination: {
            type: String,
            required: [true, 'Reason for nomination is required'],
            trim: true,
            minlength: [50, 'Reason must be at least 50 characters'],
            maxlength: [1000, 'Reason cannot exceed 1000 characters']
        }
    },

    // Self-nomination flag
    isSelfNomination: {
        type: Boolean,
        default: false,
        index: true
    },

    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'duplicate'],
        default: 'pending',
        index: true
    },

    // Admin review
    review: {
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date,
        notes: {
            type: String,
            maxlength: [500, 'Review notes cannot exceed 500 characters']
        }
    },

    // Link to created candidate profile (if approved)
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        index: true
    },

    // Submission metadata
    submission: {
        submittedAt: {
            type: Date,
            default: Date.now
        },
        ip: String,
        userAgent: String
    }
};

// Create model using BaseModel
const nominationModel = new BaseModel(NominationSchema, {
    collection: 'nominations',
    timestamps: true
});

// Indexes
nominationModel.addCompoundIndex([
    { event: 1 },
    { category: 1 },
    { status: 1 }
]);

nominationModel.addCompoundIndex([
    { 'nominee.email': 1 },
    { event: 1 },
    { category: 1 }
]);

nominationModel.addCompoundIndex([
    { event: 1 },
    { status: 1 },
    { 'submission.submittedAt': -1 }
]);

// Text search on nominee name and reason
nominationModel.addTextIndex({
    'nominee.name': 'text',
    'nominee.reasonForNomination': 'text'
});

// Virtuals
nominationModel.addVirtual('isPending', function() {
    return this.status === 'pending';
});

nominationModel.addVirtual('isApproved', function() {
    return this.status === 'approved';
});

nominationModel.addVirtual('isProcessed', function() {
    return ['approved', 'rejected', 'duplicate'].includes(this.status);
});

// Instance Methods
nominationModel.addInstanceMethod('approve', async function(adminId, candidateId) {
    this.status = 'approved';
    this.candidate = candidateId;
    this.review = this.review || {};
    this.review.reviewedBy = adminId;
    this.review.reviewedAt = new Date();
    return await this.save();
});

nominationModel.addInstanceMethod('reject', async function(adminId, reason) {
    this.status = 'rejected';
    this.review = this.review || {};
    this.review.reviewedBy = adminId;
    this.review.reviewedAt = new Date();
    this.review.notes = reason;
    return await this.save();
});

nominationModel.addInstanceMethod('markAsDuplicate', async function(adminId, existingCandidateId) {
    this.status = 'duplicate';
    this.candidate = existingCandidateId;
    this.review = this.review || {};
    this.review.reviewedBy = adminId;
    this.review.reviewedAt = new Date();
    this.review.notes = 'Duplicate nomination - candidate already exists';
    return await this.save();
});

// Static Methods
nominationModel.addStaticMethod('findByEvent', async function(eventId, filters = {}) {
    const query = { event: eventId, ...filters };
    return await this.find(query)
        .populate('category', 'name')
        .populate('candidate', 'name status')
        .populate('review.reviewedBy', 'firstName lastName email')
        .sort({ 'submission.submittedAt': -1 });
});

nominationModel.addStaticMethod('findPendingByEvent', async function(eventId) {
    return await this.findByEvent(eventId, { status: 'pending' });
});

nominationModel.addStaticMethod('checkDuplicateNomination', async function(eventId, categoryId, nomineeEmail) {
    return await this.findOne({
        event: eventId,
        category: categoryId,
        'nominee.email': nomineeEmail.toLowerCase(),
        status: { $in: ['pending', 'approved'] }
    });
});

nominationModel.addStaticMethod('countByStatus', async function(eventId, categoryId = null) {
    const match = { event: eventId };
    if (categoryId) match.category = categoryId;

    return await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
});

nominationModel.addStaticMethod('getNominationStats', async function(eventId) {
    return await this.aggregate([
        { $match: { event: eventId } },
        {
            $group: {
                _id: {
                    category: '$category',
                    status: '$status'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.category',
                stats: {
                    $push: {
                        status: '$_id.status',
                        count: '$count'
                    }
                },
                total: { $sum: '$count' }
            }
        },
        {
            $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'category'
            }
        },
        { $unwind: '$category' },
        {
            $project: {
                categoryId: '$_id',
                categoryName: '$category.name',
                stats: 1,
                total: 1
            }
        }
    ]);
});

// Middleware
nominationModel.addPreHook('save', function(next) {
    // Auto-detect self-nomination
    if (this.nominator.email === this.nominee.email) {
        this.isSelfNomination = true;
    }
    next();
});

// Create and export model
const Nomination = nominationModel.getModel('Nomination');

export default Nomination;
