#!/usr/bin/env node
/**
 * Enhanced VoteBundle Model for ITFY E-Voting System
 *
 * @module VoteBundle
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const VoteBundleSchema = {
  // Basic Info
  name: {
    type: String,
    required: [true, "Bundle name is required"],
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  // Votes
  votes: {
    type: Number,
    required: [true, "Number of votes is required"],
    min: [1, "Minimum 1 vote required"],
  },

  // Pricing
  pricing: {
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: 0,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    currency: {
      type: String,
      default: "GHS",
      uppercase: true,
    },
    validFrom: Date,
    validUntil: Date,
    minimumPurchase: {
      type: Number,
      default: 1,
      min: 1,
    },
    maximumPurchase: {
      type: Number,
      default: null,
    },
  },

  // Features
  features: [
    {
      name: String,
      description: String,
      included: {
        type: Boolean,
        default: true,
      },
    },
  ],

  // Availability
  availability: {
    totalAvailable: {
      type: Number,
      default: null, // null = unlimited
    },
    sold: {
      type: Number,
      default: 0,
    },
    remaining: {
      type: Number,
      default: null,
    },
    limitPerUser: {
      type: Number,
      default: null,
    },
    limitPerTransaction: {
      type: Number,
      default: null,
    },
  },

  // Applicability
  applicability: {
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    specificCandidates: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Candidate",
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
  },

  // Display
  display: {
    order: {
      type: Number,
      default: 0,
    },
    badge: String,
    highlighted: {
      type: Boolean,
      default: false,
    },
    recommendedFor: String,
  },

  // Status
  status: {
    type: String,
    enum: ["draft", "active", "limited", "sold_out", "expired", "archived"],
    default: "draft",
  },

  // Popularity
  popular: {
    type: Number,
    default: 0,
  },
};

// Create VoteBundle model using BaseModel
const voteBundleModel = new BaseModel(VoteBundleSchema, {
  collection: "votebundles",
  timestamps: true,
});

// Add Indexes
voteBundleModel.addCompoundIndex([
  { status: 1 },
  { "pricing.validFrom": 1 },
  { "pricing.validUntil": 1 },
]);
voteBundleModel.addCompoundIndex([{ "applicability.events": 1 }, { status: 1 }]);
voteBundleModel.addIndex({ popular: -1, "pricing.basePrice": 1 });
voteBundleModel.addIndex({ votes: 1 });

// Virtuals

voteBundleModel.addVirtual("isAvailable", function () {
  if (this.status !== "active" && this.status !== "limited") return false;

  const now = new Date();
  if (this.pricing.validFrom && this.pricing.validFrom > now) return false;
  if (this.pricing.validUntil && this.pricing.validUntil < now) return false;

  if (this.availability.totalAvailable !== null) {
    return this.availability.remaining > 0;
  }

  return true;
});

voteBundleModel.addVirtual("effectivePrice", function () {
  if (this.pricing.discountPrice) return this.pricing.discountPrice;
  if (this.pricing.discountPercentage) {
    return this.pricing.basePrice * (1 - this.pricing.discountPercentage / 100);
  }
  return this.pricing.basePrice;
});

voteBundleModel.addVirtual("remainingPercentage", function () {
  if (this.availability.totalAvailable === null) return 100;
  return (this.availability.remaining / this.availability.totalAvailable) * 100;
});

voteBundleModel.addVirtual("isExpired", function () {
  if (!this.pricing.validUntil) return false;
  return this.pricing.validUntil < new Date();
});

// Instance Methods

voteBundleModel.addInstanceMethod("calculatePrice", async function (quantity = 1, appliedCoupon = null) {
  let price = this.effectivePrice * quantity;

  if (appliedCoupon) {
    const Coupon = mongoose.model("Coupon");
    const coupon = await Coupon.findByCode(appliedCoupon);
    if (coupon && (await coupon.canApply(null, { voteBundle: this._id, amount: price }))) {
      price = await coupon.calculateDiscount(price);
    }
  }

  return price;
});

voteBundleModel.addInstanceMethod("checkAvailability", function (quantity = 1) {
  if (!this.isAvailable) {
    throw new Error("Bundle is not available");
  }

  if (this.availability.totalAvailable !== null && this.availability.remaining < quantity) {
    throw new Error(`Only ${this.availability.remaining} bundles remaining`);
  }

  if (
    this.availability.limitPerTransaction !== null &&
    quantity > this.availability.limitPerTransaction
  ) {
    throw new Error(`Maximum ${this.availability.limitPerTransaction} bundles per transaction`);
  }

  return true;
});

voteBundleModel.addInstanceMethod("reserve", async function (quantity = 1) {
  this.checkAvailability(quantity);

  if (this.availability.totalAvailable !== null) {
    this.availability.remaining -= quantity;
    if (this.availability.remaining === 0) {
      this.status = "sold_out";
    } else if (this.availability.remaining < this.availability.totalAvailable * 0.1) {
      this.status = "limited";
    }
  }

  return await this.save();
});

voteBundleModel.addInstanceMethod("purchase", async function (quantity = 1) {
  await this.reserve(quantity);
  this.availability.sold += quantity;
  this.popular += quantity;
  return await this.save();
});

voteBundleModel.addInstanceMethod("refund", async function (quantity = 1) {
  if (this.availability.totalAvailable !== null) {
    this.availability.remaining += quantity;
    this.availability.sold -= quantity;
    this.status = "active";
  }
  return await this.save();
});

// Static Methods

voteBundleModel.addStaticMethod("findAvailable", async function (filters = {}) {
  const now = new Date();
  return await this.find({
    status: { $in: ["active", "limited"] },
    deleted: false,
    $or: [{ "pricing.validFrom": { $lte: now } }, { "pricing.validFrom": null }],
    $or: [{ "pricing.validUntil": { $gte: now } }, { "pricing.validUntil": null }],
    ...filters,
  }).sort({ "display.order": 1, "pricing.basePrice": 1 });
});

voteBundleModel.addStaticMethod("findForEvent", async function (eventId) {
  return await this.find({
    $or: [{ "applicability.events": eventId }, { "applicability.events": { $size: 0 } }],
    "applicability.excludeEvents": { $ne: eventId },
    status: { $in: ["active", "limited"] },
    deleted: false,
  });
});

voteBundleModel.addStaticMethod("getBundlesByPrice", async function (minPrice, maxPrice) {
  return await this.find({
    "pricing.basePrice": { $gte: minPrice, $lte: maxPrice },
    status: { $in: ["active", "limited"] },
    deleted: false,
  }).sort({ "pricing.basePrice": 1 });
});

voteBundleModel.addStaticMethod("getPopularBundles", async function (limit = 10) {
  return await this.find({
    status: { $in: ["active", "limited"] },
    deleted: false,
  })
    .sort({ popular: -1 })
    .limit(limit);
});

// Middleware

// Update remaining on save
voteBundleModel.addPreHook("save", function (next) {
  if (this.availability.totalAvailable !== null) {
    this.availability.remaining = this.availability.totalAvailable - this.availability.sold;
  }
  next();
});

// Update status based on expiry
voteBundleModel.addPreHook("save", function (next) {
  if (this.isExpired && this.status !== "expired") {
    this.status = "expired";
  }
  next();
});

// Create and export model
const VoteBundle = voteBundleModel.getModel("VoteBundle");

export default VoteBundle;
