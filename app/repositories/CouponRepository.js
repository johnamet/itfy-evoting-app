import BaseRepository from '../BaseRepository.js';
import Coupon from '../../models/Coupon.js';
import { mainCacheManager } from '../../utils/engine/CacheManager.js';

/**
 * CouponRepository
 * 
 * Manages discount coupons with intelligent caching. Coupons are cached with a 30-minute TTL
 * since they don't change frequently but need to be validated during payment processing.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - Code lookups skip cache for accurate availability checks
 * - Usage count updates invalidate entity caches
 * - Status changes invalidate both entity and query caches
 * 
 * @extends BaseRepository
 */
class CouponRepository extends BaseRepository {
    constructor() {
        super(Coupon, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 1800 // 30 minutes
        });
    }

    /**
     * Create a new coupon
     * 
     * @param {Object} couponData - Coupon data
     * @param {string} couponData.code - Unique coupon code
     * @param {string} couponData.type - Discount type (percentage, fixed)
     * @param {number} couponData.value - Discount value
     * @param {Date} [couponData.validFrom] - Valid from date
     * @param {Date} couponData.validUntil - Expiry date
     * @param {number} [couponData.maxUses] - Maximum usage limit
     * @param {number} [couponData.minAmount] - Minimum purchase amount
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created coupon
     */
    async createCoupon(couponData, options = {}) {
        this._validateRequiredFields(couponData, ['code', 'type', 'value', 'validUntil']);

        // Validate discount type
        if (!['percentage', 'fixed'].includes(couponData.type)) {
            throw new Error('Coupon type must be either "percentage" or "fixed"');
        }

        // Validate percentage value
        if (couponData.type === 'percentage' && (couponData.value < 0 || couponData.value > 100)) {
            throw new Error('Percentage discount must be between 0 and 100');
        }

        // Check if code already exists
        const existingCoupon = await this.findByCode(couponData.code, { skipCache: true });
        if (existingCoupon) {
            throw new Error('Coupon code already exists');
        }

        const couponToCreate = {
            ...couponData,
            code: couponData.code.toUpperCase(), // Normalize code to uppercase
            active: true,
            usedCount: 0
        };

        return await this.create(couponToCreate, options);
    }

    /**
     * Find coupon by code
     * Skip cache for accurate availability checks
     * 
     * @param {string} code - Coupon code
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Object|null>} Coupon or null
     */
    async findByCode(code, options = {}) {
        if (!code) {
            throw new Error('Coupon code is required');
        }

        return await this.findOne(
            { code: code.toUpperCase() },
            {
                ...options,
                skipCache: true // Always skip cache for coupon validation
            }
        );
    }

    /**
     * Find active coupons
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Active coupons
     */
    async findActiveCoupons(options = {}) {
        const now = new Date();

        return await this.find(
            {
                active: true,
                validUntil: { $gte: now },
                $or: [
                    { validFrom: { $lte: now } },
                    { validFrom: { $exists: false } }
                ]
            },
            {
                ...options,
                sort: options.sort || { createdAt: -1 }
            }
        );
    }

    /**
     * Validate coupon for use
     * Comprehensive validation including expiry, usage limits, and minimum amount
     * 
     * @param {string} code - Coupon code
     * @param {number} amount - Purchase amount
     * @returns {Promise<Object>} Validation result with coupon or error
     */
    async validateCoupon(code, amount) {
        if (!code) {
            return {
                valid: false,
                error: 'Coupon code is required'
            };
        }

        const coupon = await this.findByCode(code, { skipCache: true });

        if (!coupon) {
            return {
                valid: false,
                error: 'Invalid coupon code'
            };
        }

        if (!coupon.active) {
            return {
                valid: false,
                error: 'Coupon is no longer active'
            };
        }

        const now = new Date();

        // Check validity period
        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
            return {
                valid: false,
                error: 'Coupon is not yet valid'
            };
        }

        if (new Date(coupon.validUntil) < now) {
            return {
                valid: false,
                error: 'Coupon has expired'
            };
        }

        // Check usage limit
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            return {
                valid: false,
                error: 'Coupon usage limit reached'
            };
        }

        // Check minimum amount
        if (coupon.minAmount && amount < coupon.minAmount) {
            return {
                valid: false,
                error: `Minimum purchase amount of ${coupon.minAmount} required`
            };
        }

        return {
            valid: true,
            coupon
        };
    }

    /**
     * Calculate discount amount
     * 
     * @param {Object} coupon - Coupon object
     * @param {number} amount - Original amount
     * @returns {Object} Discount calculation
     */
    calculateDiscount(coupon, amount) {
        if (!coupon || !amount) {
            return {
                originalAmount: amount,
                discountAmount: 0,
                finalAmount: amount
            };
        }

        let discountAmount = 0;

        if (coupon.type === 'percentage') {
            discountAmount = (amount * coupon.value) / 100;
        } else if (coupon.type === 'fixed') {
            discountAmount = Math.min(coupon.value, amount); // Cannot exceed amount
        }

        const finalAmount = Math.max(0, amount - discountAmount);

        return {
            originalAmount: amount,
            discountAmount,
            finalAmount,
            discountType: coupon.type,
            discountValue: coupon.value
        };
    }

    /**
     * Increment coupon usage count
     * Invalidates coupon cache
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated coupon
     */
    async incrementUsage(couponId, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        const coupon = await this.Model.findByIdAndUpdate(
            couponId,
            { $inc: { usedCount: 1 } },
            { new: true, session: options.session }
        ).lean();

        // Manually invalidate cache since we're using direct model operation
        await this._invalidateCache('findById', couponId, { entity: coupon });

        return coupon;
    }

    /**
     * Activate a coupon
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated coupon
     */
    async activateCoupon(couponId, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        return await this.updateById(couponId, { active: true }, options);
    }

    /**
     * Deactivate a coupon
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated coupon
     */
    async deactivateCoupon(couponId, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        return await this.updateById(couponId, { active: false }, options);
    }

    /**
     * Update coupon details
     * Prevents updating code and type after creation
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} updateData - Update data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated coupon
     */
    async updateCoupon(couponId, updateData, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        // Prevent updating code and type
        const { code, type, usedCount, ...safeUpdateData } = updateData;

        return await this.updateById(couponId, safeUpdateData, options);
    }

    /**
     * Delete a coupon
     * Should check if coupon has been used before deletion
     * 
     * @param {string} couponId - Coupon ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Deleted coupon
     */
    async deleteCoupon(couponId, options = {}) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        return await this.deleteById(couponId, options);
    }

    /**
     * Get coupon statistics
     * 
     * @param {string} couponId - Coupon ID
     * @returns {Promise<Object>} Coupon statistics
     */
    async getCouponStats(couponId) {
        if (!couponId) {
            throw new Error('Coupon ID is required');
        }

        const coupon = await this.findById(couponId);

        if (!coupon) {
            throw new Error('Coupon not found');
        }

        const usagePercentage = coupon.maxUses
            ? ((coupon.usedCount / coupon.maxUses) * 100).toFixed(2)
            : 'Unlimited';

        const remainingUses = coupon.maxUses
            ? Math.max(0, coupon.maxUses - coupon.usedCount)
            : 'Unlimited';

        return {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            usedCount: coupon.usedCount,
            maxUses: coupon.maxUses || 'Unlimited',
            remainingUses,
            usagePercentage,
            active: coupon.active,
            validFrom: coupon.validFrom,
            validUntil: coupon.validUntil,
            isExpired: new Date(coupon.validUntil) < new Date()
        };
    }

    /**
     * Expire old coupons
     * Updates status of coupons past their validity period
     * 
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result with modified count
     */
    async expireOldCoupons(options = {}) {
        const now = new Date();

        return await this.updateMany(
            {
                active: true,
                validUntil: { $lt: now }
            },
            { active: false },
            options
        );
    }

    /**
     * Find coupons expiring soon
     * 
     * @param {number} days - Number of days
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Expiring coupons
     */
    async findExpiringSoon(days = 7, options = {}) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        return await this.find(
            {
                active: true,
                validUntil: {
                    $gte: now,
                    $lte: futureDate
                }
            },
            {
                ...options,
                sort: options.sort || { validUntil: 1 }
            }
        );
    }

    /**
     * Get overall coupon statistics
     * 
     * @returns {Promise<Object>} Overall statistics
     */
    async getOverallStats() {
        const [totalCount, activeCount, expiredCount, stats] = await Promise.all([
            this.count({}),
            this.count({ active: true }),
            this.count({
                active: false,
                validUntil: { $lt: new Date() }
            }),
            this.Model.aggregate([
                {
                    $group: {
                        _id: null,
                        totalUsed: { $sum: '$usedCount' },
                        avgUsage: { $avg: '$usedCount' }
                    }
                }
            ])
        ]);

        return {
            totalCoupons: totalCount,
            activeCoupons: activeCount,
            expiredCoupons: expiredCount,
            inactiveCoupons: totalCount - activeCount - expiredCount,
            totalUsed: stats[0]?.totalUsed || 0,
            avgUsagePerCoupon: stats[0]?.avgUsage?.toFixed(2) || '0.00'
        };
    }
}

export default CouponRepository;
