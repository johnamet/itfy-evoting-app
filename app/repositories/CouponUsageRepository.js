import BaseRepository from '../BaseRepository.js';
import CouponUsage from '../../models/CouponUsage.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

/**
 * CouponUsageRepository
 * 
 * Tracks coupon usage history with intelligent caching. Usage records are cached with a 30-minute TTL
 * for analytics and audit purposes.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - User-specific and coupon-specific queries skip cache for accurate tracking
 * - Creation of usage records invalidates related query caches
 * 
 * @extends BaseRepository
 */
class CouponUsageRepository extends BaseRepository {
    constructor() {
        super(CouponUsage, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 1800 // 30 minutes
        });
    }

    /**
     * Record coupon usage
     * 
     * @param {Object} usageData - Usage data
     * @param {string} usageData.coupon - Coupon ID
     * @param {string} usageData.user - User ID
     * @param {string} usageData.payment - Payment ID (if applicable)
     * @param {number} usageData.originalAmount - Original amount before discount
     * @param {number} usageData.discountAmount - Discount amount applied
     * @param {number} usageData.finalAmount - Final amount after discount
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created usage record
     */
    async recordUsage(usageData, options = {}) {
        this._validateRequiredFields(usageData, [
            'coupon',
            'user',
            'originalAmount',
            'discountAmount',
            'finalAmount'
        ]);

        // Validate amounts
        if (usageData.discountAmount > usageData.originalAmount) {
            throw new Error('Discount amount cannot exceed original amount');
        }

        if (usageData.finalAmount !== usageData.originalAmount - usageData.discountAmount) {
            throw new Error('Final amount must equal original amount minus discount');
        }

        const usageToCreate = {
            ...usageData,
            usedAt: new Date()
        };

        return await this.create(usageToCreate, options);
    }

    /**
     * Find usage records by coupon
     * Skip cache for accurate usage tracking
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Usage records
     */
    async findByCoupon(couponId, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        return await this.find(
            { coupon: couponId },
            {
                ...options,
                skipCache: true,
                sort: options.sort || { usedAt: -1 }
            }
        );
    }

    /**
     * Find usage records by user
     * Skip cache for accurate user history
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Usage records
     */
    async findByUser(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.find(
            { user: userId },
            {
                ...options,
                skipCache: true,
                sort: options.sort || { usedAt: -1 }
            }
        );
    }

    /**
     * Check if user has used a specific coupon
     * Always skip cache for accurate validation
     * 
     * @param {string} couponId - Coupon ID
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if user has used the coupon
     */
    async hasUserUsedCoupon(couponId, userId) {
        if (!couponId || !userId) {
            throw new Error('Coupon ID and User ID are required');
        }

        const usage = await this.findOne(
            { coupon: couponId, user: userId },
            { skipCache: true }
        );

        return usage !== null;
    }

    /**
     * Count usage by coupon
     * 
     * @param {string} couponId - Coupon ID
     * @returns {Promise<number>} Usage count
     */
    async countByCoupon(couponId) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        return await this.count({ coupon: couponId });
    }

    /**
     * Count usage by user
     * 
     * @param {string} userId - User ID
     * @returns {Promise<number>} Usage count
     */
    async countByUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        return await this.count({ user: userId });
    }

    /**
     * Get total discount given by a coupon
     * 
     * @param {string} couponId - Coupon ID
     * @returns {Promise<number>} Total discount amount
     */
    async getTotalDiscountByCoupon(couponId) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        const result = await this.Model.aggregate([
            { $match: { coupon: this._toObjectId(couponId) } },
            {
                $group: {
                    _id: null,
                    totalDiscount: { $sum: '$discountAmount' }
                }
            }
        ]);

        return result[0]?.totalDiscount || 0;
    }

    /**
     * Get total savings by user
     * 
     * @param {string} userId - User ID
     * @returns {Promise<number>} Total savings amount
     */
    async getTotalSavingsByUser(userId) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const result = await this.Model.aggregate([
            { $match: { user: this._toObjectId(userId) } },
            {
                $group: {
                    _id: null,
                    totalSavings: { $sum: '$discountAmount' }
                }
            }
        ]);

        return result[0]?.totalSavings || 0;
    }

    /**
     * Get coupon usage statistics
     * 
     * @param {string} couponId - Coupon ID
     * @returns {Promise<Object>} Usage statistics
     */
    async getCouponUsageStats(couponId) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        const stats = await this.Model.aggregate([
            { $match: { coupon: this._toObjectId(couponId) } },
            {
                $group: {
                    _id: null,
                    usageCount: { $sum: 1 },
                    totalDiscount: { $sum: '$discountAmount' },
                    totalOriginalAmount: { $sum: '$originalAmount' },
                    totalFinalAmount: { $sum: '$finalAmount' },
                    avgDiscount: { $avg: '$discountAmount' },
                    maxDiscount: { $max: '$discountAmount' },
                    minDiscount: { $min: '$discountAmount' }
                }
            }
        ]);

        if (stats.length === 0) {
            return {
                usageCount: 0,
                totalDiscount: 0,
                totalOriginalAmount: 0,
                totalFinalAmount: 0,
                avgDiscount: 0,
                maxDiscount: 0,
                minDiscount: 0,
                savingsPercentage: '0%'
            };
        }

        const result = stats[0];
        const savingsPercentage = result.totalOriginalAmount > 0
            ? ((result.totalDiscount / result.totalOriginalAmount) * 100).toFixed(2)
            : '0';

        return {
            usageCount: result.usageCount,
            totalDiscount: result.totalDiscount,
            totalOriginalAmount: result.totalOriginalAmount,
            totalFinalAmount: result.totalFinalAmount,
            avgDiscount: parseFloat(result.avgDiscount.toFixed(2)),
            maxDiscount: result.maxDiscount,
            minDiscount: result.minDiscount,
            savingsPercentage: `${savingsPercentage}%`
        };
    }

    /**
     * Get user coupon usage history with details
     * 
     * @param {string} userId - User ID
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Usage history with coupon details
     */
    async getUserUsageHistory(userId, options = {}) {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const usage = await this.Model.aggregate([
            { $match: { user: this._toObjectId(userId) } },
            {
                $lookup: {
                    from: 'coupons',
                    localField: 'coupon',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $unwind: '$couponDetails'
            },
            {
                $sort: { usedAt: -1 }
            },
            {
                $limit: options.limit || 50
            },
            {
                $project: {
                    couponCode: '$couponDetails.code',
                    couponType: '$couponDetails.type',
                    originalAmount: 1,
                    discountAmount: 1,
                    finalAmount: 1,
                    usedAt: 1,
                    payment: 1
                }
            }
        ]);

        return usage;
    }

    /**
     * Get usage records for a date range
     * 
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Usage records in date range
     */
    async findByDateRange(startDate, endDate, options = {}) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        return await this.find(
            {
                usedAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            },
            {
                ...options,
                sort: options.sort || { usedAt: -1 }
            }
        );
    }

    /**
     * Get top users by coupon usage
     * 
     * @param {number} [limit=10] - Number of top users to return
     * @returns {Promise<Array>} Top users with usage stats
     */
    async getTopUsersBySavings(limit = 10) {
        const topUsers = await this.Model.aggregate([
            {
                $group: {
                    _id: '$user',
                    usageCount: { $sum: 1 },
                    totalSavings: { $sum: '$discountAmount' },
                    totalSpent: { $sum: '$finalAmount' }
                }
            },
            {
                $sort: { totalSavings: -1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: '$userDetails'
            },
            {
                $project: {
                    userId: '$_id',
                    userName: '$userDetails.name',
                    userEmail: '$userDetails.email',
                    usageCount: 1,
                    totalSavings: 1,
                    totalSpent: 1
                }
            }
        ]);

        return topUsers;
    }

    /**
     * Get most popular coupons
     * 
     * @param {number} [limit=10] - Number of top coupons to return
     * @returns {Promise<Array>} Most used coupons with stats
     */
    async getMostPopularCoupons(limit = 10) {
        const popularCoupons = await this.Model.aggregate([
            {
                $group: {
                    _id: '$coupon',
                    usageCount: { $sum: 1 },
                    totalDiscount: { $sum: '$discountAmount' },
                    uniqueUsers: { $addToSet: '$user' }
                }
            },
            {
                $sort: { usageCount: -1 }
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'coupons',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'couponDetails'
                }
            },
            {
                $unwind: '$couponDetails'
            },
            {
                $project: {
                    couponId: '$_id',
                    couponCode: '$couponDetails.code',
                    couponType: '$couponDetails.type',
                    couponValue: '$couponDetails.value',
                    usageCount: 1,
                    totalDiscount: 1,
                    uniqueUserCount: { $size: '$uniqueUsers' }
                }
            }
        ]);

        return popularCoupons;
    }

    /**
     * Get overall usage statistics
     * 
     * @returns {Promise<Object>} Overall statistics
     */
    async getOverallStats() {
        const stats = await this.Model.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsages: { $sum: 1 },
                    totalDiscount: { $sum: '$discountAmount' },
                    totalOriginalAmount: { $sum: '$originalAmount' },
                    totalFinalAmount: { $sum: '$finalAmount' },
                    avgDiscount: { $avg: '$discountAmount' },
                    uniqueCoupons: { $addToSet: '$coupon' },
                    uniqueUsers: { $addToSet: '$user' }
                }
            }
        ]);

        if (stats.length === 0) {
            return {
                totalUsages: 0,
                totalDiscount: 0,
                totalOriginalAmount: 0,
                totalFinalAmount: 0,
                avgDiscount: 0,
                uniqueCouponCount: 0,
                uniqueUserCount: 0,
                overallSavingsRate: '0%'
            };
        }

        const result = stats[0];
        const savingsRate = result.totalOriginalAmount > 0
            ? ((result.totalDiscount / result.totalOriginalAmount) * 100).toFixed(2)
            : '0';

        return {
            totalUsages: result.totalUsages,
            totalDiscount: result.totalDiscount,
            totalOriginalAmount: result.totalOriginalAmount,
            totalFinalAmount: result.totalFinalAmount,
            avgDiscount: parseFloat(result.avgDiscount.toFixed(2)),
            uniqueCouponCount: result.uniqueCoupons.length,
            uniqueUserCount: result.uniqueUsers.length,
            overallSavingsRate: `${savingsRate}%`
        };
    }

    /**
     * Delete usage records by coupon
     * Useful when deleting a coupon
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Delete result
     */
    async deleteByCoupon(couponId, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        return await this.deleteMany({ coupon: couponId }, options);
    }
}

export default CouponUsageRepository;
