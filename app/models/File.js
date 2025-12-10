#!/usr/bin/env node
/**
 * File Model for file uploads
 *
 * @module File
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const FileSchema = {
  filename: {
    type: String,
    required: true,
  },

  originalName: {
    type: String,
    required: true,
  },

  path: {
    type: String,
    required: true,
  },

  url: String,

  mimetype: {
    type: String,
    required: true,
  },

  size: {
    type: Number,
    required: true,
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  category: {
    type: String,
    enum: ["image", "document", "video", "audio", "other"],
    default: "other",
  },

  relatedTo: {
    model: String,
    id: mongoose.Schema.Types.ObjectId,
  },
};

const fileModel = new BaseModel(FileSchema, {
  collection: "files",
  timestamps: true,
});

fileModel.addIndex({ uploadedBy: 1, createdAt: -1 });
fileModel.addIndex({ category: 1 });
fileModel.addCompoundIndex([{ "relatedTo.model": 1 }, { "relatedTo.id": 1 }]);

const File = fileModel.getModel("File");

export default File;
