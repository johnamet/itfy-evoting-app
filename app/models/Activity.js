#!/usr/bin/env node
/**
 * Activity Model for tracking user actions
 *
 * @module Activity
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const ActivitySchema = {
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  action: {
    type: String,
    required: true,
  },

  resource: {
    type: String,
    required: true,
  },

  resourceId: mongoose.Schema.Types.ObjectId,

  description: String,

  metadata: mongoose.Schema.Types.Mixed,

  ipAddress: String,

  userAgent: String,
};

const activityModel = new BaseModel(ActivitySchema, {
  collection: "activities",
  timestamps: true,
});

activityModel.addCompoundIndex([{ user: 1 }, { createdAt: -1 }]);
activityModel.addCompoundIndex([{ resource: 1 }, { resourceId: 1 }]);
activityModel.addIndex({ action: 1, createdAt: -1 });

const Activity = activityModel.getModel("Activity");

export default Activity;
