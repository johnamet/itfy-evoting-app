/**
 * CouponService
 * 
 * Handles coupon validation, discount calculation, usage tracking, and statistics.
 * Combines operations for both coupons and coupon usage records.
 * 
 * @extends BaseService
 * @module services/CouponService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class CouponService extends BaseService {
    constructor(repositories) {
        super(repositories, {
            serviceName: 'CouponService',
            primaryRepository: 'coupon',
        });

        this.discountTypes = ['percentage', 'fixed'];
    }

    /**
     * Create a new coupon
     */
    async createCoupon(couponData, creatorId) {
        return this.runInContext('createCoupon', async () => {
            // Validate required fields
            this.validateRequiredFields(couponData, [
                'code', 'discountType', 'discountValue'
            ]);

            // Validate discount type
            if (!this.discountTypes.includes(couponData.discountType)) {
                throw new Error(`Invalid discount type. Must be one of: ${this.discountTypes.join(', ')}`);
            }

            // Validate discount value
            if (couponData.discountType === 'percentage') {
                if (couponData.discountValue < 0 || couponData.discountValue > 100) {
                    throw new Error('Percentage discount must be between 0 and 100');
                }
            } else {
                if (couponData.discountValue < 0) {
                    throw new Error('Fixed discount value must be positive');
                }
            }

            // Check for duplicate code
            const existingCoupon = await this.repo('coupon').findOne({
                code: couponData.code.toUpperCase(),
            });

            if (existingCoupon) {
                throw new Error('Coupon code already exists');
            }

            // Validate dates
            if (couponData.expiryDate && this.isDatePast(couponData.expiryDate)) {
                throw new Error('Expiry date cannot be in the past');
            }

            // Create coupon
            const coupon = await this.repo('coupon').create({
                ...couponData,
                code: couponData.code.toUpperCase(),
                usageCount: 0,
                totalDiscount: 0,
                active: true,
                createdBy: creatorId,
            });

            await this.logActivity(creatorId, 'create', 'coupon', {
                couponId: coupon._id,
                code: coupon.code,
            });

            return this.handleSuccess({ coupon }, 'Coupon created successfully');
        });
    }

    /**
     * Validate and apply coupon
     */
    async validateCoupon(code, eventId = null, userId = null, amount = null) {
        return this.runInContext('validateCoupon', async () => {
            const coupon = await this.repo('coupon').findOne({
                code: code.toUpperCase(),
            });

            if (!coupon) {
                throw new Error('Invalid coupon code');
            }

            // Check if active
            if (!coupon.active) {
                throw new Error('This coupon is no longer active');
            }

            // Check expiry date
            if (coupon.expiryDate && this.isDatePast(coupon.expiryDate)) {
                throw new Error('This coupon has expired');
            }

            // Check usage limit
            if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
                throw new Error('This coupon has reached its usage limit');
            }

            // Check per-user limit
            if (userId && coupon.maxUsagePerUser) {
                const userUsageCount = await this.repo('couponUsage').count({
                    couponId: coupon._id,
                    userId,
                });

                if (userUsageCount >= coupon.maxUsagePerUser) {
                    throw new Error('You have reached the usage limit for this coupon');
                }
            }

            // Check event restriction
            if (coupon.eventId && eventId) {
                if (coupon.eventId.toString() !== eventId.toString()) {
                    throw new Error('This coupon is not valid for this event');
                }
            }

            // Check minimum purchase
            if (amount && coupon.minPurchaseAmount) {
                if (amount < coupon.minPurchaseAmount) {
                    throw new Error(
                        `Minimum purchase amount of ${coupon.minPurchaseAmount} required`
                    );
                }
            }

            // Calculate discount
            let discountAmount = 0;
            if (amount) {
                discountAmount = this.calculateDiscount(coupon, amount);
            }

            return this.handleSuccess({
                valid: true,
                coupon: {
                    id: coupon._id,
                    code: coupon.code,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    minPurchaseAmount: coupon.minPurchaseAmount,
                    maxDiscountAmount: coupon.maxDiscountAmount,
                },
                discountAmount,
                finalAmount: amount ? amount - discountAmount : null,
            }, 'Coupon is valid');
        });
    }

    /**
     * Calculate discount amount
     */
    calculateDiscount(coupon, amount) {
        let discount = 0;

        if (coupon.discountType === 'percentage') {
            discount = (amount * coupon.discountValue) / 100;
        } else {
            discount = coupon.discountValue;
        }

        // Apply max discount cap if set
        if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
            discount = coupon.maxDiscountAmount;
        }

        // Ensure discount doesn't exceed amount
        if (discount > amount) {
            discount = amount;
        }

        return Math.round(discount * 100) / 100; // Round to 2 decimals
    }

    /**
     * Record coupon usage
     */
    async recordCouponUsage(couponId, usageData, userId) {
        return this.runInContext('recordCouponUsage', async () => {
            this.validateRequiredFields(usageData, ['originalAmount', 'discountAmount']);

            const coupon = await this.repo('coupon').findById(couponId);
            
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            // Create usage record
            const usage = await this.repo('couponUsage').create({
                couponId,
                userId,
                eventId: usageData.eventId || null,
                paymentId: usageData.paymentId || null,
                originalAmount: usageData.originalAmount,
                discountAmount: usageData.discountAmount,
                finalAmount: usageData.originalAmount - usageData.discountAmount,
            });

            // Update coupon statistics
            await this.repo('coupon').update(couponId, {
                $inc: {
                    usageCount: 1,
                    totalDiscount: usageData.discountAmount,
                },
            });

            await this.logActivity(userId, 'use', 'coupon', {
                couponId,
                usageId: usage._id,
                code: coupon.code,
                discountAmount: usageData.discountAmount,
            });

            return this.handleSuccess({ usage }, 'Coupon usage recorded');
        });
    }

    /**
     * Update coupon
     */
    async updateCoupon(couponId, updates, userId) {
        return this.runInContext('updateCoupon', async () => {
            const coupon = await this.repo('coupon').findById(couponId);
            
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            // Prevent updating certain fields
            const restrictedFields = ['code', 'usageCount', 'totalDiscount'];
            for (const field of restrictedFields) {
                if (updates[field] !== undefined) {
                    delete updates[field];
                }
            }

            // Validate discount type if being updated
            if (updates.discountType && !this.discountTypes.includes(updates.discountType)) {
                throw new Error(`Invalid discount type. Must be one of: ${this.discountTypes.join(', ')}`);
            }

            // Validate discount value if being updated
            if (updates.discountValue !== undefined) {
                const discountType = updates.discountType || coupon.discountType;
                
                if (discountType === 'percentage') {
                    if (updates.discountValue < 0 || updates.discountValue > 100) {
                        throw new Error('Percentage discount must be between 0 and 100');
                    }
                } else {
                    if (updates.discountValue < 0) {
                        throw new Error('Fixed discount value must be positive');
                    }
                }
            }

            const updatedCoupon = await this.repo('coupon').update(couponId, updates);

            await this.logActivity(userId, 'update', 'coupon', {
                couponId,
                fields: Object.keys(updates),
            });

            return this.handleSuccess(
                { coupon: updatedCoupon },
                'Coupon updated successfully'
            );
        });
    }

    /**
     * Deactivate coupon
     */
    async deactivateCoupon(couponId, userId) {
        return this.runInContext('deactivateCoupon', async () => {
            const coupon = await this.repo('coupon').findById(couponId);
            
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            const updatedCoupon = await this.repo('coupon').update(couponId, {
                active: false,
            });

            await this.logActivity(userId, 'deactivate', 'coupon', {
                couponId,
                code: coupon.code,
            });

            return this.handleSuccess(
                { coupon: updatedCoupon },
                'Coupon deactivated successfully'
            );
        });
    }

    /**
     * List coupons with filters
     */
    async listCoupons(filters = {}, pagination = {}) {
        return this.runInContext('listCoupons', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = {};

            // Filter by active status
            if (filters.active !== undefined) {
                query.active = filters.active === 'true';
            }

            // Filter by event
            if (filters.eventId) {
                query.eventId = filters.eventId;
            }

            // Filter by discount type
            if (filters.discountType) {
                query.discountType = filters.discountType;
            }

            // Search by code
            if (filters.search) {
                query.code = { $regex: filters.search, $options: 'i' };
            }

            // Filter by expiry
            if (filters.expired !== undefined) {
                const now = new Date();
                query.expiryDate = filters.expired === 'true'
                    ? { $lt: now }
                    : { $gte: now };
            }

            const coupons = await this.repo('coupon').findWithPagination(query, {
                page,
                limit,
                sort: filters.sort || { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(coupons.docs, coupons.total, page, limit),
                'Coupons retrieved successfully'
            );
        });
    }

    /**
     * Get coupon statistics
     */
    async getCouponStatistics(couponId) {
        return this.runInContext('getCouponStatistics', async () => {
            const coupon = await this.repo('coupon').findById(couponId);
            
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            // Usage statistics
            const usages = await this.repo('couponUsage').find({ couponId });

            // Total revenue saved
            const totalSaved = usages.reduce((sum, u) => sum + u.discountAmount, 0);

            // Unique users
            const uniqueUsers = new Set(usages.map(u => u.userId?.toString())).size;

            // Usage over time
            const usageOverTime = await this.repo('couponUsage').aggregate([
                { $match: { couponId } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                        totalDiscount: { $sum: '$discountAmount' },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Usage by event
            const usageByEvent = await this.repo('couponUsage').aggregate([
                { $match: { couponId } },
                {
                    $group: {
                        _id: '$eventId',
                        count: { $sum: 1 },
                        totalDiscount: { $sum: '$discountAmount' },
                    },
                },
                { $sort: { count: -1 } },
            ]);

            return this.handleSuccess({
                coupon: {
                    id: coupon._id,
                    code: coupon.code,
                    active: coupon.active,
                },
                statistics: {
                    totalUsage: coupon.usageCount,
                    maxUsage: coupon.maxUsage,
                    remainingUsage: coupon.maxUsage ? coupon.maxUsage - coupon.usageCount : null,
                    totalSaved,
                    averageDiscount: usages.length > 0 ? totalSaved / usages.length : 0,
                    uniqueUsers,
                    usageOverTime,
                    usageByEvent,
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Get user's coupon usage history
     */
    async getUserCouponUsage(userId, pagination = {}) {
        return this.runInContext('getUserCouponUsage', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const usages = await this.repo('couponUsage').findWithPagination(
                { userId },
                { page, limit, sort: { createdAt: -1 } }
            );

            // Enrich with coupon details
            const enrichedUsages = await Promise.all(
                usages.docs.map(async (usage) => {
                    const coupon = await this.repo('coupon').findById(usage.couponId);
                    
                    return {
                        ...usage.toObject(),
                        coupon: coupon ? {
                            code: coupon.code,
                            discountType: coupon.discountType,
                            discountValue: coupon.discountValue,
                        } : null,
                    };
                })
            );

            return this.handleSuccess(
                this.createPaginatedResponse(enrichedUsages, usages.total, page, limit),
                'Usage history retrieved successfully'
            );
        });
    }

    /**
     * Delete coupon
     */
    async deleteCoupon(couponId, userId) {
        return this.runInContext('deleteCoupon', async () => {
            const coupon = await this.repo('coupon').findById(couponId);
            
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            // Check if coupon has been used
            const usageCount = await this.repo('couponUsage').count({ couponId });
            
            if (usageCount > 0) {
                throw new Error('Cannot delete coupon that has been used. Deactivate instead.');
            }

            await this.repo('coupon').delete(couponId);

            await this.logActivity(userId, 'delete', 'coupon', {
                couponId,
                code: coupon.code,
            });

            return this.handleSuccess(null, 'Coupon deleted successfully');
        });
    }
}
