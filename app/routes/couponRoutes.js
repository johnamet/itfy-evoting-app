#!/usr/bin/env node
/**
 * Coupon Routes
 * 
 * Defines API endpoints for coupon management operations.
 */

import express from 'express';
import CouponController from '../controllers/CouponController.js';
import { 
    authenticate,
    optionalAuth, 
    requireLevel 
} from '../middleware/auth.js';

const router = express.Router();
const couponController = new CouponController();

router.get('/:id', optionalAuth, (req, res) => couponController.getCouponById(req, res));
router.get('/code/:code', optionalAuth, (req, res) => couponController.getCouponByCode(req, res));
router.post('/validate/:code', optionalAuth, (req, res) => couponController.validateCoupon(req, res));
router.post('/use/:code', (req, res) => couponController.useCoupon(req, res)); // Users can use coupons

router.use(authenticate)
// Coupon CRUD operations
router.post('/', requireLevel(3), (req, res) => couponController.createCoupon(req, res));
router.get('/', requireLevel(1), (req, res) => couponController.getCoupons(req, res));
router.put('/:id', requireLevel(2), (req, res) => couponController.updateCoupon(req, res));
router.delete('/:id', requireLevel(4), (req, res) => couponController.deleteCoupon(req, res));

// Coupon operations
router.get('/:id/stats', requireLevel(1), (req, res) => couponController.getCouponStats(req, res));
router.get('/:id/usage-history', requireLevel(1), (req, res) => couponController.getCouponUsageHistory(req, res));

// Bulk operations (admin only)
router.post('/generate-bulk', requireLevel(3), (req, res) => couponController.generateBulkCoupons(req, res));

// Status operations
router.patch('/:id/status', requireLevel(2), (req, res) => couponController.updateCouponStatus(req, res));

// Export operations (admin only)
router.get('/export/data', requireLevel(3), (req, res) => couponController.exportCoupons(req, res));

export default router;
