#!/usr/bin/env node
/**
 * CouponUsage Model for tracking coupon usage
 *
 * @module CouponUsage
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const CouponUsageSchema = {
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coupon",
    required: true,
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
  },

  discountAmount: {
    type: Number,
    required: true,
  },

  usedAt: {
    type: Date,
    default: Date.now,
  },
};

const couponUsageModel = new BaseModel(CouponUsageSchema, {
  collection: "couponusages",
  timestamps: true,
});

// Add Indexes
couponUsageModel.addCompoundIndex([{ coupon: 1 }, { user: 1 }]);
couponUsageModel.addIndex({ usedAt: -1 });

const CouponUsage = couponUsageModel.getModel("CouponUsage");

export default CouponUsage;
