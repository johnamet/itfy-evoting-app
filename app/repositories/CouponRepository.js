#!/usr/bin/env node
/**
 * Coupon Repository
 * 
 * Extends BaseRepository to provide Coupon-specific database operations.
 * Includes coupon validation, usage tracking, and expiration management.
 */

import BaseRepository from './BaseRepository.js';
import Coupon from '../models/Coupon.js';

class CouponRepository extends BaseRepository {
    
    constructor() {
        // Get the Coupon model - we need to handle this properly based on how models are exported
        super(Coupon);
    }

    /**
     * Find coupon by code
     * @param {String} code - Coupon code
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} Found coupon or null
     */
    async findByCode(code, options = {}) {
        try {
            const criteria = { code: code.toUpperCase().trim() };
            return await this.findOne(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findByCode');
        }
    }

    /**
     * Validate if coupon is usable
     * @param {String} code - Coupon code
     * @returns {Promise<Object>} Validation result with coupon data
     */
    async validateCoupon(code) {
        try {
            const coupon = await this.findByCode(code);
            
            if (!coupon) {
                return {
                    isValid: false,
                    error: 'Coupon not found',
                    coupon: null
                };
            }

            // Check if coupon is active
            if (!coupon.isActive) {
                return {
                    isValid: false,
                    error: 'Coupon is not active',
                    coupon
                };
            }

            // Check expiration date
            if (coupon.expiresAt && new Date() > coupon.expiresAt) {
                return {
                    isValid: false,
                    error: 'Coupon has expired',
                    coupon
                };
            }

            // Check usage limit
            if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
                return {
                    isValid: false,
                    error: 'Coupon usage limit reached',
                    coupon
                };
            }

            // // Check user-specific usage limit
            // if (userId && coupon.maxUsesPerUser) {
            //     const userUsageCount = await this._getUserUsageCount(coupon._id, userId);
            //     if (userUsageCount >= coupon.maxUsesPerUser) {
            //         return {
            //             isValid: false,
            //             error: 'User usage limit reached for this coupon',
            //             coupon
            //         };
            //     }
            // }

            // Check minimum order amount
            if (coupon.minOrderAmount && coupon.minOrderAmount > 0) {
                return {
                    isValid: true,
                    coupon,
                    requiresMinimumOrder: true,
                    minOrderAmount: coupon.minOrderAmount
                };
            }

            return {
                isValid: true,
                coupon
            };
        } catch (error) {
            throw this._handleError(error, 'validateCoupon');
        }
    }

    /**
     * Apply coupon and track usage
     * @param {String} code - Coupon code
     * @param {Number} orderAmount - Order amount (optional)
     * @returns {Promise<Object>} Application result
     */
    async applyCoupon(code, orderAmount = 0) {
        try {
            const validation = await this.validateCoupon(code);

            if (!validation.isValid) {
                return validation;
            }

            const coupon = validation.coupon;

            // Check minimum order amount if required
            if (validation.requiresMinimumOrder && orderAmount < coupon.minOrderAmount) {
                return {
                    isValid: false,
                    error: `Minimum order amount of ${coupon.minOrderAmount} required`,
                    coupon
                };
            }

            // Calculate discount
            let discountAmount = 0;
            if (coupon.discountType === 'percentage') {
                discountAmount = (orderAmount * coupon.discountValue) / 100;
                if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                    discountAmount = coupon.maxDiscountAmount;
                }
            } else if (coupon.discountType === 'fixed') {
                discountAmount = Math.min(coupon.discountValue, orderAmount);
            }

            // Record usage
            await this._recordUsage(coupon._id, userId);

            return {
                isValid: true,
                coupon,
                discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
                finalAmount: Math.max(0, orderAmount - discountAmount)
            };
        } catch (error) {
            throw this._handleError(error, 'applyCoupon');
        }
    }

    /**
     * Create a new coupon
     * @param {Object} couponData - Coupon data
     * @returns {Promise<Object>} Created coupon
     */
    async createCoupon(couponData) {
        try {
            // Ensure code is uppercase
            if (couponData.code) {
                couponData.code = couponData.code.toUpperCase().trim();
            }

            // Check if code already exists
            if (couponData.code) {
                const existingCoupon = await this.findByCode(couponData.code);
                if (existingCoupon) {
                    throw new Error('Coupon code already exists');
                }
            }

            return await this.create(couponData);
        } catch (error) {
            throw this._handleError(error, 'createCoupon');
        }
    }

    /**
     * Get active coupons
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Active coupons
     */
    async getActiveCoupons(options = {}) {
        try {
            const criteria = {
                isActive: true,
                $or: [
                    { expiresAt: { $gt: new Date() } },
                    { expiresAt: null }
                ]
            };

            return await this.find(criteria, {
                ...options,
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getActiveCoupons');
        }
    }

    /**
     * Get expired coupons
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Expired coupons
     */
    async getExpiredCoupons(options = {}) {
        try {
            const criteria = {
                expiresAt: { $lt: new Date() }
            };

            return await this.find(criteria, {
                ...options,
                sort: { expiresAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getExpiredCoupons');
        }
    }

    /**
     * Get coupon usage statistics
     * @param {String|ObjectId} couponId - Coupon ID
     * @returns {Promise<Object>} Usage statistics
     */
    async getCouponStats(couponId) {
        try {
            const coupon = await this.findById(couponId);
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            return {
                couponId,
                code: coupon.code,
                usedCount: coupon.usedCount || 0,
                maxUses: coupon.maxUses,
                remainingUses: coupon.maxUses ? coupon.maxUses - (coupon.usedCount || 0) : null,
                isActive: coupon.isActive,
                expiresAt: coupon.expiresAt,
            };
        } catch (error) {
            throw this._handleError(error, 'getCouponStats');
        }
    }

    /**
     * Deactivate expired coupons
     * @returns {Promise<Object>} Update result
     */
    async deactivateExpiredCoupons() {
        try {
            const criteria = {
                isActive: true,
                expiresAt: { $lt: new Date() }
            };

            return await this.updateMany(criteria, { isActive: false });
        } catch (error) {
            throw this._handleError(error, 'deactivateExpiredCoupons');
        }
    }

    /**
     * Generate unique coupon code
     * @param {Number} length - Code length (default: 8)
     * @param {String} prefix - Code prefix (optional)
     * @returns {Promise<String>} Unique coupon code
     */
    async generateUniqueCode(length = 8, prefix = '') {
        try {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code;
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;

            while (!isUnique && attempts < maxAttempts) {
                let randomPart = '';
                for (let i = 0; i < length; i++) {
                    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                
                code = prefix + randomPart;
                
                const existingCoupon = await this.findByCode(code);
                isUnique = !existingCoupon;
                attempts++;
            }

            if (!isUnique) {
                throw new Error('Unable to generate unique coupon code');
            }

            return code;
        } catch (error) {
            throw this._handleError(error, 'generateUniqueCode');
        }
    }

    /**
     * Bulk create coupons
     * @param {Array} couponsData - Array of coupon data
     * @returns {Promise<Array>} Created coupons
     */
    async bulkCreateCoupons(couponsData) {
        try {
            // Validate and prepare codes
            const processedCoupons = await Promise.all(
                couponsData.map(async (couponData) => {
                    if (couponData.code) {
                        couponData.code = couponData.code.toUpperCase().trim();
                        // Check for duplicates
                        const existing = await this.findByCode(couponData.code);
                        if (existing) {
                            throw new Error(`Coupon code ${couponData.code} already exists`);
                        }
                    } else {
                        // Generate unique code if not provided
                        couponData.code = await this.generateUniqueCode();
                    }
                    return couponData;
                })
            );

            return await this.createMany(processedCoupons);
        } catch (error) {
            throw this._handleError(error, 'bulkCreateCoupons');
        }
    }

    /**
     * Record coupon usage (private method)
     * @private
     * @param {String|ObjectId} couponId - Coupon ID
     * @param {String|ObjectId} userId - User ID
     */
    async _recordUsage(couponId, userId) {
        try {
            // Increment usage count
            await this.updateById(couponId, { $inc: { usedCount: 1 } });
            
            // Here you could also create a record in a CouponUsage collection
            // for detailed tracking if needed
        } catch (error) {
            throw this._handleError(error, '_recordUsage');
        }
    }
}

export default CouponRepository;