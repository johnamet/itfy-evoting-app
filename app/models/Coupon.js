#!/usr/bin/env node
/**
 * Enhanced Coupon Model for ITFY E-Voting System
 *
 * @module Coupon
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const CouponSchema = {
  // Basic Info
  name: {
    type: String,
    required: [true, "Coupon name is required"],
    trim: true,
  },

  code: {
    type: String,
    required: [true, "Coupon code is required"],
    unique: true,
    uppercase: true,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  // Discount
  discount: {
    type: Number,
    required: [true, "Discount value is required"],
    min: 0,
  },

  discountType: {
    type: String,
    enum: ["percentage", "fixed"],
    required: [true, "Discount type is required"],
  },

  // Rules
  rules: {
    minimumPurchaseAmount: {
      type: Number,
      default: 0,
    },
    maximumDiscountAmount: {
      type: Number,
      default: null,
    },
    applicableEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    applicableBundles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VoteBundle",
      },
    ],
    excludeEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    excludeCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    excludeBundles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VoteBundle",
      },
    ],
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
    },
    usageLimitPerUser: {
      type: Number,
      default: 1,
    },
    validFrom: Date,
    validUntil: Date,
    validDays: [
      {
        type: Number,
        min: 0,
        max: 6, // 0 = Sunday, 6 = Saturday
      },
    ],
    validHours: [
      {
        type: Number,
        min: 0,
        max: 23,
      },
    ],
  },

  // Targeting
  targeting: {
    userSegments: [String],
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    emailDomains: [String],
    firstTimeUsers: {
      type: Boolean,
      default: false,
    },
    returningUsers: {
      type: Boolean,
      default: false,
    },
    geographicRestrictions: {
      countries: [String],
      cities: [String],
    },
  },

  // Usage Tracking
  usage: {
    totalUsed: {
      type: Number,
      default: 0,
    },
    uniqueUsers: {
      type: Number,
      default: 0,
    },
    totalDiscountGiven: {
      type: Number,
      default: 0,
    },
    lastUsedAt: Date,
    firstUsedAt: Date,
  },

  // Status
  status: {
    type: String,
    enum: ["draft", "active", "paused", "expired", "exhausted", "archived"],
    default: "draft",
  },

  // Stackable
  stackable: {
    type: Boolean,
    default: false,
  },

  // Priority for stacking
  priority: {
    type: Number,
    default: 0,
  },

  // Expiry
  expiryDate: Date,
};

// Create Coupon model using BaseModel
const couponModel = new BaseModel(CouponSchema, {
  collection: "coupons",
  timestamps: true,
});

// Add Indexes
couponModel.addUniqueIndex({ code: 1 });
couponModel.addCompoundIndex([{ status: 1 }, { "rules.validFrom": 1 }, { "rules.validUntil": 1 }]);
couponModel.addCompoundIndex([{ "rules.applicableEvents": 1 }, { status: 1 }]);
couponModel.addIndex({ code: 1, status: 1 });
couponModel.addIndex({ expiryDate: 1 });

// Virtuals

couponModel.addVirtual("isActive", function () {
  if (this.status !== "active") return false;

  const now = new Date();
  if (this.rules.validFrom && this.rules.validFrom > now) return false;
  if (this.rules.validUntil && this.rules.validUntil < now) return false;
  if (this.expiryDate && this.expiryDate < now) return false;

  return true;
});

couponModel.addVirtual("isExpired", function () {
  const now = new Date();
  if (this.expiryDate && this.expiryDate < now) return true;
  if (this.rules.validUntil && this.rules.validUntil < now) return true;
  return false;
});

couponModel.addVirtual("isExhausted", function () {
  if (this.rules.usageLimit === null) return false;
  return this.usage.totalUsed >= this.rules.usageLimit;
});

couponModel.addVirtual("remainingUses", function () {
  if (this.rules.usageLimit === null) return Infinity;
  return Math.max(0, this.rules.usageLimit - this.usage.totalUsed);
});

// Instance Methods

couponModel.addInstanceMethod("validate", async function (context = {}) {
  // Check if active
  if (!this.isActive) {
    throw new Error("Coupon is not active");
  }

  // Check expiry
  if (this.isExpired) {
    throw new Error("Coupon has expired");
  }

  // Check usage limit
  if (this.isExhausted) {
    throw new Error("Coupon usage limit reached");
  }

  // Check time restrictions
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  if (this.rules.validDays.length > 0 && !this.rules.validDays.includes(dayOfWeek)) {
    throw new Error("Coupon not valid on this day");
  }

  if (this.rules.validHours.length > 0 && !this.rules.validHours.includes(hour)) {
    throw new Error("Coupon not valid at this hour");
  }

  return true;
});

couponModel.addInstanceMethod("canApply", async function (user, order) {
  try {
    await this.validate();

    // Check minimum purchase amount
    if (order.amount < this.rules.minimumPurchaseAmount) {
      return false;
    }

    // Check event applicability
    if (this.rules.applicableEvents.length > 0 && order.event) {
      if (!this.rules.applicableEvents.some((e) => e.equals(order.event))) {
        return false;
      }
    }

    // Check exclusions
    if (this.rules.excludeEvents.length > 0 && order.event) {
      if (this.rules.excludeEvents.some((e) => e.equals(order.event))) {
        return false;
      }
    }

    // Check user-specific limits
    if (user && this.rules.usageLimitPerUser) {
      const CouponUsage = mongoose.model("CouponUsage");
      const userUsage = await CouponUsage.countDocuments({
        coupon: this._id,
        user: user._id,
      });

      if (userUsage >= this.rules.usageLimitPerUser) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
});

couponModel.addInstanceMethod("calculateDiscount", async function (amount) {
  if (this.discountType === "percentage") {
    let discount = (amount * this.discount) / 100;

    // Apply maximum discount cap
    if (this.rules.maximumDiscountAmount && discount > this.rules.maximumDiscountAmount) {
      discount = this.rules.maximumDiscountAmount;
    }

    return Math.max(0, amount - discount);
  } else {
    return Math.max(0, amount - this.discount);
  }
});

couponModel.addInstanceMethod("recordUsage", async function (user, order) {
  this.usage.totalUsed += 1;
  this.usage.lastUsedAt = new Date();

  if (!this.usage.firstUsedAt) {
    this.usage.firstUsedAt = new Date();
  }

  // Calculate discount given
  const originalAmount = order.amount;
  const discountedAmount = await this.calculateDiscount(originalAmount);
  this.usage.totalDiscountGiven += originalAmount - discountedAmount;

  // Update status if exhausted
  if (this.isExhausted) {
    this.status = "exhausted";
  }

  await this.save();

  // Record in CouponUsage collection
  const CouponUsage = mongoose.model("CouponUsage");
  await CouponUsage.create({
    coupon: this._id,
    user: user?._id,
    order: order._id,
    discountAmount: originalAmount - discountedAmount,
  });
});

couponModel.addInstanceMethod("deactivate", async function () {
  this.status = "paused";
  return await this.save();
});

// Static Methods

couponModel.addStaticMethod("findByCode", async function (code) {
  return await this.findOne({
    code: code.toUpperCase(),
    deleted: false,
  });
});

couponModel.addStaticMethod("findAvailable", async function (filters = {}) {
  const now = new Date();
  return await this.find({
    status: "active",
    deleted: false,
    $or: [{ "rules.validFrom": { $lte: now } }, { "rules.validFrom": null }],
    $or: [{ "rules.validUntil": { $gte: now } }, { "rules.validUntil": null }],
    $or: [{ expiryDate: { $gte: now } }, { expiryDate: null }],
    ...filters,
  });
});

couponModel.addStaticMethod("getBestCoupon", async function (order) {
  const availableCoupons = await this.findAvailable();

  let bestCoupon = null;
  let maxDiscount = 0;

  for (const coupon of availableCoupons) {
    if (await coupon.canApply(null, order)) {
      const discountedAmount = await coupon.calculateDiscount(order.amount);
      const discount = order.amount - discountedAmount;

      if (discount > maxDiscount) {
        maxDiscount = discount;
        bestCoupon = coupon;
      }
    }
  }

  return bestCoupon;
});

couponModel.addStaticMethod("getCouponStats", async function (couponId) {
  const coupon = await this.findById(couponId);
  if (!coupon) throw new Error("Coupon not found");

  return coupon.usage;
});

// Middleware

// Auto-expire based on date
couponModel.addPreHook("save", function (next) {
  if (this.isExpired && this.status !== "expired") {
    this.status = "expired";
  }
  next();
});

// Auto-exhaust based on usage
couponModel.addPreHook("save", function (next) {
  if (this.isExhausted && this.status !== "exhausted") {
    this.status = "exhausted";
  }
  next();
});

// Create and export model
const Coupon = couponModel.getModel("Coupon");

export default Coupon;
