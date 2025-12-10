#!/usr/bin/env node
/**
 * Vote bundle class for the application
 * 
 * */
import BaseModel from "./BaseModel.js";
import mongoose from "mongoose";

class VoteBundle extends BaseModel {

    constructor(){
       const schemaDefinition =  {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true,
            trim: true
        },
        votes: {
            type: Number,
            required: true
        },
        applicableCoupons: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Coupon',
            default: []
        },
        popular: {
            type: Boolean,
            default: true
        },
        price: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            required: true,
            default: "GHS"
        },
        isActive: {
            type: Boolean,
            default: true
        },
        features:{
            type: [String],
            required: true,
            default: []
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        applicableEvents: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Event',
            required: true
        },
        applicableCategories: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'Category',
            required: true
        },
       }
         super(schemaDefinition, {collection: 'voteBundles'});
    }
    getSchema() {
        const schema = super.getSchema();

        schema.index({name: 1});
        schema.index({popular: 1});
        schema.index({price: 1});

        return schema;
    }
}

export default mongoose.model('VoteBundle', new VoteBundle().getSchema());