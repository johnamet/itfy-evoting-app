#!/usr/bin/env node
/**
 * Coupon Routes
 * 
 * Defines API endpoints for coupon management operations.
 */

import express from 'express';
import CouponController from '../controllers/CouponController.js';
import { 
    optionalAuth, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete,
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const couponController = new CouponController();

// Coupon CRUD operations
router.post('/', requireCreate, (req, res) => couponController.createCoupon(req, res));
router.get('/', requireRead, (req, res) => couponController.getCoupons(req, res));
router.get('/:id', optionalAuth, (req, res) => couponController.getCouponById(req, res));
router.get('/code/:code', optionalAuth, (req, res) => couponController.getCouponByCode(req, res));
router.put('/:id', requireUpdate, (req, res) => couponController.updateCoupon(req, res));
router.delete('/:id', requireDelete, (req, res) => couponController.deleteCoupon(req, res));

// Coupon operations
router.post('/validate/:code', optionalAuth, (req, res) => couponController.validateCoupon(req, res));
router.post('/use/:code', requireRead, (req, res) => couponController.useCoupon(req, res)); // Users can use coupons
router.get('/:id/stats', requireRead, (req, res) => couponController.getCouponStats(req, res));
router.get('/:id/usage-history', requireRead, (req, res) => couponController.getCouponUsageHistory(req, res));

// Bulk operations (admin only)
router.post('/generate-bulk', requireLevel(3), (req, res) => couponController.generateBulkCoupons(req, res));

// Status operations
router.patch('/:id/status', requireUpdate, (req, res) => couponController.updateCouponStatus(req, res));

// Export operations (admin only)
router.get('/export/data', requireLevel(3), (req, res) => couponController.exportCoupons(req, res));

export default router;
