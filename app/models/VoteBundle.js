#!/usr/bin/env node
/**
 * Vote bundle class for the application
 * 
 * */
import BaseModel from "./BaseModel";
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
        coupon: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Coupon', 
        },
        popular: {
            type: Boolean,
            default: true
        },
        price: {
            type: Number,
            required: true,
        },
        features:{
            type: [String],
            required: true,
            default: []
        }
       }
    }
}

export default mongoose.model('VoteBundle', new VoteBundle().getSchema());