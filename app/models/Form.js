#!/usr/bin/env node
/**
 * Form Model for dynamic forms
 *
 * @module Form
 * @version 2.0.0
 */

import mongoose from "mongoose";
import BaseModel from "./BaseModel.js";

const FormSchema = {
  name: {
    type: String,
    required: true,
  },

  description: String,

  fields: [
    {
      name: String,
      label: String,
      type: {
        type: String,
        enum: ["text", "email", "number", "textarea", "select", "checkbox", "radio", "date"],
      },
      required: Boolean,
      options: [String],
      validation: mongoose.Schema.Types.Mixed,
      order: Number,
    },
  ],

  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },

  status: {
    type: String,
    enum: ["draft", "active", "inactive"],
    default: "draft",
  },

  submissions: {
    type: Number,
    default: 0,
  },
};

const formModel = new BaseModel(FormSchema, {
  collection: "forms",
  timestamps: true,
});

formModel.addIndex({ event: 1, status: 1 });
formModel.addIndex({ status: 1 });

const Form = formModel.getModel("Form");

export default Form;
