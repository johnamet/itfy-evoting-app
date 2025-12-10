/**
 * CouponController
 * 
 * Handles coupon management operations:
 * - CRUD operations
 * - Coupon validation
 * - Usage tracking
 * - Coupon statistics
 * 
 * @module controllers/CouponController
 */

import BaseController from './BaseController.js';
import { couponService } from '../services/index.js';

class CouponController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get all coupons
     * GET /api/v1/coupons
     * Access: Admin/Organizer
     */
    getAllCoupons = this.asyncHandler(async (req, res) => {
        const pagination = this.getPagination(req);
        const sortOptions = this.getSortOptions(req, { createdAt: -1 });
        const filters = this.getFilterOptions(req, ['type', 'active', 'eventId']);

        try {
            const result = await couponService.getAllCoupons({
                ...pagination,
                sort: sortOptions,
                filters
            });

            return this.sendPaginatedResponse(
                res,
                result.coupons,
                { total: result.total, ...pagination },
                'Coupons retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get coupon by ID
     * GET /api/v1/coupons/:id
     * Access: Admin/Organizer
     */
    getCouponById = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid coupon ID format');
        }

        try {
            const coupon = await couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendNotFound(res, 'Coupon not found');
            }

            return this.sendSuccess(res, coupon, 'Coupon retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Create new coupon
     * POST /api/v1/coupons
     * Access: Admin/Organizer
     */
    createCoupon = this.asyncHandler(async (req, res) => {
        const couponData = this.getRequestBody(req);
        const createdBy = this.getUserId(req);

        // Validate required fields
        const missing = this.validateRequiredFields(
            couponData,
            ['code', 'type', 'discountValue', 'validFrom', 'validUntil']
        );

        if (missing.length > 0) {
            return this.sendBadRequest(res, `Missing required fields: ${missing.join(', ')}`);
        }

        // Validate coupon type
        if (!this.isValidEnum(couponData.type, ['percentage', 'fixed'])) {
            return this.sendBadRequest(res, 'Invalid coupon type. Must be "percentage" or "fixed"');
        }

        // Validate discount value
        if (!this.isValidInteger(couponData.discountValue) || couponData.discountValue <= 0) {
            return this.sendBadRequest(res, 'Discount value must be a positive integer');
        }

        // Validate percentage range
        if (couponData.type === 'percentage' && couponData.discountValue > 100) {
            return this.sendBadRequest(res, 'Percentage discount cannot exceed 100%');
        }

        // Validate date range
        if (!this.validateDateRange(couponData.validFrom, couponData.validUntil)) {
            return this.sendBadRequest(res, 'Invalid date range');
        }

        // Validate eventId if provided
        if (couponData.eventId && !this.validateMongoId(couponData.eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const coupon = await couponService.createCoupon({
                ...couponData,
                createdBy
            });

            return this.sendCreated(res, coupon, 'Coupon created successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Update coupon
     * PUT /api/v1/coupons/:id
     * Access: Admin/Organizer (own coupons)
     */
    updateCoupon = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const updates = this.getRequestBody(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid coupon ID format');
        }

        try {
            const coupon = await couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendNotFound(res, 'Coupon not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, coupon.createdBy)) {
                return this.sendForbidden(res, 'You can only update your own coupons');
            }

            // Validate type if provided
            if (updates.type && !this.isValidEnum(updates.type, ['percentage', 'fixed'])) {
                return this.sendBadRequest(res, 'Invalid coupon type');
            }

            // Validate discount value if provided
            if (updates.discountValue) {
                if (!this.isValidInteger(updates.discountValue) || updates.discountValue <= 0) {
                    return this.sendBadRequest(res, 'Discount value must be a positive integer');
                }
                
                const type = updates.type || coupon.type;
                if (type === 'percentage' && updates.discountValue > 100) {
                    return this.sendBadRequest(res, 'Percentage discount cannot exceed 100%');
                }
            }

            // Validate date range if provided
            if (updates.validFrom || updates.validUntil) {
                const validFrom = updates.validFrom || coupon.validFrom;
                const validUntil = updates.validUntil || coupon.validUntil;
                
                if (!this.validateDateRange(validFrom, validUntil)) {
                    return this.sendBadRequest(res, 'Invalid date range');
                }
            }

            const updatedCoupon = await couponService.updateCoupon(id, updates);
            return this.sendSuccess(res, updatedCoupon, 'Coupon updated successfully');
        } catch (error) {
            if (error.message.includes('already exists')) {
                return this.sendConflict(res, error.message);
            }
            return this.sendError(res, error);
        }
    });

    /**
     * Delete coupon
     * DELETE /api/v1/coupons/:id
     * Access: Admin/Organizer (own coupons)
     */
    deleteCoupon = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid coupon ID format');
        }

        try {
            const coupon = await couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendNotFound(res, 'Coupon not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, coupon.createdBy)) {
                return this.sendForbidden(res, 'You can only delete your own coupons');
            }

            await couponService.deleteCoupon(id);
            return this.sendNoContent(res);
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Validate coupon code
     * POST /api/v1/coupons/validate
     * Access: Public
     */
    validateCoupon = this.asyncHandler(async (req, res) => {
        const { code, eventId } = this.getRequestBody(req);
        const userId = this.getUserId(req);

        if (!code) {
            return this.sendBadRequest(res, 'Coupon code is required');
        }

        // Validate eventId if provided
        if (eventId && !this.validateMongoId(eventId)) {
            return this.sendBadRequest(res, 'Invalid event ID format');
        }

        try {
            const validation = await couponService.validateCoupon(code, userId, eventId);

            if (!validation.valid) {
                return this.sendBadRequest(res, validation.message);
            }

            return this.sendSuccess(res, validation, 'Coupon is valid');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get coupon usage statistics
     * GET /api/v1/coupons/:id/statistics
     * Access: Admin/Organizer (own coupons)
     */
    getCouponStatistics = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid coupon ID format');
        }

        try {
            const coupon = await couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendNotFound(res, 'Coupon not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, coupon.createdBy)) {
                return this.sendForbidden(res, 'You can only view statistics for your own coupons');
            }

            const stats = await couponService.getCouponStatistics(id);
            return this.sendSuccess(res, stats, 'Coupon statistics retrieved successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Get coupon usage history
     * GET /api/v1/coupons/:id/usage
     * Access: Admin/Organizer (own coupons)
     */
    getCouponUsage = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);
        const pagination = this.getPagination(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid coupon ID format');
        }

        try {
            const coupon = await couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendNotFound(res, 'Coupon not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, coupon.createdBy)) {
                return this.sendForbidden(res, 'You can only view usage for your own coupons');
            }

            const result = await couponService.getCouponUsage(id, pagination);

            return this.sendPaginatedResponse(
                res,
                result.usage,
                { total: result.total, ...pagination },
                'Coupon usage retrieved successfully'
            );
        } catch (error) {
            return this.sendError(res, error);
        }
    });

    /**
     * Deactivate coupon
     * POST /api/v1/coupons/:id/deactivate
     * Access: Admin/Organizer (own coupons)
     */
    deactivateCoupon = this.asyncHandler(async (req, res) => {
        const { id } = this.getRequestParams(req);

        // Validate MongoDB ID
        if (!this.validateMongoId(id)) {
            return this.sendBadRequest(res, 'Invalid coupon ID format');
        }

        try {
            const coupon = await couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendNotFound(res, 'Coupon not found');
            }

            // Check authorization
            if (!this.canModifyResource(req, coupon.createdBy)) {
                return this.sendForbidden(res, 'You can only deactivate your own coupons');
            }

            const updatedCoupon = await couponService.deactivateCoupon(id);
            return this.sendSuccess(res, updatedCoupon, 'Coupon deactivated successfully');
        } catch (error) {
            return this.sendError(res, error);
        }
    });
}

export default CouponController;
