#!/usr/bin/env node
/**
 * Enhanced Notification Model for ITFY E-Voting System
 *
 * @module Notification
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const NotificationSchema = {
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  type: {
    type: String,
    enum: ["email", "sms", "push", "system"],
    required: true,
  },

  title: {
    type: String,
    required: true,
  },

  message: {
    type: String,
    required: true,
  },

  data: mongoose.Schema.Types.Mixed,

  status: {
    type: String,
    enum: ["pending", "sent", "failed", "read"],
    default: "pending",
  },

  read: {
    type: Boolean,
    default: false,
  },

  readAt: Date,

  sentAt: Date,

  priority: {
    type: String,
    enum: ["low", "normal", "high", "urgent"],
    default: "normal",
  },
};

const notificationModel = new BaseModel(NotificationSchema, {
  collection: "notifications",
  timestamps: true,
});

notificationModel.addCompoundIndex([{ recipient: 1 }, { read: 1 }, { createdAt: -1 }]);
notificationModel.addIndex({ status: 1, createdAt: -1 });

const Notification = notificationModel.getModel("Notification");

export default Notification;
