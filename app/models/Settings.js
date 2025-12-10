#!/usr/bin/env node
/**
 * Settings Model
 *
 * @module Settings
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const SettingsSchema = {
  key: {
    type: String,
    required: true,
    unique: true,
  },

  value: mongoose.Schema.Types.Mixed,

  type: {
    type: String,
    enum: ["string", "number", "boolean", "object", "array"],
    required: true,
  },

  category: {
    type: String,
    default: "general",
  },

  description: String,

  isPublic: {
    type: Boolean,
    default: false,
  },
};

const settingsModel = new BaseModel(SettingsSchema, {
  collection: "settings",
  timestamps: true,
});

settingsModel.addUniqueIndex({ key: 1 });
settingsModel.addIndex({ category: 1 });

const Settings = settingsModel.getModel("Settings");

export default Settings;
