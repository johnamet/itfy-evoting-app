#!/usr/bin/env node
/**
 * Enhanced Event Model for ITFY E-Voting System
 *
 * @module Event
 * @version 2.0.0
 */

import mongoose from "mongoose";
import validator from "validator";
import BaseModel from "./BaseModel.js";

const EventSchema = {
  // Basic Info
  name: {
    type: String,
    required: [true, "Event name is required"],
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  // Event Type
  type: {
    type: String,
    enum: ["physical", "online", "hybrid"],
    default: "physical",
  },

  // Event Status
  status: {
    type: String,
    enum: ["draft", "published", "active", "paused", "completed", "cancelled"],
    default: "draft",
  },

  // Visibility
  visibility: {
    type: String,
    enum: ["public", "private", "unlisted"],
    default: "public",
  },

  // Dates
  startDate: {
    type: Date,
    required: [true, "Start date is required"],
  },

  endDate: {
    type: Date,
    required: [true, "End date is required"],
    validate: {
      validator: function (v) {
        return v > this.startDate;
      },
      message: "End date must be after start date",
    },
  },

  // Location
  location: {
    venue: String,
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
    online: {
      platform: String,
      url: {
        type: String,
        validate: {
          validator: (v) => !v || validator.isURL(v),
          message: "Invalid URL",
        },
      },
    },
  },

  // Settings
  settings: {
    voting: {
      allowAnonymous: {
        type: Boolean,
        default: false,
      },
      requirePayment: {
        type: Boolean,
        default: true,
      },
      maxVotesPerUser: {
        type: Number,
        default: null,
      },
    },
    registration: {
      required: {
        type: Boolean,
        default: false,
      },
      deadline: Date,
      capacity: Number,
      waitlist: {
        type: Boolean,
        default: false,
      },
    },
    results: {
      showLive: {
        type: Boolean,
        default: false,
      },
      showAfterEvent: {
        type: Boolean,
        default: true,
      },
      publishDate: Date,
    },
  },

  // Metrics
  metrics: {
    totalVotes: {
      type: Number,
      default: 0,
    },
    uniqueVoters: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    registrations: {
      type: Number,
      default: 0,
    },
  },

  // Media
  media: {
    coverImage: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Invalid cover image URL",
      },
    },
    gallery: [
      {
        type: String,
        validate: {
          validator: validator.isURL,
          message: "Invalid gallery image URL",
        },
      },
    ],
    videos: [
      {
        type: String,
        validate: {
          validator: validator.isURL,
          message: "Invalid video URL",
        },
      },
    ],
  },

  // SEO
  seo: {
    title: String,
    description: String,
    keywords: [String],
    ogImage: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Invalid OG image URL",
      },
    },
  },

  // Organizer
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Organizer is required"],
  },
};

// Create Event model using BaseModel
const eventModel = new BaseModel(EventSchema, {
  collection: "events",
  timestamps: true,
});

// Add Indexes
eventModel.addCompoundIndex([{ status: 1 }, { startDate: -1 }]);
eventModel.addCompoundIndex([{ visibility: 1 }, { status: 1 }]);
eventModel.addCompoundIndex([{ organizer: 1 }, { status: 1 }]);
eventModel.addTextIndex({ name: "text", description: "text" });
eventModel.addIndex({ "location.coordinates": "2dsphere" });
eventModel.addIndex({ startDate: 1, endDate: 1 });

// Virtuals

eventModel.addVirtual("isActive", function () {
  const now = new Date();
  return (
    this.status === "active" &&
    this.startDate <= now &&
    this.endDate >= now
  );
});

eventModel.addVirtual("isUpcoming", function () {
  return this.startDate > new Date();
});

eventModel.addVirtual("isPast", function () {
  return this.endDate < new Date();
});

eventModel.addVirtual("daysUntilStart", function () {
  const now = new Date();
  const diff = this.startDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

eventModel.addVirtual("duration", function () {
  const diff = this.endDate - this.startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)); // in days
});

eventModel.addVirtual("registrationOpen", function () {
  if (!this.settings.registration.required) return false;
  if (!this.settings.registration.deadline) return true;
  return new Date() < this.settings.registration.deadline;
});

// Instance Methods

eventModel.addInstanceMethod("publish", async function () {
  this.status = "published";
  return await this.save();
});

eventModel.addInstanceMethod("start", async function () {
  this.status = "active";
  return await this.save();
});

eventModel.addInstanceMethod("pause", async function () {
  this.status = "paused";
  return await this.save();
});

eventModel.addInstanceMethod("complete", async function () {
  this.status = "completed";
  return await this.save();
});

eventModel.addInstanceMethod("cancel", async function (reason = null) {
  this.status = "cancelled";
  if (reason) {
    this.metadata = this.metadata || {};
    this.metadata.cancellationReason = reason;
  }
  return await this.save();
});

eventModel.addInstanceMethod("updateMetrics", async function () {
  const Vote = mongoose.model("Vote");
  const Payment = mongoose.model("Payment");

  const [votes, payments] = await Promise.all([
    Vote.aggregate([
      { $match: { event: this._id, status: "valid" } },
      {
        $group: {
          _id: null,
          totalVotes: { $sum: 1 },
          uniqueVoters: { $addToSet: "$voter.email" },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { event: this._id, status: "success" } },
      { $group: { _id: null, revenue: { $sum: "$amounts.total" } } },
    ]),
  ]);

  if (votes.length > 0) {
    this.metrics.totalVotes = votes[0].totalVotes;
    this.metrics.uniqueVoters = votes[0].uniqueVoters.length;
  }

  if (payments.length > 0) {
    this.metrics.revenue = payments[0].revenue;
  }

  return await this.save();
});

// Static Methods

eventModel.addStaticMethod("findActive", async function () {
  const now = new Date();
  return await this.find({
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
    deleted: false,
  });
});

eventModel.addStaticMethod("findUpcoming", async function (days = 30) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return await this.find({
    startDate: { $gte: now, $lte: futureDate },
    status: { $in: ["published", "active"] },
    deleted: false,
  }).sort({ startDate: 1 });
});

eventModel.addStaticMethod("findByLocation", async function (coordinates, radius = 5000) {
  return await this.find({
    "location.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: coordinates,
        },
        $maxDistance: radius,
      },
    },
    deleted: false,
  });
});

eventModel.addStaticMethod("searchEvents", async function (query, filters = {}) {
  const searchQuery = {
    $text: { $search: query },
    deleted: false,
  };

  if (filters.status) searchQuery.status = filters.status;
  if (filters.type) searchQuery.type = filters.type;
  if (filters.visibility) searchQuery.visibility = filters.visibility;

  return await this.find(searchQuery)
    .sort({ score: { $meta: "textScore" } })
    .populate("organizer", "profile.name email");
});

eventModel.addStaticMethod("getEventStats", async function (eventId) {
  const event = await this.findById(eventId);
  if (!event) throw new Error("Event not found");

  await event.updateMetrics();
  return event.metrics;
});

// Middleware

// Auto-activate event when start date is reached
eventModel.addPreHook("save", function (next) {
  const now = new Date();

  if (this.status === "published" && this.startDate <= now && this.endDate >= now) {
    this.status = "active";
  }

  if (this.status === "active" && this.endDate < now) {
    this.status = "completed";
  }

  next();
});

// Create and export model
const Event = eventModel.getModel("Event");

export default Event;
