#!/usr/bin/env node
/**
 * Coupon Service
 * 
 * Handles coupon management including creation, validation,
 * usage tracking, and coupon-related business logic.
 */

import BaseService from './BaseService.js';
import CouponRepository from '../repositories/CouponRepository.js';
import CouponUsageRepository from '../repositories/CouponUsageRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import ActivityRepository from '../repositories/ActivityRepository.js';
import CacheService from './CacheService.js';

class CouponService extends BaseService {
    constructor() {
        super();
        this.couponRepository = new CouponRepository();
        this.couponUsageRepository = new CouponUsageRepository();
        this.eventRepository = new EventRepository();
        this.userRepository = new UserRepository();
        this.activityRepository = new ActivityRepository();
    }

    /**
     * Create a new coupon
     * @param {Object} couponData - Coupon data
     * @param {String} createdBy - ID of user creating the coupon
     * @returns {Promise<Object>} Created coupon
     */
    async createCoupon(couponData, createdBy) {
        try {
            this._log('create_coupon', { code: couponData.code, eventId: couponData.eventId, createdBy });

            // Validate required fields
            this._validateRequiredFields(couponData, ['code', 'type', 'eventId']);
            this._validateObjectId(couponData.eventId, 'Event ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Validate coupon type
            const validTypes = ['voting_access', 'early_access', 'admin_access', 'special_privilege'];
            if (!validTypes.includes(couponData.type)) {
                throw new Error('Invalid coupon type');
            }

            // Check if event exists
            const event = await this.eventRepository.findById(couponData.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Check for duplicate coupon code
            const existingCoupon = await this.couponRepository.findByCode(couponData.code);
            if (existingCoupon) {
                throw new Error('Coupon code already exists');
            }

            // Validate dates
            if (couponData.expiresAt && new Date(couponData.expiresAt) <= new Date()) {
                throw new Error('Expiration date must be in the future');
            }

            if (couponData.validFrom && couponData.expiresAt) {
                this._validateDateRange(couponData.validFrom, couponData.expiresAt);
            }

            // Create coupon
            const couponToCreate = {
                ...this._sanitizeData(couponData),
                code: couponData.code.toUpperCase().trim(),
                isActive: couponData.isActive !== false, // Default to true
                usageCount: 0,
                createdBy,
                createdAt: new Date()
            };

            const coupon = await this.couponRepository.create(couponToCreate);

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'coupon_create',
                targetType: 'coupon',
                targetId: coupon._id,
                metadata: { 
                    couponCode: coupon.code,
                    couponType: coupon.type,
                    eventId: coupon.eventId,
                    eventName: event.name
                }
            });

            // Invalidate event cache
            CacheService.invalidateEvent(couponData.eventId);

            this._log('create_coupon_success', { couponId: coupon._id, code: coupon.code });

            return {
                success: true,
                coupon: {
                    id: coupon._id,
                    code: coupon.code,
                    type: coupon.type,
                    description: coupon.description,
                    eventId: coupon.eventId,
                    maxUsage: coupon.maxUsage,
                    usageCount: coupon.usageCount,
                    validFrom: coupon.validFrom,
                    expiresAt: coupon.expiresAt,
                    isActive: coupon.isActive,
                    createdAt: coupon.createdAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'create_coupon', { code: couponData.code });
        }
    }

    /**
     * Validate and use a coupon
     * @param {String} couponCode - Coupon code
     * @param {String} userId - User ID using the coupon
     * @param {Object} context - Additional context for coupon usage
     * @returns {Promise<Object>} Validation and usage result
     */
    async useCoupon(couponCode, userId, context = {}) {
        try {
            this._log('use_coupon', { code: couponCode, userId });

            if (!couponCode || couponCode.trim().length === 0) {
                throw new Error('Coupon code is required');
            }

            this._validateObjectId(userId, 'User ID');

            // Get coupon
            const coupon = await this.couponRepository.findByCode(couponCode.toUpperCase().trim());
            if (!coupon) {
                throw new Error('Invalid coupon code');
            }

            // Check if coupon is active
            if (!coupon.isActive) {
                throw new Error('Coupon is no longer active');
            }

            // Check if coupon has expired
            if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
                throw new Error('Coupon has expired');
            }

            // Check if coupon is valid yet
            if (coupon.validFrom && new Date() < new Date(coupon.validFrom)) {
                throw new Error('Coupon is not valid yet');
            }

            // Check usage limits
            if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
                throw new Error('Coupon usage limit exceeded');
            }

            // Check if user already used this coupon
            const existingUsage = await this.couponUsageRepository.findByCouponAndUser(coupon._id, userId);
            if (existingUsage) {
                throw new Error('You have already used this coupon');
            }

            // Verify user exists
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Record coupon usage
            const usageData = {
                couponId: coupon._id,
                userId: userId,
                usedAt: new Date(),
                context: context,
                ipAddress: context.ipAddress || null,
                userAgent: context.userAgent || null
            };

            const usage = await this.couponUsageRepository.create(usageData);

            // Update coupon usage count
            await this.couponRepository.incrementUsage(coupon._id);

            // Log activity
            await this.activityRepository.logActivity({
                user: userId,
                action: 'coupon_use',
                targetType: 'coupon',
                targetId: coupon._id,
                metadata: { 
                    couponCode: coupon.code,
                    couponType: coupon.type,
                    eventId: coupon.eventId
                }
            });

            // Invalidate coupon cache
            CacheService.delete(`coupon:${couponCode.toUpperCase()}`);

            this._log('use_coupon_success', { couponId: coupon._id, userId });

            return {
                success: true,
                coupon: {
                    id: coupon._id,
                    code: coupon.code,
                    type: coupon.type,
                    description: coupon.description,
                    eventId: coupon.eventId
                },
                usage: {
                    id: usage._id,
                    usedAt: usage.usedAt
                },
                message: 'Coupon applied successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'use_coupon', { code: couponCode, userId });
        }
    }

    /**
     * Validate a coupon without using it
     * @param {String} couponCode - Coupon code
     * @returns {Promise<Object>} Validation result
     */
    async validateCoupon(data) {
        try {
            this._log('validate_coupon', { code: data.code, eventId: data.eventId, categoryId: data.categoryId });

            if (!data.code || data.code.trim().length === 0) {
                throw new Error('Coupon code is required');
            }

            // Check cache first
            const cacheKey = `coupon:${data.code.toUpperCase()}`;
            let coupon = CacheService.get(cacheKey);

            if (!coupon) {
                coupon = await this.couponRepository.findByCode(data.code.toUpperCase().trim(), {
                    eventId: data.eventId,
                    categoryId: data.categoryId
                    });
                if (coupon) {
                    CacheService.set(cacheKey, coupon, 300000); // 5 minutes
                }
            }

            if (!coupon) {
                return {
                    success: false,
                    valid: false,
                    reason: 'Invalid coupon code'
                };
            }

            // Check if coupon is active
            if (!coupon.isActive) {
                return {
                    success: false,
                    valid: false,
                    reason: 'Coupon is no longer active'
                };
            }

            // Check if coupon has expired
            if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
                return {
                    success: false,
                    valid: false,
                    reason: 'Coupon has expired'
                };
            }


            if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
                return {
                    success: false,
                    valid: false,
                    reason: 'Coupon usage limit exceeded'
                };
            }
            this._log('validate_coupon_success', { code: coupon.code });

            return {
                success: true,
                valid: true,
                coupon: {
                    id: coupon._id,
                    code: coupon.code,
                    discountType: coupon.discountType,
                    discount: coupon.discount,
                    eventApplicable: coupon.eventApplicable,
                    maxUsage: coupon.maxUses,
                    categoriesApplicable: coupon.categoriesApplicable,
                    bundlesApplicable: coupon.bundlesApplicable,
                    usageCount: coupon.usedCount,
                    minOrderAmount: coupon.minOrderAmount,
                    remainingUsage: coupon.maxUses ? coupon.maxUses - coupon.usedCount : null,
                    validFrom: coupon.isActive && new Date(coupon.expiryDate) > new Date() ? new Date() : coupon.expiryDate,
                    expiresAt: coupon.expiryDate
                }
            };
        } catch (error) {
            throw this._handleError(error, 'validate_coupon', { code: couponCode });
        }
    }

    /**
     * Update coupon details
     * @param {String} couponId - Coupon ID
     * @param {Object} updateData - Data to update
     * @param {String} updatedBy - ID of user updating the coupon
     * @returns {Promise<Object>} Updated coupon
     */
    async updateCoupon(couponId, updateData, updatedBy) {
        try {
            this._log('update_coupon', { couponId, updatedBy });

            this._validateObjectId(couponId, 'Coupon ID');
            this._validateObjectId(updatedBy, 'Updated By User ID');

            // Get current coupon
            const currentCoupon = await this.couponRepository.findById(couponId);
            if (!currentCoupon) {
                throw new Error('Coupon not found');
            }

            // Validate dates if being updated
            if (updateData.validFrom || updateData.expiresAt) {
                const validFrom = updateData.validFrom || currentCoupon.validFrom;
                const expiresAt = updateData.expiresAt || currentCoupon.expiresAt;
                
                if (validFrom && expiresAt) {
                    this._validateDateRange(validFrom, expiresAt);
                }
            }

            // Check for duplicate code if code is being updated
            if (updateData.code && updateData.code !== currentCoupon.code) {
                const existingCoupon = await this.couponRepository.findByCode(updateData.code.toUpperCase());
                if (existingCoupon) {
                    throw new Error('Coupon code already exists');
                }
            }

            // Sanitize update data
            const sanitizedData = this._sanitizeData(updateData);
            delete sanitizedData._id;
            delete sanitizedData.usageCount;
            delete sanitizedData.createdAt;
            delete sanitizedData.createdBy;
            sanitizedData.updatedAt = new Date();

            if (sanitizedData.code) {
                sanitizedData.code = sanitizedData.code.toUpperCase().trim();
            }

            // Update coupon
            const updatedCoupon = await this.couponRepository.updateById(couponId, sanitizedData);

            // Log activity
            await this.activityRepository.logActivity({
                user: updatedBy,
                action: 'coupon_update',
                targetType: 'coupon',
                targetId: couponId,
                metadata: { 
                    couponCode: updatedCoupon.code,
                    updatedFields: Object.keys(sanitizedData)
                }
            });

            // Invalidate cache
            CacheService.delete(`coupon:${currentCoupon.code}`);
            if (updatedCoupon.code !== currentCoupon.code) {
                CacheService.delete(`coupon:${updatedCoupon.code}`);
            }

            this._log('update_coupon_success', { couponId });

            return {
                success: true,
                coupon: {
                    id: updatedCoupon._id,
                    code: updatedCoupon.code,
                    type: updatedCoupon.type,
                    description: updatedCoupon.description,
                    eventId: updatedCoupon.eventId,
                    maxUsage: updatedCoupon.maxUsage,
                    usageCount: updatedCoupon.usageCount,
                    validFrom: updatedCoupon.validFrom,
                    expiresAt: updatedCoupon.expiresAt,
                    isActive: updatedCoupon.isActive,
                    updatedAt: updatedCoupon.updatedAt
                }
            };
        } catch (error) {
            throw this._handleError(error, 'update_coupon', { couponId });
        }
    }

    /**
     * Delete a coupon
     * @param {String} couponId - Coupon ID
     * @param {String} deletedBy - ID of user deleting the coupon
     * @returns {Promise<Object>} Deletion result
     */
    async deleteCoupon(couponId, deletedBy) {
        try {
            this._log('delete_coupon', { couponId, deletedBy });

            this._validateObjectId(couponId, 'Coupon ID');
            this._validateObjectId(deletedBy, 'Deleted By User ID');

            // Get coupon
            const coupon = await this.couponRepository.findById(couponId);
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            // Check if coupon has been used
            const usageCount = await this.couponUsageRepository.countByCoupon(couponId);
            if (usageCount > 0) {
                throw new Error('Cannot delete coupon that has been used');
            }

            // Delete coupon
            await this.couponRepository.deleteById(couponId);

            // Log activity
            await this.activityRepository.logActivity({
                user: deletedBy,
                action: 'coupon_delete',
                targetType: 'coupon',
                targetId: couponId,
                metadata: { 
                    couponCode: coupon.code,
                    couponType: coupon.type
                }
            });

            // Invalidate cache
            CacheService.delete(`coupon:${coupon.code}`);

            this._log('delete_coupon_success', { couponId });

            return {
                success: true,
                message: 'Coupon deleted successfully'
            };
        } catch (error) {
            throw this._handleError(error, 'delete_coupon', { couponId });
        }
    }

    /**
     * Get coupons with filtering and pagination
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Paginated coupons
     */
    async getCoupons(query = {}) {
        try {
            this._log('get_coupons', { query });

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            // Create filter based on query
            const filter = this._createSearchFilter(query, ['code', 'description']);

            // Add specific filters
            if (query.eventId) {
                this._validateObjectId(query.eventId, 'Event ID');
                filter.eventId = query.eventId;
            }

            if (query.type) {
                filter.type = query.type;
            }

            if (query.isActive !== undefined) {
                filter.isActive = query.isActive === 'true';
            }

            // Date filters
            if (query.validFrom) {
                filter.validFrom = { $gte: new Date(query.validFrom) };
            }

            if (query.expiresAt) {
                filter.expiresAt = { $lte: new Date(query.expiresAt) };
            }

            const coupons = await this.couponRepository.find(filter, {
                skip: (page - 1) * limit,
                limit,
                sort: { createdAt: -1 }
            });

            // Get total count for pagination
            const total = await this.couponRepository.countDocuments(filter);

            // Format coupons with additional information
            const formattedCoupons = await Promise.all(
                coupons.map(async (coupon) => {
                    const usageCount = await this.couponUsageRepository.countByCoupon(coupon._id);
                    return {
                        id: coupon._id,
                        code: coupon.code,
                        type: coupon.type,
                        description: coupon.description,
                        eventId: coupon.eventId,
                        maxUsage: coupon.maxUsage,
                        usageCount,
                        remainingUsage: coupon.maxUsage ? coupon.maxUsage - usageCount : null,
                        validFrom: coupon.validFrom,
                        expiresAt: coupon.expiresAt,
                        isActive: coupon.isActive,
                        createdAt: coupon.createdAt
                    };
                })
            );

            return {
                success: true,
                data: this._formatPaginationResponse(formattedCoupons, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_coupons', { query });
        }
    }

    /**
     * Get coupon usage history
     * @param {String} couponId - Coupon ID
     * @param {Object} query - Query parameters
     * @returns {Promise<Object>} Coupon usage history
     */
    async getCouponUsage(couponId, query = {}) {
        try {
            this._log('get_coupon_usage', { couponId, query });

            this._validateObjectId(couponId, 'Coupon ID');

            const { page, limit } = this._generatePaginationOptions(
                query.page, 
                query.limit, 
                50
            );

            const usageHistory = await this.couponUsageRepository.findByCoupon(couponId, {
                skip: (page - 1) * limit,
                limit,
                sort: { usedAt: -1 },
                populate: [
                    { path: 'userId', select: 'username email profile.firstName profile.lastName' }
                ]
            });

            const total = await this.couponUsageRepository.countByCoupon(couponId);

            // Format usage history
            const formattedUsage = usageHistory.map(usage => ({
                id: usage._id,
                user: {
                    id: usage.userId._id,
                    username: usage.userId.username,
                    email: usage.userId.email,
                    name: usage.userId.profile ? 
                        `${usage.userId.profile.firstName} ${usage.userId.profile.lastName}`.trim() 
                        : usage.userId.username
                },
                usedAt: usage.usedAt,
                context: usage.context,
                ipAddress: usage.ipAddress
            }));

            return {
                success: true,
                data: this._formatPaginationResponse(formattedUsage, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_coupon_usage', { couponId });
        }
    }

    /**
     * Generate bulk coupons
     * @param {Object} couponTemplate - Template for coupon generation
     * @param {Number} count - Number of coupons to generate
     * @param {String} createdBy - ID of user creating the coupons
     * @returns {Promise<Object>} Generated coupons
     */
    async generateBulkCoupons(couponTemplate, count, createdBy) {
        try {
            this._log('generate_bulk_coupons', { count, eventId: couponTemplate.eventId, createdBy });

            if (count < 1 || count > 1000) {
                throw new Error('Count must be between 1 and 1000');
            }

            this._validateRequiredFields(couponTemplate, ['type', 'eventId']);
            this._validateObjectId(couponTemplate.eventId, 'Event ID');
            this._validateObjectId(createdBy, 'Created By User ID');

            // Check if event exists
            const event = await this.eventRepository.findById(couponTemplate.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            const generatedCoupons = [];
            const codePrefix = couponTemplate.codePrefix || 'COUP';

            for (let i = 0; i < count; i++) {
                // Generate unique code
                let code;
                let attempts = 0;
                do {
                    code = `${codePrefix}${this._generateRandomString(8)}`;
                    attempts++;
                    if (attempts > 10) {
                        throw new Error('Unable to generate unique coupon codes');
                    }
                } while (await this.couponRepository.findByCode(code));

                const couponData = {
                    ...this._sanitizeData(couponTemplate),
                    code,
                    usageCount: 0,
                    createdBy,
                    createdAt: new Date()
                };

                delete couponData.codePrefix;

                const coupon = await this.couponRepository.create(couponData);
                generatedCoupons.push({
                    id: coupon._id,
                    code: coupon.code,
                    type: coupon.type,
                    description: coupon.description
                });
            }

            // Log activity
            await this.activityRepository.logActivity({
                user: createdBy,
                action: 'coupon_bulk_generate',
                targetType: 'event',
                targetId: couponTemplate.eventId,
                metadata: { 
                    count,
                    eventName: event.name,
                    couponType: couponTemplate.type
                }
            });

            this._log('generate_bulk_coupons_success', { count: generatedCoupons.length });

            return {
                success: true,
                data: {
                    generated: generatedCoupons.length,
                    coupons: generatedCoupons
                },
                message: `Successfully generated ${generatedCoupons.length} coupons`
            };
        } catch (error) {
            throw this._handleError(error, 'generate_bulk_coupons', { count });
        }
    }

    /**
     * Generate random string for coupon codes
     * @param {Number} length - Length of random string
     * @returns {String} Random string
     */
    _generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

export default CouponService;
