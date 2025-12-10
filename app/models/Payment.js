#!/usr/bin/env node
/**
 * Enhanced Payment Model for ITFY E-Voting System
 *
 * @module Payment
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./deprecated/BaseModel2.js";

const PaymentSchema = {
  // Reference
  reference: {
    type: String,
    required: [true, "Payment reference is required"],
    unique: true,
  },

  // Voter Info
  voter: {
    email: {
      type: String,
      required: [true, "Voter email is required"],
      lowercase: true,
    },
    name: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },

  // Vote Bundles
  voteBundles: [
    {
      bundle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VoteBundle",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      price: Number,
      votes: Number,
    },
  ],

  // Event and Candidate
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: [true, "Event reference is required"],
  },

  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Candidate",
  },

  // Transaction Details
  transaction: {
    provider: {
      type: String,
      enum: ["paystack", "stripe", "manual"],
      default: "paystack",
    },
    transactionId: String,
    accessCode: String,
    authorizationUrl: String,
    gatewayResponse: mongoose.Schema.Types.Mixed,
    channel: String,
    fees: {
      type: Number,
      default: 0,
    },
  },

  // Amounts
  amounts: {
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponDiscount: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    fees: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "GHS",
      uppercase: true,
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
  },

  // Status
  status: {
    type: String,
    enum: ["initialized", "pending", "processing", "success", "failed", "cancelled", "refunded"],
    default: "initialized",
  },

  // Verification
  verification: {
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    verificationAttempts: {
      type: Number,
      default: 0,
    },
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookVerified: {
      type: Boolean,
      default: false,
    },
    manualVerification: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },

  // Fraud Detection
  fraud: {
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    riskFactors: [String],
    blocked: {
      type: Boolean,
      default: false,
    },
    blockReason: String,
    ipAddress: String,
    deviceFingerprint: String,
    location: {
      city: String,
      country: String,
      coordinates: [Number],
    },
  },

  // Reconciliation
  reconciliation: {
    reconciled: {
      type: Boolean,
      default: false,
    },
    reconciledAt: Date,
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    discrepancyFound: {
      type: Boolean,
      default: false,
    },
    discrepancyReason: String,
    resolved: {
      type: Boolean,
      default: true,
    },
  },

  // Refund
  refund: {
    refunded: {
      type: Boolean,
      default: false,
    },
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String,
    refundTransactionId: String,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
};

// Create Payment model using BaseModel
const paymentModel = new BaseModel(PaymentSchema, {
  collection: "payments",
  timestamps: true,
});

// Add Indexes
paymentModel.addUniqueIndex({ reference: 1 });
paymentModel.addCompoundIndex([{ "voter.email": 1 }, { event: 1 }, { status: 1 }]);
paymentModel.addCompoundIndex([{ status: 1 }, { createdAt: -1 }]);
paymentModel.addIndex({ "transaction.transactionId": 1 });
paymentModel.addIndex({ "fraud.ipAddress": 1 });
paymentModel.addIndex({ event: 1, candidate: 1 });

// Virtuals

paymentModel.addVirtual("isPaid", function () {
  return this.status === "success";
});

paymentModel.addVirtual("isPending", function () {
  return this.status === "pending" || this.status === "processing";
});

paymentModel.addVirtual("canRefund", function () {
  return this.status === "success" && !this.refund.refunded;
});

paymentModel.addVirtual("netAmount", function () {
  return this.amounts.total - this.amounts.fees - this.amounts.discount;
});

// Instance Methods

paymentModel.addInstanceMethod("verify", async function () {
  // This will be implemented in PaymentService
  return this;
});

paymentModel.addInstanceMethod("complete", async function () {
  this.status = "success";
  this.verification.verified = true;
  this.verification.verifiedAt = new Date();
  return await this.save();
});

paymentModel.addInstanceMethod("fail", async function (reason = null) {
  this.status = "failed";
  if (reason) {
    this.metadata = this.metadata || {};
    this.metadata.failureReason = reason;
  }
  return await this.save();
});

paymentModel.addInstanceMethod("refund", async function (amount, reason, refundedBy = null) {
  if (!this.canRefund) {
    throw new Error("Payment cannot be refunded");
  }

  this.status = "refunded";
  this.refund.refunded = true;
  this.refund.refundedAt = new Date();
  this.refund.refundAmount = amount || this.amounts.total;
  this.refund.refundReason = reason;
  if (refundedBy) {
    this.refund.refundedBy = refundedBy;
  }

  return await this.save();
});

paymentModel.addInstanceMethod("assessFraud", function () {
  let riskScore = 0;
  const riskFactors = [];

  // Check for multiple payments from same IP
  // Check for unusual amounts
  // Check for suspicious patterns
  // This will be implemented in PaymentService

  this.fraud.riskScore = riskScore;
  this.fraud.riskFactors = riskFactors;

  return riskScore;
});

paymentModel.addInstanceMethod("reconcile", async function (reconciledBy = null) {
  this.reconciliation.reconciled = true;
  this.reconciliation.reconciledAt = new Date();
  if (reconciledBy) {
    this.reconciliation.reconciledBy = reconciledBy;
  }
  return await this.save();
});

// Static Methods

paymentModel.addStaticMethod("findByReference", async function (reference) {
  return await this.findOne({ reference, deleted: false });
});

paymentModel.addStaticMethod("findByVoter", async function (email) {
  return await this.find({
    "voter.email": email.toLowerCase(),
    deleted: false,
  }).sort({ createdAt: -1 });
});

paymentModel.addStaticMethod("findPending", async function () {
  return await this.find({
    status: { $in: ["pending", "processing"] },
    deleted: false,
  });
});

paymentModel.addStaticMethod("findUnreconciled", async function () {
  return await this.find({
    status: "success",
    "reconciliation.reconciled": false,
    deleted: false,
  });
});

paymentModel.addStaticMethod("getPaymentStats", async function (filters = {}) {
  const matchQuery = { deleted: false };
  if (filters.event) matchQuery.event = filters.event;
  if (filters.startDate && filters.endDate) {
    matchQuery.createdAt = { $gte: filters.startDate, $lte: filters.endDate };
  }

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amounts.total" },
        avgAmount: { $avg: "$amounts.total" },
      },
    },
  ]);

  return stats;
});

paymentModel.addStaticMethod("detectFraud", async function (threshold = 70) {
  return await this.find({
    "fraud.riskScore": { $gte: threshold },
    deleted: false,
  });
});

// Middleware

// Auto-assess fraud on save
paymentModel.addPreHook("save", function (next) {
  if (this.isNew && this.fraud.ipAddress) {
    this.assessFraud();
  }
  next();
});

// Create and export model
const Payment = paymentModel.getModel("Payment");

export default Payment;
