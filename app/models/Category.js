#!/usr/bin/env node
/**
 * Enhanced Category Model for ITFY E-Voting System
 *
 * @module Category
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const CategorySchema = {
  // Basic Info
  name: {
    type: String,
    required: [true, "Category name is required"],
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  icon: {
    type: String,
    trim: true,
  },

  // Event Reference
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: [true, "Event reference is required"],
  },

  // Voting Rules
  votingRules: {
    minVotes: {
      type: Number,
      default: 1,
      min: 0,
    },
    maxVotes: {
      type: Number,
      default: null,
    },
    allowMultiple: {
      type: Boolean,
      default: false,
    },
    requirePayment: {
      type: Boolean,
      default: true,
    },
    votingStartDate: Date,
    votingEndDate: Date,
  },

  // Display Settings
  display: {
    order: {
      type: Number,
      default: 0,
    },
    color: {
      type: String,
      default: "#000000",
    },
    badge: String,
    featuredCandidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
    },
  },

  // Status
  status: {
    type: String,
    enum: ["draft", "active", "voting_open", "voting_closed", "completed"],
    default: "draft",
  },

  // Metrics
  metrics: {
    totalVotes: {
      type: Number,
      default: 0,
    },
    totalCandidates: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
  },

  // Settings
  settings: {
    showResults: {
      type: Boolean,
      default: false,
    },
    allowTie: {
      type: Boolean,
      default: true,
    },
    tieBreakingMethod: {
      type: String,
      enum: ["timestamp", "random", "manual"],
      default: "timestamp",
    },
  },
};

// Create Category model using BaseModel
const categoryModel = new BaseModel(CategorySchema, {
  collection: "categories",
  timestamps: true,
});

// Add Indexes
categoryModel.addCompoundIndex([{ event: 1 }, { status: 1 }, { "display.order": 1 }]);
categoryModel.addCompoundIndex([{ event: 1 }, { "votingRules.votingStartDate": 1 }]);
categoryModel.addTextIndex({ name: "text", description: "text" });

// Virtuals

categoryModel.addVirtual("isVotingOpen", function () {
  if (this.status !== "voting_open") return false;

  const now = new Date();
  const startValid = !this.votingRules.votingStartDate || this.votingRules.votingStartDate <= now;
  const endValid = !this.votingRules.votingEndDate || this.votingRules.votingEndDate >= now;

  return startValid && endValid;
});

// Instance Methods

categoryModel.addInstanceMethod("openVoting", async function () {
  this.status = "voting_open";
  return await this.save();
});

categoryModel.addInstanceMethod("closeVoting", async function () {
  this.status = "voting_closed";
  return await this.save();
});

categoryModel.addInstanceMethod("determineWinner", async function () {
  const Candidate = mongoose.model("Candidate");

  const candidates = await Candidate.find({
    categories: this._id,
    status: "active",
  }).sort({ "voting.totalVotes": -1 });

  if (candidates.length === 0) return null;

  // Check for tie
  if (candidates.length > 1 && candidates[0].voting.totalVotes === candidates[1].voting.totalVotes) {
    if (!this.settings.allowTie) {
      // Apply tie-breaking
      if (this.settings.tieBreakingMethod === "timestamp") {
        return candidates.sort((a, b) => a.voting.lastVoteAt - b.voting.lastVoteAt)[0];
      } else if (this.settings.tieBreakingMethod === "random") {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
  }

  return candidates[0];
});

categoryModel.addInstanceMethod("validateVote", async function (candidateId, votes = 1) {
  // Check if voting is open
  if (!this.isVotingOpen) {
    throw new Error("Voting is not open for this category");
  }

  // Check vote count
  if (this.votingRules.maxVotes && votes > this.votingRules.maxVotes) {
    throw new Error(`Maximum votes allowed is ${this.votingRules.maxVotes}`);
  }

  if (votes < this.votingRules.minVotes) {
    throw new Error(`Minimum votes required is ${this.votingRules.minVotes}`);
  }

  // Verify candidate belongs to this category
  const Candidate = mongoose.model("Candidate");
  const candidate = await Candidate.findOne({
    _id: candidateId,
    categories: this._id,
    status: "active",
  });

  if (!candidate) {
    throw new Error("Invalid candidate for this category");
  }

  return true;
});

// Static Methods

categoryModel.addStaticMethod("findByEvent", async function (eventId, filters = {}) {
  return await this.find({
    event: eventId,
    ...filters,
    deleted: false,
  }).sort({ "display.order": 1 });
});

categoryModel.addStaticMethod("findVotingOpen", async function () {
  const now = new Date();
  return await this.find({
    status: "voting_open",
    deleted: false,
    $or: [
      { "votingRules.votingStartDate": { $lte: now } },
      { "votingRules.votingStartDate": null },
    ],
    $or: [
      { "votingRules.votingEndDate": { $gte: now } },
      { "votingRules.votingEndDate": null },
    ],
  });
});

categoryModel.addStaticMethod("getCategoryStats", async function (categoryId) {
  const category = await this.findById(categoryId);
  if (!category) throw new Error("Category not found");

  const Vote = mongoose.model("Vote");
  const Candidate = mongoose.model("Candidate");

  const [votes, candidates] = await Promise.all([
    Vote.countDocuments({ category: categoryId, status: "valid" }),
    Candidate.countDocuments({ categories: categoryId, status: "active" }),
  ]);

  category.metrics.totalVotes = votes;
  category.metrics.totalCandidates = candidates;

  await category.save();
  return category.metrics;
});

// Middleware

// Auto-update status based on dates
categoryModel.addPreHook("save", function (next) {
  const now = new Date();

  if (
    this.status === "active" &&
    this.votingRules.votingStartDate &&
    this.votingRules.votingStartDate <= now
  ) {
    this.status = "voting_open";
  }

  if (
    this.status === "voting_open" &&
    this.votingRules.votingEndDate &&
    this.votingRules.votingEndDate < now
  ) {
    this.status = "voting_closed";
  }

  next();
});

// Create and export model
const Category = categoryModel.getModel("Category");

export default Category;
