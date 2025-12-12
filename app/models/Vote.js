#!/usr/bin/env node
/**
 * Enhanced Vote Model for ITFY E-Voting System
 *
 * @module Vote
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const VoteSchema = {
  // Candidate Reference
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Candidate",
    required: [true, "Candidate reference is required"],
  },

  // Voter Info (embedded for anonymity)
  voter: {
    email: {
      type: String,
      required: [true, "Voter email is required"],
      lowercase: true,
    },
    name: String,
  
  },

  // Event and Category
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: [true, "Event reference is required"],
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: [true, "Category reference is required"],
  },

  // Vote Bundle Reference
  voteBundles: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VoteBundle",
    },
  ],

  // Verification
  verification: {
    paymentVerified: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    eligibilityChecked: {
      type: Boolean,
      default: false,
    },
    eligibilityValid: {
      type: Boolean,
      default: true,
    },
    duplicateChecked: {
      type: Boolean,
      default: false,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
  },

  // Source Information
  source: {
    ipAddress: String,
    userAgent: String,
    device: String,
    location: {
      city: String,
      country: String,
      coordinates: [Number],
    },
    referrer: String,
    platform: {
      type: String,
      enum: ["web", "mobile", "api"],
      default: "web",
    },
  },

  // Vote Weight
  weight: {
    baseWeight: {
      type: Number,
      default: 1,
    },
    multiplier: {
      type: Number,
      default: 1,
    },
    finalWeight: {
      type: Number,
      default: 1,
    },
  },

  // Status
  status: {
    type: String,
    enum: ["pending", "valid", "invalid", "disputed", "cancelled"],
    default: "pending",
  },

  // Audit Trail
  audit: {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,
    invalidatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    invalidatedAt: Date,
    invalidReason: String,
    disputedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    disputedAt: Date,
    disputeReason: String,
    disputeResolved: Boolean,
  },

  // Timestamp
  votedAt: {
    type: Date,
    default: Date.now,
  },
};

// Create Vote model using BaseModel
const voteModel = new BaseModel(VoteSchema, {
  collection: "votes",
  timestamps: true,
});

// Add Indexes
voteModel.addCompoundIndex([{ event: 1 }, { category: 1 }, { candidate: 1 }]);
voteModel.addCompoundIndex([{ "voter.email": 1 }, { event: 1 }, { category: 1 }]);
voteModel.addCompoundIndex([{ status: 1 }, { votedAt: -1 }]);
voteModel.addIndex({ "source.ipAddress": 1, event: 1 });
voteModel.addIndex({ "verification.paymentId": 1 });
voteModel.addIndex({ votedAt: -1 });

// Virtuals

voteModel.addVirtual("isValid", function () {
  return this.status === "valid";
});

voteModel.addVirtual("effectiveWeight", function () {
  return this.weight.finalWeight;
});

voteModel.addVirtual("age", function () {
  return Date.now() - this.votedAt.getTime();
});

// Instance Methods

voteModel.addInstanceMethod("validate", async function () {
  // Check payment verification
  if (!this.verification.paymentVerified) {
    this.status = "invalid";
    this.audit.invalidReason = "Payment not verified";
    return await this.save();
  }

  // Check for duplicates
  const duplicates = await this.constructor.findDuplicates(
    this.voter.email,
    this.event,
    this.category
  );

  if (duplicates.length > 1) {
    this.verification.isDuplicate = true;
    this.status = "invalid";
    this.audit.invalidReason = "Duplicate vote detected";
    return await this.save();
  }

  this.status = "valid";
  return await this.save();
});

voteModel.addInstanceMethod("invalidate", async function (reason, by = null) {
  this.status = "invalid";
  this.audit.invalidatedAt = new Date();
  this.audit.invalidReason = reason;
  if (by) {
    this.audit.invalidatedBy = by;
  }
  return await this.save();
});

voteModel.addInstanceMethod("dispute", async function (reason, by) {
  this.status = "disputed";
  this.audit.disputedAt = new Date();
  this.audit.disputeReason = reason;
  this.audit.disputedBy = by;
  this.audit.disputeResolved = false;
  return await this.save();
});

voteModel.addInstanceMethod("resolveDispute", async function (resolution, by) {
  this.status = resolution === "valid" ? "valid" : "invalid";
  this.audit.disputeResolved = true;
  this.audit.verifiedBy = by;
  this.audit.verifiedAt = new Date();
  return await this.save();
});

voteModel.addInstanceMethod("cancel", async function (reason, by = null) {
  this.status = "cancelled";
  this.audit.invalidatedAt = new Date();
  this.audit.invalidReason = reason;
  if (by) {
    this.audit.invalidatedBy = by;
  }
  return await this.save();
});

// Static Methods

voteModel.addStaticMethod("findByCandidate", async function (candidateId, filters = {}) {
  return await this.find({
    candidate: candidateId,
    ...filters,
    deleted: false,
  });
});

voteModel.addStaticMethod("countValidVotes", async function (candidateId) {
  return await this.countDocuments({
    candidate: candidateId,
    status: "valid",
    deleted: false,
  });
});

voteModel.addStaticMethod("findDuplicates", async function (voterEmail, eventId, categoryId) {
  return await this.find({
    "voter.email": voterEmail.toLowerCase(),
    event: eventId,
    category: categoryId,
    deleted: false,
  });
});

voteModel.addStaticMethod("findByPayment", async function (paymentId) {
  return await this.find({
    "verification.paymentId": paymentId,
    deleted: false,
  });
});

voteModel.addStaticMethod("getVotingStats", async function (filters = {}) {
  const matchQuery = { deleted: false };
  if (filters.event) matchQuery.event = filters.event;
  if (filters.category) matchQuery.category = filters.category;
  if (filters.candidate) matchQuery.candidate = filters.candidate;

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalWeight: { $sum: "$weight.finalWeight" },
      },
    },
  ]);

  return stats.reduce(
    (acc, item) => {
      acc[item._id] = {
        count: item.count,
        totalWeight: item.totalWeight,
      };
      return acc;
    },
    { total: 0 }
  );
});

voteModel.addStaticMethod("detectAnomalies", async function (threshold = 10) {
  // Find voters with more than threshold votes
  const anomalies = await this.aggregate([
    { $match: { deleted: false } },
    {
      $group: {
        _id: {
          email: "$voter.email",
          event: "$event",
        },
        count: { $sum: 1 },
        votes: { $push: "$$ROOT" },
      },
    },
    { $match: { count: { $gte: threshold } } },
  ]);

  return anomalies;
});

// Middleware

// Calculate final weight before saving
voteModel.addPreHook("save", function (next) {
  this.weight.finalWeight = this.weight.baseWeight * this.weight.multiplier;
  next();
});

// Update candidate vote count after save
voteModel.addPostHook("save", async function (doc) {
  if (doc.status === "valid") {
    const Candidate = mongoose.model("Candidate");
    await Candidate.updateOne(
      { _id: doc.candidate },
      {
        $inc: { "voting.totalVotes": doc.weight.finalWeight },
        $set: { "voting.lastVoteAt": doc.votedAt },
      }
    );
  }
});

// Create and export model
const Vote = voteModel.getModel("Vote");

export default Vote;
