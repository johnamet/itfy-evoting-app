#!/usr/bin/env node
/**
 * Enhanced Candidate Model for ITFY E-Voting System
 *
 * @module Candidate
 * @version 2.0.0
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import BaseModel from "./deprecated/BaseModel2.js";
import config from "../config/ConfigManager.js";

const CandidateSchema = {
  // Basic Info
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
  },

  email: {
    type: String,
    required: [true, "Email is required"],
    lowercase: true,
    trim: true,
    validate: {
      validator: validator.isEmail,
      message: "Invalid email format",
    },
  },

  // Profile
  profile: {
    title: String,
    bio: {
      type: String,
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    company: String,
    website: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Invalid website URL",
      },
    },
    socialLinks: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
    },
    education: [
      {
        institution: String,
        degree: String,
        year: Number,
      },
    ],
    experience: [
      {
        company: String,
        position: String,
        startDate: Date,
        endDate: Date,
        current: Boolean,
      },
    ],
    achievements: [String],
  },

  // Media
  media: {
    photo: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Invalid photo URL",
      },
    },
    gallery: [String],
    videos: [String],
    documents: [
      {
        title: String,
        url: String,
        type: String,
      },
    ],
  },

  // Credentials
  credentials: {
    cId: {
      type: String,
      unique: true,
      sparse: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },

  // Voting Stats
  voting: {
    totalVotes: {
      type: Number,
      default: 0,
    },
    ranking: {
      type: Number,
      default: 0,
    },
    lastVoteAt: Date,
  },

  // Event and Categories
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: [true, "Event reference is required"],
  },

  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],

  // Status
  status: {
    type: String,
    enum: ["draft", "pending_approval", "approved", "rejected", "active", "disqualified"],
    default: "draft",
  },

  // Metadata
  metadata: {
    nominatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: String,
    disqualificationReason: String,
  },
};

// Create Candidate model using BaseModel
const candidateModel = new BaseModel(CandidateSchema, {
  collection: "candidates",
  timestamps: true,
});

// Add Indexes
candidateModel.addCompoundIndex([{ event: 1 }, { status: 1 }, { categories: 1 }]);
candidateModel.addCompoundIndex([{ event: 1 }, { "voting.totalVotes": -1 }]);
candidateModel.addUniqueIndex({ email: 1, event: 1 });
candidateModel.addUniqueIndex({ "credentials.cId": 1 }, { sparse: true });
candidateModel.addTextIndex({ name: "text", "profile.bio": "text" });

// Virtuals

candidateModel.addVirtual("isApproved", function () {
  return this.status === "approved" || this.status === "active";
});

candidateModel.addVirtual("canReceiveVotes", function () {
  return this.status === "active";
});

candidateModel.addVirtual("voteCount", function () {
  return this.voting.totalVotes;
});

// Instance Methods

candidateModel.addInstanceMethod("approve", async function (approvedBy) {
  this.status = "approved";
  this.metadata = this.metadata || {};
  this.metadata.approvedBy = approvedBy;
  return await this.save();
});

candidateModel.addInstanceMethod("reject", async function (rejectedBy, reason) {
  this.status = "rejected";
  this.metadata = this.metadata || {};
  this.metadata.rejectedBy = rejectedBy;
  this.metadata.rejectionReason = reason;
  return await this.save();
});

candidateModel.addInstanceMethod("activate", async function () {
  if (this.status !== "approved") {
    throw new Error("Candidate must be approved before activation");
  }
  this.status = "active";
  return await this.save();
});

candidateModel.addInstanceMethod("disqualify", async function (reason) {
  this.status = "disqualified";
  this.metadata = this.metadata || {};
  this.metadata.disqualificationReason = reason;
  return await this.save();
});

candidateModel.addInstanceMethod("comparePassword", async function (candidatePassword) {
  if (!this.credentials.passwordHash) {
    const candidate = await this.constructor
      .findById(this._id)
      .select("+credentials.passwordHash");
    this.credentials.passwordHash = candidate.credentials.passwordHash;
  }
  return await bcrypt.compare(candidatePassword, this.credentials.passwordHash);
});

// Static Methods

candidateModel.addStaticMethod("findByEvent", async function (eventId, filters = {}) {
  return await this.find({
    event: eventId,
    ...filters,
    deleted: false,
  }).populate("categories");
});

candidateModel.addStaticMethod("findByCategory", async function (categoryId) {
  return await this.find({
    categories: categoryId,
    status: "active",
    deleted: false,
  });
});

candidateModel.addStaticMethod("getLeaderboard", async function (eventId, categoryId = null) {
  const query = {
    event: eventId,
    status: "active",
    deleted: false,
  };

  if (categoryId) {
    query.categories = categoryId;
  }

  return await this.find(query)
    .sort({ "voting.totalVotes": -1, "voting.lastVoteAt": 1 })
    .populate("categories", "name");
});

candidateModel.addStaticMethod("searchCandidates", async function (query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    deleted: false,
  };

  if (filters.event) searchQuery.event = filters.event;
  if (filters.status) searchQuery.status = filters.status;
  if (filters.category) searchQuery.categories = filters.category;

  return await this.find(searchQuery)
    .sort({ score: { $meta: "textScore" } })
    .populate("event categories");
});

// Middleware

// Hash password before saving
candidateModel.addPreHook("save", async function (next) {
  if (!this.isModified("credentials.passwordHash") || !this.credentials.passwordHash) {
    return next();
  }

  try {
    const saltRounds = config.get("security.saltRounds", 10);
    this.credentials.passwordHash = await bcrypt.hash(this.credentials.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Create and export model
const Candidate = candidateModel.getModel("Candidate");

export default Candidate;
