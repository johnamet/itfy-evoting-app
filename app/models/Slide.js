#!/usr/bin/env node
/**
 * Slide Model for carousel/slideshow content
 *
 * @module Slide
 * @version 2.0.0
 */

import mongoose from "mongoose";
import validator from "validator";
import BaseModel from "./BaseModel.js";

const SlideSchema = {
  title: {
    type: String,
    required: true,
  },

  description: String,

  image: {
    type: String,
    required: true,
    validate: {
      validator: validator.isURL,
      message: "Invalid image URL",
    },
  },

  link: {
    type: String,
    validate: {
      validator: (v) => !v || validator.isURL(v),
      message: "Invalid link URL",
    },
  },

  order: {
    type: Number,
    default: 0,
  },

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
};

const slideModel = new BaseModel(SlideSchema, {
  collection: "slides",
  timestamps: true,
});

slideModel.addIndex({ order: 1 });
slideModel.addIndex({ status: 1, order: 1 });

const Slide = slideModel.getModel("Slide");

export default Slide;
