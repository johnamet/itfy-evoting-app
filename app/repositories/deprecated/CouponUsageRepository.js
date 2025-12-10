#!/usr/bin/env node
/**
 * CouponUsage Repository
 * 
 * Extends BaseRepository to provide CouponUsage-specific database operations.
 * Handles tracking and analytics for coupon usage.
 */

import BaseRepository from './BaseRepository.js';
import CouponUsage from '../models/CouponUsage.js';
import mongoose from 'mongoose';

class CouponUsageRepository extends BaseRepository {
    
    constructor() {
        super(CouponUsage);
    }

    /**
     * Record a coupon usage
     * @param {Object} usageData - Usage data
     * @returns {Promise<Object>} Created usage record
     */
    async recordUsage(usageData) {
        try {
            return await this.create(usageData);
        } catch (error) {
            throw this._handleError(error, 'recordUsage');
        }
    }

    /**
     * Get usage count for a specific coupon
     * @param {String|ObjectId} couponId - Coupon ID
     * @returns {Promise<Number>} Usage count
     */
    async getCouponUsageCount(couponId) {
        try {
            const count = await this.countDocuments({
                coupon: new mongoose.Types.ObjectId(couponId),
            });
            return count;
        } catch (error) {
            throw this._handleError(error, 'getUserUsageCount');
        }
    }

    /**
     * Get detailed statistics for a coupon
     * @param {String|ObjectId} couponId - Coupon ID
     * @returns {Promise<Object>} Usage statistics
     */
    async getCouponUsageStats(couponId) {
        try {
            const pipeline = [
                { $match: { coupon: new mongoose.Types.ObjectId(couponId) } },
                {
                    $group: {
                        _id: null,
                        totalUsages: { $sum: 1 },
                        totalDiscountGiven: { $sum: '$discountAmount' },
                        avgDiscountPerUse: { $avg: '$discountAmount' },
                        totalOrderAmount: { $sum: '$orderAmount' },
                        avgOrderAmount: { $avg: '$orderAmount' },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalUsages: 1,
                        totalDiscountGiven: { $round: ['$totalDiscountGiven', 2] },
                        avgDiscountPerUse: { $round: ['$avgDiscountPerUse', 2] },
                        totalOrderAmount: { $round: ['$totalOrderAmount', 2] },
                        avgOrderAmount: { $round: ['$avgOrderAmount', 2] },
                    }
                }
            ];

            const result = await this.aggregate(pipeline);
            return result[0] || {
                totalUsages: 0,
                totalDiscountGiven: 0,
                avgDiscountPerUse: 0,
                totalOrderAmount: 0,
                avgOrderAmount: 0,
            };
        } catch (error) {
            throw this._handleError(error, 'getCouponUsageStats');
        }
    }

    /**
     * Get usage history for a coupon
     * @param {String|ObjectId} couponId - Coupon ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Usage history
     */
    async getCouponUsageHistory(couponId, options = {}) {
        try {
            const criteria = { coupon: new mongoose.Types.ObjectId(couponId) };
            
            return await this.find(criteria, {
                ...options,
                sort: { usageDate: -1 },
                populate: [
                    { path: 'user', select: 'name email' },
                    { path: 'event', select: 'name' },
                    { path: 'categories', select: 'name' }
                ]
            });
        } catch (error) {
            throw this._handleError(error, 'getCouponUsageHistory');
        }
    }

    /**
     * Get usage statistics by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} Date range statistics
     */
    async getUsageStatsByDateRange(startDate, endDate) {
        try {
            const pipeline = [
                {
                    $match: {
                        usageDate: {
                            $gte: new Date(startDate),
                            $lte: new Date(endDate)
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$usageDate" }
                        },
                        dailyUsages: { $sum: 1 },
                        dailyDiscountTotal: { $sum: '$discountAmount' },
                        dailyOrderTotal: { $sum: '$orderAmount' }
                    }
                },
                {
                    $sort: { _id: 1 }
                },
                {
                    $project: {
                        date: '$_id',
                        _id: 0,
                        dailyUsages: 1,
                        dailyDiscountTotal: { $round: ['$dailyDiscountTotal', 2] },
                        dailyOrderTotal: { $round: ['$dailyOrderTotal', 2] }
                    }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getUsageStatsByDateRange');
        }
    }

    /**
     * Get top performing coupons
     * @param {Number} limit - Number of top coupons to return
     * @returns {Promise<Array>} Top performing coupons
     */
    async getTopPerformingCoupons(limit = 10) {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: '$coupon',
                        totalUsages: { $sum: 1 },
                        totalDiscountGiven: { $sum: '$discountAmount' },
                        totalOrderAmount: { $sum: '$orderAmount' },
                    }
                },
                {
                    $project: {
                        couponId: '$_id',
                        _id: 0,
                        totalUsages: 1,
                        totalDiscountGiven: { $round: ['$totalDiscountGiven', 2] },
                        totalOrderAmount: { $round: ['$totalOrderAmount', 2] },
                    }
                },
                {
                    $sort: { totalUsages: -1 }
                },
                {
                    $limit: limit
                }
            ];

            const results = await this.aggregate(pipeline);
            
            // Populate coupon details
            return await CouponUsage.populate(results, {
                path: 'couponId',
                select: 'code discountType discountValue'
            });
        } catch (error) {
            throw this._handleError(error, 'getTopPerformingCoupons');
        }
    }
}

export default CouponUsageRepository;
