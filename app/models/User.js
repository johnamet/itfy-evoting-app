#!/usr/bin/env node
/**
 * Enhanced User Model for ITFY E-Voting System
 *
 * @module User
 * @version 2.0.0
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import BaseModel from "./deprecated/BaseModel2.js";
import config from "../config/ConfigManager.js";

const UserSchema = {
  // Basic Info
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: validator.isEmail,
      message: "Invalid email format",
    },
  },

  passwordHash: {
    type: String,
    required: [true, "Password is required"],
    select: false, // Don't include in queries by default
  },

  // Profile Information
  profile: {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    image: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Invalid image URL",
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || validator.isMobilePhone(v, "any");
        },
        message: "Invalid phone number",
      },
    },
    location: {
      address: String,
      city: String,
      country: String,
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
        },
      },
    },
  },

  // Role Reference
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: [true, "Role is required"],
  },

  // Legacy level field (for backward compatibility)
  level: {
    type: Number,
    min: 1,
    max: 4,
    default: 1,
  },

  // Security Settings
  security: {
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
    passwordChangedAt: {
      type: Date,
    },
  },

  // User Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    theme: {
      type: String,
      enum: ["light", "dark", "auto"],
      default: "auto",
    },
    language: {
      type: String,
      default: "en",
    },
  },

  // Account Status
  status: {
    type: String,
    enum: ["active", "inactive", "suspended", "locked"],
    default: "active",
  },

  // Email Verification
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },

  // Password Reset
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
};

// Create User model using BaseModel
const userModel = new BaseModel(UserSchema, {
  collection: "users",
  timestamps: true,
});

// Add Indexes
userModel.addCompoundIndex([{ email: 1 }, { status: 1 }]);
userModel.addCompoundIndex([{ role: 1 }, { status: 1 }, { createdAt: -1 }]);
userModel.addTextIndex({ "profile.name": "text", email: "text" });
userModel.addIndex({ "profile.location.coordinates": "2dsphere" });
userModel.addIndex({ "security.lastLogin": -1 });

// Virtuals
userModel.addVirtual("isLocked", function () {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

userModel.addVirtual("isOnline", function () {
  if (!this.security.lastLogin) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return this.security.lastLogin.getTime() > fiveMinutesAgo;
});

// Instance Methods

/**
 * Compare password with hash
 */
userModel.addInstanceMethod("comparePassword", async function (candidatePassword) {
  if (!this.passwordHash) {
    // Load passwordHash if not selected
    const user = await this.constructor.findById(this._id).select("+passwordHash");
    this.passwordHash = user.passwordHash;
  }
  return await bcrypt.compare(candidatePassword, this.passwordHash);
});

/**
 * Generate auth token (to be implemented in service layer)
 */
userModel.addInstanceMethod("generateAuthToken", function () {
  // This will be implemented in AuthService
  return null;
});

/**
 * Record login
 */
userModel.addInstanceMethod("recordLogin", async function (ip, location = null) {
  this.security.lastLogin = new Date();
  this.security.lastLoginIp = ip;
  this.security.loginAttempts = 0;
  if (this.security.lockUntil) {
    this.security.lockUntil = undefined;
  }
  return await this.save();
});

/**
 * Increment login attempts
 */
userModel.addInstanceMethod("incrementLoginAttempts", async function () {
  // Reset attempts if lock has expired
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { "security.loginAttempts": 1 },
      $unset: { "security.lockUntil": 1 },
    });
  }

  const maxAttempts = config.get("security.maxLoginAttempts", 5);
  const lockTime = config.get("security.lockTime", 2 * 60 * 60 * 1000); // 2 hours

  const updates = { $inc: { "security.loginAttempts": 1 } };

  // Lock account after max attempts
  if (this.security.loginAttempts + 1 >= maxAttempts) {
    updates.$set = {
      "security.lockUntil": new Date(Date.now() + lockTime),
      status: "locked",
    };
  }

  return await this.updateOne(updates);
});

/**
 * Reset login attempts
 */
userModel.addInstanceMethod("resetLoginAttempts", async function () {
  return await this.updateOne({
    $set: { "security.loginAttempts": 0 },
    $unset: { "security.lockUntil": 1 },
  });
});

/**
 * Lock account
 */
userModel.addInstanceMethod("lockAccount", async function (reason = null) {
  this.status = "locked";
  if (reason) {
    this.metadata = this.metadata || {};
    this.metadata.lockReason = reason;
  }
  return await this.save();
});

/**
 * Unlock account
 */
userModel.addInstanceMethod("unlockAccount", async function () {
  this.status = "active";
  this.security.loginAttempts = 0;
  this.security.lockUntil = undefined;
  return await this.save();
});

// Static Methods

/**
 * Find by email
 */
userModel.addStaticMethod("findByEmail", async function (email) {
  return await this.findOne({ email: email.toLowerCase(), deleted: false });
});

/**
 * Find active users
 */
userModel.addStaticMethod("findActiveUsers", async function (filters = {}) {
  return await this.find({
    ...filters,
    status: "active",
    deleted: false,
  });
});

/**
 * Search users
 */
userModel.addStaticMethod("searchUsers", async function (query, options = {}) {
  const { page = 1, limit = 10, role = null, status = null } = options;

  const searchQuery = {
    $text: { $search: query },
    deleted: false,
  };

  if (role) searchQuery.role = role;
  if (status) searchQuery.status = status;

  return await this.paginate(searchQuery, {
    page,
    limit,
    sort: { score: { $meta: "textScore" } },
    populate: "role",
  });
});

/**
 * Get user statistics
 */
userModel.addStaticMethod("getUserStats", async function () {
  const [total, byStatus, byRole] = await Promise.all([
    this.countDocuments({ deleted: false }),
    this.aggregate([
      { $match: { deleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    this.aggregate([
      { $match: { deleted: false } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $lookup: { from: "roles", localField: "_id", foreignField: "_id", as: "roleInfo" } },
    ]),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    byRole,
  };
});

/**
 * Find users by location
 */
userModel.addStaticMethod("findByLocation", async function (coordinates, maxDistance = 5000) {
  return await this.find({
    "profile.location.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates, // [longitude, latitude]
        },
        $maxDistance: maxDistance, // in meters
      },
    },
    deleted: false,
  });
});

// Middleware

// Hash password before saving
userModel.addPreHook("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();

  try {
    const saltRounds = config.get("security.saltRounds", 10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    this.security.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Validate role exists before saving
userModel.addPreHook("save", async function (next) {
  if (!this.isModified("role")) return next();

  try {
    const Role = mongoose.model("Role");
    const role = await Role.findById(this.role);
    if (!role) {
      return next(new Error("Invalid role specified"));
    }
    // Sync level with role level
    this.level = role.level;
    next();
  } catch (error) {
    next(error);
  }
});

// Remove sensitive data from JSON responses
userModel.addPostHook("save", function (doc) {
  if (doc.passwordHash) delete doc.passwordHash;
  if (doc.security?.twoFactorSecret) delete doc.security.twoFactorSecret;
  if (doc.emailVerificationToken) delete doc.emailVerificationToken;
  if (doc.passwordResetToken) delete doc.passwordResetToken;
});

// Create and export model
const User = userModel.getModel("User");

export default User;
