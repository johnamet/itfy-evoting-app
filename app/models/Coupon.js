#!/usr/bin/env node
/**
 * The Coupon model for the application
 * 
 **/
import BaseModel from "./BaseModel";
import mongoose from "mongoose";

class Coupon extends BaseModel {

    constructor() {

        const schemaDefinition = {
            code: {
                type: String,
                required: true,
                trim: true
            },
            discount: {
                type: Number,
                required: true,
                validate: {
                    validator: function(v){
                        return v > 0
                    }
                }
            },
            discountType:{
                type: String,
                required: true,
                default: "percentage"
            },
            expiryDate: {
                type: Date,
                required: true
            },
            isActive: {
                type: Boolean,
                default: true
            },
            eventApplicable:{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Event',
                required: true
            },

            categoriesApplicable: {
                type: [mongoose.Schema.Types.ObjectId],
                ref: 'Category',
                required: true
            },
            maxUse: {
                type: Number,
                default: 1,
                validate: {
                    validator: function(v){
                        return v > 0
                    }
                }
            },
            useCount: {
                type: Number,
                default: 0,
                validate: {
                    validator: function(v){
                        return v >= 0
                    }
                }
            },
            minOrderAmount: {
                type: Number,
                default: 0,
                validate: {
                    validator: function(v){
                        return v >= 0
                    }
                }
            }
        };

        super(schemaDefinition, {collection: "coupons"});
    }

    getSchema(){
        const schema = super.getSchema()
        schema.index({name: 'text'})
        schema.index({ eventApplicable: 1, categoriesApplicable: 1})
        schema.index({ isActive: 1})
        schema.index({ expiryDate: 1})

        return schema
    }
}

export default mongoose.model('Coupon', new Coupon().getSchema());
