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
import BaseModel from "./BaseModel.js";
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
      minlength: [100, "Bio must be at least 100 characters for profile completion"],
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
    // New fields for awards system
    skills: {
      type: [String],
      validate: {
        validator: (v) => !v || v.length >= 3,
        message: "At least 3 skills are required for profile completion",
      },
    },
    projects: [
      {
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
          maxlength: [500, "Project description cannot exceed 500 characters"],
        },
        url: {
          type: String,
          validate: {
            validator: (v) => !v || validator.isURL(v),
            message: "Invalid project URL",
          },
        },
        images: [String],
        technologies: [String],
        completedDate: Date,
      },
    ],
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => !v || validator.isEmail(v),
        message: "Invalid contact email format",
      },
    },
    demoVideoUrl: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Invalid demo video URL",
      },
    },
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

  // Profile Completion Tracking
  profileCompletion: {
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedFields: [String],
    missingFields: [String],
    lastUpdated: Date,
  },

  profileCompletedAt: Date,
  
  profileStatus: {
    type: String,
    enum: ["incomplete", "complete", "under_review"],
    default: "incomplete",
  },

  // Verification & Acceptance (for nomination flow)
  verification: {
    token: String,
    sentAt: Date,
    expiresAt: Date,
    verifiedAt: Date,
    acceptedTerms: {
      type: Boolean,
      default: false,
    },
    ipAddress: String,
    userAgent: String,
  },

  // Nomination tracking
  nominationForm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Nomination",
  },

  nominatedCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],

  acceptedCategories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
  ],

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
    enum: [
      "draft",                  // Initial state for self-created profiles
      "awaiting_verification",  // Nomination approved, awaiting email verification
      "verified",              // Email verified, can set password
      "profile_incomplete",    // Email verified but profile not complete
      "profile_complete",      // Profile complete, awaiting admin activation
      "pending_approval",      // Admin review pending (legacy)
      "approved",             // Admin approved (legacy, use active)
      "active",               // Active and can receive votes
      "declined",             // Nominee declined nomination
      "expired",              // Verification deadline passed
      "rejected",             // Admin rejected
      "disqualified",         // Disqualified after being active
      "suspended"             // Temporarily suspended
    ],
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

// New instance methods for nomination workflow

candidateModel.addInstanceMethod("verifyEmail", async function () {
  this.credentials.emailVerified = true;
  this.verification = this.verification || {};
  this.verification.verifiedAt = new Date();
  this.status = "verified";
  return await this.save();
});

candidateModel.addInstanceMethod("declineNomination", async function () {
  this.status = "declined";
  return await this.save();
});

candidateModel.addInstanceMethod("markAsExpired", async function () {
  this.status = "expired";
  return await this.save();
});

candidateModel.addInstanceMethod("suspend", async function (reason) {
  this.status = "suspended";
  this.metadata = this.metadata || {};
  this.metadata.disqualificationReason = reason; // Reuse field for suspension reason
  return await this.save();
});

candidateModel.addInstanceMethod("calculateProfileCompletion", function () {
  const requiredFields = {
    bio: this.profile?.bio && this.profile.bio.length >= 100,
    skills: this.profile?.skills && this.profile.skills.length >= 3,
    projects: this.profile?.projects && this.profile.projects.length >= 1,
    photo: this.media?.photo,
    contactEmail: this.profile?.contactEmail,
  };

  const completed = Object.keys(requiredFields).filter(field => requiredFields[field]);
  const missing = Object.keys(requiredFields).filter(field => !requiredFields[field]);
  const percentage = Math.round((completed.length / Object.keys(requiredFields).length) * 100);

  this.profileCompletion = {
    percentage,
    completedFields: completed,
    missingFields: missing,
    lastUpdated: new Date(),
  };

  // Update profile status based on completion
  if (percentage === 100) {
    this.profileStatus = "complete";
    this.credentials.profileCompleted = true;
    this.profileCompletedAt = this.profileCompletedAt || new Date();
    
    // Update status if currently profile_incomplete
    if (this.status === "profile_incomplete") {
      this.status = "profile_complete";
    }
  } else {
    this.profileStatus = "incomplete";
    this.credentials.profileCompleted = false;
    
    // Update status if currently verified or profile_complete
    if (["verified", "profile_complete"].includes(this.status)) {
      this.status = "profile_incomplete";
    }
  }

  return this.profileCompletion;
});

candidateModel.addInstanceMethod("acceptNomination", async function (categoryIds, ipAddress, userAgent) {
  this.acceptedCategories = categoryIds;
  this.verification = this.verification || {};
  this.verification.acceptedTerms = true;
  this.verification.ipAddress = ipAddress;
  this.verification.userAgent = userAgent;
  
  // Calculate initial profile completion
  this.calculateProfileCompletion();
  
  return await this.save();
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

// Auto-calculate profile completion before saving
candidateModel.addPreHook("save", function (next) {
  // Only calculate if profile fields have been modified
  const profileFields = ['profile', 'media'];
  const hasProfileChanges = profileFields.some(field => this.isModified(field));
  
  if (hasProfileChanges && ["verified", "profile_incomplete", "profile_complete"].includes(this.status)) {
    this.calculateProfileCompletion();
  }
  
  next();
});

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
