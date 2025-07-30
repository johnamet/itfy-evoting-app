#!/usr/bin/env node
/**
 * Coupon Controller
 * 
 * Handles coupon management operations for events and promotions.
 */

import BaseController from './BaseController.js';
import CouponService from '../services/CouponService.js';

export default class CouponController extends BaseController {
    constructor() {
        super();
        this.couponService = new CouponService();
    }

    /**
     * Create a new coupon
     */
    async createCoupon(req, res) {
        try {
            const couponData = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                return this.sendError(res, 'User authentication required', 401);
            }

            // Only admins can create coupons
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const coupon = await this.couponService.createCoupon({
                ...couponData,
                createdBy
            });

            return this.sendSuccess(res, coupon, 'Coupon created successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to create coupon');
        }
    }

    /**
     * Get all coupons with filtering and pagination
     */
    async getCoupons(req, res) {
        try {
            const query = req.query;
            
            // Only admins can view all coupons
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const coupons = await this.couponService.getCoupons(query);
            return this.sendSuccess(res, coupons, 'Coupons retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get coupons');
        }
    }

    /**
     * Get coupon by ID
     */
    async getCouponById(req, res) {
        try {
            const { id } = req.params;

            const coupon = await this.couponService.getCouponById(id);
            
            if (!coupon) {
                return this.sendError(res, 'Coupon not found', 404);
            }

            return this.sendSuccess(res, coupon, 'Coupon retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get coupon');
        }
    }

    /**
     * Get coupon by code
     */
    async getCouponByCode(req, res) {
        try {
            const { code } = req.params;

            const coupon = await this.couponService.getCouponByCode(code);
            
            if (!coupon) {
                return this.sendError(res, 'Coupon not found', 404);
            }

            return this.sendSuccess(res, coupon, 'Coupon retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get coupon');
        }
    }

    /**
     * Update coupon
     */
    async updateCoupon(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user?.id;

            // Only admins can update coupons
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const coupon = await this.couponService.updateCoupon(id, {
                ...updateData,
                updatedBy
            });

            if (!coupon) {
                return this.sendError(res, 'Coupon not found', 404);
            }

            return this.sendSuccess(res, coupon, 'Coupon updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update coupon');
        }
    }

    /**
     * Delete coupon
     */
    async deleteCoupon(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user?.id;

            // Only admins can delete coupons
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const result = await this.couponService.deleteCoupon(id, deletedBy);

            if (!result) {
                return this.sendError(res, 'Coupon not found', 404);
            }

            return this.sendSuccess(res, null, 'Coupon deleted successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to delete coupon');
        }
    }

    /**
     * Validate coupon
     */
    async validateCoupon(req, res) {
        try {
            const { code } = req.params;
            const { eventId, userId } = req.body;

            const validation = await this.couponService.validateCoupon(code, eventId, userId);
            return this.sendSuccess(res, validation, 'Coupon validation completed');
        } catch (error) {
            return this.handleError(res, error, 'Failed to validate coupon');
        }
    }

    /**
     * Use/redeem coupon
     */
    async useCoupon(req, res) {
        try {
            const { code } = req.params;
            const { eventId } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                return this.sendError(res, 'User authentication required', 401);
            }

            const usage = await this.couponService.useCoupon(code, eventId, userId);
            return this.sendSuccess(res, usage, 'Coupon redeemed successfully', 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to redeem coupon');
        }
    }

    /**
     * Get coupon usage statistics
     */
    async getCouponStats(req, res) {
        try {
            const { id } = req.params;

            // Only admins can view coupon stats
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const stats = await this.couponService.getCouponStats(id);

            if (!stats) {
                return this.sendError(res, 'Coupon not found', 404);
            }

            return this.sendSuccess(res, stats, 'Coupon statistics retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get coupon statistics');
        }
    }

    /**
     * Get coupon usage history
     */
    async getCouponUsageHistory(req, res) {
        try {
            const { id } = req.params;
            const query = req.query;

            // Only admins can view usage history
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const history = await this.couponService.getCouponUsageHistory(id, query);
            return this.sendSuccess(res, history, 'Coupon usage history retrieved successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to get coupon usage history');
        }
    }

    /**
     * Generate bulk coupons
     */
    async generateBulkCoupons(req, res) {
        try {
            const { count, template } = req.body;
            const createdBy = req.user?.id;

            // Only admins can generate bulk coupons
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!count || count <= 0) {
                return this.sendError(res, 'Valid count is required', 400);
            }

            const coupons = await this.couponService.generateBulkCoupons(count, template, createdBy);
            return this.sendSuccess(res, coupons, `${count} coupons generated successfully`, 201);
        } catch (error) {
            return this.handleError(res, error, 'Failed to generate bulk coupons');
        }
    }

    /**
     * Update coupon status
     */
    async updateCouponStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedBy = req.user?.id;

            // Only admins can update coupon status
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            if (!status) {
                return this.sendError(res, 'Status is required', 400);
            }

            const coupon = await this.couponService.updateCouponStatus(id, status, updatedBy);

            if (!coupon) {
                return this.sendError(res, 'Coupon not found', 404);
            }

            return this.sendSuccess(res, coupon, 'Coupon status updated successfully');
        } catch (error) {
            return this.handleError(res, error, 'Failed to update coupon status');
        }
    }

    /**
     * Export coupon data
     */
    async exportCoupons(req, res) {
        try {
            const query = req.query;
            const { format = 'json' } = query;

            // Only admins can export coupon data
            if (req.user?.role !== 'admin') {
                return this.sendError(res, 'Insufficient permissions', 403);
            }

            const exportData = await this.couponService.exportCoupons(query, format);

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=coupons.csv');
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=coupons.json');
            }

            return res.send(exportData);
        } catch (error) {
            return this.handleError(res, error, 'Failed to export coupons');
        }
    }
}
