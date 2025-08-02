#!/usr/bin/env node
/**
 * Payment model class for the application.
 * This file defines the Payment class which extends the BaseModel class.
 * 
 * @module Payment
 */

import BaseModel from './BaseModel.js';
import mongoose from 'mongoose';

/**
 * Payment model class extending BaseModel.
 * Represents a payment transaction for vote bundles with Paystack integration.
 * Supports public voting with voter information (email, IP, contact).
 * 
 * @class
 * @extends BaseModel
 */
class Payment extends BaseModel {
    /**
     * Initializes the Payment schema with fields for Paystack transactions, bundles, and voter info.
     */
    constructor() {
        const schemaDefinition = {
            // Paystack transaction reference
            reference: {
                type: String,
                required: true,
                unique: true,
                trim: true
            },
            // Voter information (public voting)
            voter: {
                email: {
                    type: String,
                    required: true,
                    trim: true,
                    lowercase: true,
                    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
                },
                contact: {
                    type: String,
                    required: false,
                    trim: true
                },
                name: {
                    type: String,
                    required: false,
                    trim: true
                },
                ipAddress: {
                    type: String,
                    required: true,
                    trim: true
                },
                userAgent: {
                    type: String,
                    required: false,
                    trim: true
                }
            },
            // Vote bundles being purchased
            voteBundles: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'VoteBundle',
                required: true
            }],
            // Event for which the bundle is purchased
            event: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },
            // Category for which the bundle is purchased
            category: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Category',
                required: true
            },
            // Coupon applied (optional)
            coupon: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Coupon',
                required: false
            },
            // Original bundle price
            originalAmount: {
                type: Number,
                required: true,
                min: 0
            },
            // Discount amount (if coupon applied)
            discountAmount: {
                type: Number,
                default: 0,
                min: 0
            },
            // Final amount paid
            finalAmount: {
                type: Number,
                required: true,
                min: 0
            },
            // Currency
            currency: {
                type: String,
                required: true,
                default: 'GHS',
                uppercase: true
            },
            // Payment status
            status: {
                type: String,
                required: true,
                enum: ['pending', 'success', 'failed', 'abandoned', 'expired'],
                default: 'pending'
            },
            // Paystack transaction data
            paystackData: {
                authorization_url: String,
                access_code: String,
                transaction_id: String,
                gateway_response: String,
                paid_at: Date,
                channel: String,
                fees: Number,
                customer: {
                    id: String,
                    email: String,
                    customer_code: String
                }
            },
            // Vote casting details
            votesCast: {
                type: Number,
                default: 0,
                min: 0
            },
            votesRemaining: {
                type: Number,
                required: true,
                min: 0
            },
            // Votes that have been cast using this payment
            votesData: [{
                candidate: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Candidate',
                    required: true
                },
                votesUsed: {
                    type: Number,
                    required: true,
                    min: 1
                },
                castedAt: {
                    type: Date,
                    default: Date.now
                }
            }],
            // Payment metadata
            metadata: {
                webhook_verified: {
                    type: Boolean,
                    default: false
                },
                verification_attempts: {
                    type: Number,
                    default: 0
                },
                fraud_check: {
                    passed: {
                        type: Boolean,
                        default: true
                    },
                    reasons: [String]
                }
            },
            // Timestamps
            paidAt: {
                type: Date,
                required: false
            },
            expiresAt: {
                type: Date,
                required: true,
                default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
            }
        };

        super(schemaDefinition, { collection: 'payments' });
    }

    /**
     * Returns the Mongoose schema with additional indexes and middleware.
     * @returns {mongoose.Schema} The constructed schema.
     */
    getSchema() {
        const schema = super.getSchema();

        // Indexes for efficient queries
        schema.index({ reference: 1 });
        schema.index({ 'voter.email': 1 });
        schema.index({ 'voter.ipAddress': 1 });
        schema.index({ status: 1 });
        schema.index({ event: 1, category: 1 });
        schema.index({ voteBundle: 1 });
        schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for cleanup
        schema.index({ 'paystackData.transaction_id': 1 });

        // Compound indexes for common queries
        schema.index({ 'voter.email': 1, status: 1 });
        schema.index({ event: 1, category: 1, status: 1 });
        schema.index({ 'voter.email': 1, event: 1, category: 1 });
        schema.index({ 'voter.ipAddress': 1, event: 1, category: 1 });

        // Unique constraint to prevent duplicate payments for same email/event/category
        schema.index(
            { 'voter.email': 1, event: 1, category: 1, status: 1 },
            { 
                unique: true,
                partialFilterExpression: { 
                    status: { $in: ['pending', 'success'] } 
                }
            }
        );

        // Pre-save middleware to calculate votes remaining
        schema.pre('save', function(next) {
            if (this.isNew || this.isModified('votesCast')) {
                // votesRemaining should be calculated from bundle votes minus votes cast
                if (this.populated('voteBundle') && this.voteBundle.votes) {
                    this.votesRemaining = this.voteBundle.votes - this.votesCast;
                }
            }
            next();
        });

        // Virtual for checking if payment is expired
        schema.virtual('isExpired').get(function() {
            return this.status === 'pending' && new Date() > this.expiresAt;
        });

        // Virtual for total votes purchased
        schema.virtual('totalVotes').get(function() {
            return this.votesCast + this.votesRemaining;
        });

        // Instance method to check if voter can cast more votes
        schema.methods.canCastVotes = function(votesToCast = 1) {
            return this.status === 'success' && this.votesRemaining >= votesToCast;
        };

        // Instance method to cast votes
        schema.methods.castVotes = function(candidate, votesToCast = 1) {
            if (!this.canCastVotes(votesToCast)) {
                throw new Error('Insufficient votes remaining or payment not successful');
            }

            this.votesCast += votesToCast;
            this.votesRemaining -= votesToCast;
            
            // Add to votes data
            const existingVote = this.votesData.find(v => v.candidate.toString() === candidate.toString());
            if (existingVote) {
                existingVote.votesUsed += votesToCast;
            } else {
                this.votesData.push({
                    candidate,
                    votesUsed: votesToCast,
                    castedAt: new Date()
                });
            }

            return this.save();
        };

        // Static method to find payments by voter
        schema.statics.findByVoter = function(email, options = {}) {
            const query = { 'voter.email': email };
            if (options.event) query.event = options.event;
            if (options.category) query.category = options.category;
            if (options.status) query.status = options.status;
            
            return this.find(query)
                .populate('voteBundle')
                .populate('event')
                .populate('category')
                .populate('coupon')
                .sort({ createdAt: -1 });
        };

        // Static method to check if voter has already paid for event/category
        schema.statics.hasVoterPaid = function(email, eventId, categoryId) {
            return this.findOne({
                'voter.email': email,
                event: eventId,
                category: categoryId,
                status: { $in: ['pending', 'success'] }
            });
        };

        return schema;
    }
}

export default mongoose.model('Payment', new Payment().getSchema());
