#!/usr/bin/env node
/**
 * Analytics Model for tracking metrics
 *
 * @module Analytics
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const AnalyticsSchema = {
  // Time period
  timestamp: {
    type: Date,
    required: true,
    index: true,
  },

  period: {
    type: String,
    enum: ["hour", "day", "week", "month"],
    required: true,
  },

  // Scope
  scope: {
    type: {
      type: String,
      enum: ["global", "event", "category", "candidate"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "scope.type",
    },
  },

  // Metrics
  metrics: {
    votes: {
      total: { type: Number, default: 0 },
      unique: { type: Number, default: 0 },
      weighted: { type: Number, default: 0 },
    },
    revenue: {
      total: { type: Number, default: 0 },
      average: { type: Number, default: 0 },
      currency: { type: String, default: "GHS" },
    },
    engagement: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
    },
    performance: {
      responseTime: { type: Number, default: 0 },
      errorRate: { type: Number, default: 0 },
    },
  },

  // Computed
  computed: {
    growthRate: Number,
    trend: {
      type: String,
      enum: ["up", "down", "stable"],
    },
    forecast: Number,
  },
};

const analyticsModel = new BaseModel(AnalyticsSchema, {
  collection: "analytics",
  timestamps: true,
});

analyticsModel.addCompoundIndex([
  { timestamp: -1 },
  { "scope.type": 1 },
  { "scope.entityId": 1 },
]);
analyticsModel.addCompoundIndex([{ period: 1 }, { timestamp: -1 }]);

// TTL index - expire after 1 year
analyticsModel.addIndex({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const Analytics = analyticsModel.getModel("Analytics");

export default Analytics;
