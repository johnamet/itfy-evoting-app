#!/usr/bin/env node
/**
 * Coupon Routes
 * 
 * @module routes/v1/coupons
 */

import express from 'express';
import CouponController from '../../controllers/CouponController.js';
import { requireLevel } from '../../middleware/auth.js';

const router = express.Router();
const couponController = new CouponController();

// ===== Public Routes =====

/**
 * @route POST /api/v1/coupons/validate
 * @desc Validate coupon code
 * @access Public
 */
router.post('/validate', (req, res) => couponController.validateCoupon(req, res));

/**
 * @route GET /api/v1/coupons/:code
 * @desc Get coupon details by code
 * @access Public
 */
router.get('/:code', (req, res) => couponController.getCouponByCode(req, res));

// ===== Admin Routes =====

/**
 * @route GET /api/v1/coupons/admin/all
 * @desc Get all coupons
 * @access Private (Event Manager - Level 3+)
 */
router.get('/admin/all', requireLevel(3), (req, res) => couponController.getAllCoupons(req, res));

/**
 * @route GET /api/v1/coupons/admin/statistics
 * @desc Get coupon statistics
 * @access Private (Event Manager - Level 3+)
 */
router.get('/admin/statistics', requireLevel(3), (req, res) => couponController.getCouponStatistics(req, res));

/**
 * @route POST /api/v1/coupons
 * @desc Create new coupon
 * @access Private (Event Manager - Level 3+)
 */
router.post('/', requireLevel(3), (req, res) => couponController.createCoupon(req, res));

/**
 * @route PUT /api/v1/coupons/:id
 * @desc Update coupon
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id', requireLevel(3), (req, res) => couponController.updateCoupon(req, res));

/**
 * @route PUT /api/v1/coupons/:id/status
 * @desc Update coupon status
 * @access Private (Event Manager - Level 3+)
 */
router.put('/:id/status', requireLevel(3), (req, res) => couponController.updateCouponStatus(req, res));

/**
 * @route DELETE /api/v1/coupons/:id
 * @desc Delete coupon
 * @access Private (Super Admin - Level 4+)
 */
router.delete('/:id', requireLevel(4), (req, res) => couponController.deleteCoupon(req, res));

/**
 * @route GET /api/v1/coupons/:id/usage
 * @desc Get coupon usage history
 * @access Private (Event Manager - Level 3+)
 */
router.get('/:id/usage', requireLevel(3), (req, res) => couponController.getCouponUsage(req, res));

/**
 * @route GET /api/v1/coupons/event/:eventId
 * @desc Get coupons by event
 * @access Private (Event Manager - Level 3+)
 */
router.get('/event/:eventId', requireLevel(3), (req, res) => couponController.getCouponsByEvent(req, res));

export default router;
