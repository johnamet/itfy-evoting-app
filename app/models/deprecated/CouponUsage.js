#!/usr/bin/env node
/**
 * The CouponUsage model for tracking coupon usage
 * 
 * This model tracks when and by whom coupons are used,
 * providing detailed analytics and usage history.
 */
import BaseModel from "./BaseModel.js";
import mongoose from "mongoose";

class CouponUsage extends BaseModel {

    constructor() {

        const schemaDefinition = {
            coupon: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Coupon',
                required: true
            },
            orderAmount: {
                type: Number,
                required: true,
                min: 0
            },
            discountAmount: {
                type: Number,
                required: true,
                min: 0
            },
            finalAmount: {
                type: Number,
                required: true,
                min: 0
            },
            usageDate: {
                type: Date,
                default: Date.now,
                required: true
            },
            event: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: false
            },
            categories: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Category'
            }],
            metadata: {
                type: mongoose.Schema.Types.Mixed,
                default: {}
            }
        };

        super(schemaDefinition, {collection: "couponUsages"});
    }

    getSchema(){
        const schema = super.getSchema();
        
        // Indexes for efficient querying
        schema.index({ coupon: 1});
        schema.index({ coupon: 1, usageDate: -1 });
        schema.index({ usageDate: -1 });
        schema.index({ event: 1 });
        schema.index({ categories: 1 });
        
        // Compound index for coupon stats
        schema.index({ coupon: 1, discountAmount: 1 });

        return schema;
    }
}

export default mongoose.model('CouponUsage', new CouponUsage().getSchema());
