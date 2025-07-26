#!/usr/bin/env node
/**
 * Coupon Repository test suite
 * This file contains tests for the CouponRepository class, ensuring that it correctly interacts with the Coupon model.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import CouponRepository from '../../repositories/CouponRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('CouponRepository', () => {
    let couponRepository;
    let sandbox;
    let coupon;
    let eventId;
    let categoryIds;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        couponRepository = new CouponRepository();
        
        eventId = new mongoose.Types.ObjectId();
        categoryIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        
        coupon = {
            _id: new mongoose.Types.ObjectId(),
            code: 'SAVE20',
            discount: 20,
            discountType: 'percentage',
            expiryDate: new Date(Date.now() + 86400000), // Tomorrow
            isActive: true,
            eventApplicable: eventId,
            categoriesApplicable: categoryIds,
            maxUses: 100,
            usedCount: 5,
            minOrderAmount: 50,
            maxDiscountAmount: 100
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Find coupon by code', () => {
        it('should find a coupon by code (case insensitive)', async () => {
            sandbox.stub(couponRepository, 'findByCode').resolves(coupon);
            
            const result = await couponRepository.findByCode('save20');
            
            expect(result).to.have.property('_id');
            expect(result.code).to.equal('SAVE20');
            expect(result.discount).to.equal(20);
        });

        it('should return null if coupon code not found', async () => {
            sandbox.stub(couponRepository, 'findByCode').resolves(null);
            
            const result = await couponRepository.findByCode('NONEXISTENT');
            
            expect(result).to.be.null;
        });

        it('should handle code with whitespace by trimming', async () => {
            sandbox.stub(couponRepository, 'findByCode').resolves(coupon);
            
            const result = await couponRepository.findByCode('  save20  ');
            
            expect(result).to.not.be.null;
            expect(result.code).to.equal('SAVE20');
        });
    });

    describe('Validate coupon', () => {
        it('should validate a valid active coupon', async () => {
            sandbox.stub(couponRepository, 'validateCoupon').resolves({
                isValid: true,
                coupon: coupon
            });
            
            const result = await couponRepository.validateCoupon('SAVE20');
            
            expect(result.isValid).to.be.true;
            expect(result.coupon.code).to.equal('SAVE20');
            expect(result).to.not.have.property('error');
        });

        it('should return invalid if coupon not found', async () => {
            sandbox.stub(couponRepository, 'validateCoupon').resolves({
                isValid: false,
                error: 'Coupon not found',
                coupon: null
            });
            
            const result = await couponRepository.validateCoupon('NOTFOUND');
            
            expect(result.isValid).to.be.false;
            expect(result.error).to.equal('Coupon not found');
            expect(result.coupon).to.be.null;
        });

        it('should return invalid if coupon is not active', async () => {
            const inactiveCoupon = { ...coupon, isActive: false };
            sandbox.stub(couponRepository, 'validateCoupon').resolves({
                isValid: false,
                error: 'Coupon is not active',
                coupon: inactiveCoupon
            });
            
            const result = await couponRepository.validateCoupon('SAVE20');
            
            expect(result.isValid).to.be.false;
            expect(result.error).to.equal('Coupon is not active');
        });

        it('should return invalid if coupon has expired', async () => {
            const expiredCoupon = { ...coupon, expiryDate: new Date(Date.now() - 86400000) }; // Yesterday
            sandbox.stub(couponRepository, 'validateCoupon').resolves({
                isValid: false,
                error: 'Coupon has expired',
                coupon: expiredCoupon
            });
            
            const result = await couponRepository.validateCoupon('SAVE20');
            
            expect(result.isValid).to.be.false;
            expect(result.error).to.equal('Coupon has expired');
        });

        it('should return invalid if usage limit reached', async () => {
            const maxUsedCoupon = { ...coupon, usedCount: 100, maxUses: 100 };
            sandbox.stub(couponRepository, 'validateCoupon').resolves({
                isValid: false,
                error: 'Coupon usage limit reached',
                coupon: maxUsedCoupon
            });
            
            const result = await couponRepository.validateCoupon('SAVE20');
            
            expect(result.isValid).to.be.false;
            expect(result.error).to.equal('Coupon usage limit reached');
        });

        it('should indicate minimum order requirement when applicable', async () => {
            sandbox.stub(couponRepository, 'validateCoupon').resolves({
                isValid: true,
                coupon: coupon,
                requiresMinimumOrder: true,
                minOrderAmount: 50
            });
            
            const result = await couponRepository.validateCoupon('SAVE20');
            
            expect(result.isValid).to.be.true;
            expect(result.requiresMinimumOrder).to.be.true;
            expect(result.minOrderAmount).to.equal(50);
        });
    });

    describe('Apply coupon', () => {
        it('should apply percentage discount correctly', async () => {
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: true,
                coupon: coupon,
                discountAmount: 20.00, // 20% of 100
                finalAmount: 80.00
            });
            
            const result = await couponRepository.applyCoupon('SAVE20', 100);
            
            expect(result.isValid).to.be.true;
            expect(result.discountAmount).to.equal(20.00);
            expect(result.finalAmount).to.equal(80.00);
        });

        it('should apply fixed discount correctly', async () => {
            const fixedCoupon = { ...coupon, discountType: 'fixed', discount: 15 };
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: true,
                coupon: fixedCoupon,
                discountAmount: 15.00,
                finalAmount: 85.00
            });
            
            const result = await couponRepository.applyCoupon('FIXED15', 100);
            
            expect(result.isValid).to.be.true;
            expect(result.discountAmount).to.equal(15.00);
            expect(result.finalAmount).to.equal(85.00);
        });

        it('should limit fixed discount to order amount', async () => {
            const fixedCoupon = { ...coupon, discountType: 'fixed', discount: 150 };
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: true,
                coupon: fixedCoupon,
                discountAmount: 100.00, // Limited to order amount
                finalAmount: 0.00
            });
            
            const result = await couponRepository.applyCoupon('BIGDISCOUNT', 100);
            
            expect(result.isValid).to.be.true;
            expect(result.discountAmount).to.equal(100.00);
            expect(result.finalAmount).to.equal(0.00);
        });

        it('should limit percentage discount by maxDiscountAmount', async () => {
            const limitedCoupon = { ...coupon, discount: 50, maxDiscountAmount: 25 }; // 50% but max $25
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: true,
                coupon: limitedCoupon,
                discountAmount: 25.00, // Limited by maxDiscountAmount
                finalAmount: 75.00
            });
            
            const result = await couponRepository.applyCoupon('LIMITED50', 100);
            
            expect(result.isValid).to.be.true;
            expect(result.discountAmount).to.equal(25.00);
            expect(result.finalAmount).to.equal(75.00);
        });

        it('should reject if minimum order amount not met', async () => {
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: false,
                error: 'Minimum order amount of 50 required',
                coupon: coupon
            });
            
            const result = await couponRepository.applyCoupon('SAVE20', 30); // Below minimum of 50
            
            expect(result.isValid).to.be.false;
            expect(result.error).to.include('Minimum order amount of 50 required');
        });

        it('should return validation error if coupon is invalid', async () => {
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: false,
                error: 'Coupon has expired',
                coupon: null
            });
            
            const result = await couponRepository.applyCoupon('EXPIRED', 100);
            
            expect(result.isValid).to.be.false;
            expect(result.error).to.equal('Coupon has expired');
        });
    });

    describe('Create coupon', () => {
        it('should create a new coupon with valid data', async () => {
            const couponData = {
                code: 'new20',
                discount: 20,
                discountType: 'percentage',
                expiryDate: new Date(Date.now() + 86400000),
                eventApplicable: eventId,
                categoriesApplicable: categoryIds
            };
            
            const expectedCoupon = { ...couponData, code: 'NEW20', _id: new mongoose.Types.ObjectId() };
            sandbox.stub(couponRepository, 'createCoupon').resolves(expectedCoupon);
            
            const result = await couponRepository.createCoupon(couponData);
            
            expect(result).to.have.property('_id');
            expect(result.code).to.equal('NEW20'); // Should be uppercase
            expect(result.discount).to.equal(20);
        });

        it('should throw error if coupon code already exists', async () => {
            const couponData = { code: 'SAVE20', discount: 15 };
            
            sandbox.stub(couponRepository, 'createCoupon').throws(new Error('Coupon code already exists'));
            
            try {
                await couponRepository.createCoupon(couponData);
            } catch (error) {
                expect(error.message).to.equal('Coupon code already exists');
            }
        });

        it('should convert code to uppercase and trim whitespace', async () => {
            const couponData = { code: '  test20  ', discount: 20 };
            const expectedCoupon = { ...couponData, code: 'TEST20', _id: new mongoose.Types.ObjectId() };
            
            sandbox.stub(couponRepository, 'createCoupon').resolves(expectedCoupon);
            
            const result = await couponRepository.createCoupon(couponData);
            
            expect(result.code).to.equal('TEST20');
        });
    });

    describe('Get active coupons', () => {
        it('should return only active and non-expired coupons', async () => {
            const activeCoupons = [
                coupon,
                { ...coupon, _id: new mongoose.Types.ObjectId(), code: 'ACTIVE30' }
            ];
            
            sandbox.stub(couponRepository, 'getActiveCoupons').resolves(activeCoupons);
            
            const result = await couponRepository.getActiveCoupons();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].isActive).to.be.true;
            expect(result[1].isActive).to.be.true;
        });

        it('should return empty array if no active coupons', async () => {
            sandbox.stub(couponRepository, 'getActiveCoupons').resolves([]);
            
            const result = await couponRepository.getActiveCoupons();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Get expired coupons', () => {
        it('should return only expired coupons', async () => {
            const expiredCoupons = [
                { ...coupon, expiryDate: new Date(Date.now() - 86400000), code: 'EXPIRED1' },
                { ...coupon, expiryDate: new Date(Date.now() - 172800000), code: 'EXPIRED2' }
            ];
            
            sandbox.stub(couponRepository, 'getExpiredCoupons').resolves(expiredCoupons);
            
            const result = await couponRepository.getExpiredCoupons();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].expiryDate).to.be.lessThan(new Date());
            expect(result[1].expiryDate).to.be.lessThan(new Date());
        });

        it('should return empty array if no expired coupons', async () => {
            sandbox.stub(couponRepository, 'getExpiredCoupons').resolves([]);
            
            const result = await couponRepository.getExpiredCoupons();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Get coupon statistics', () => {
        it('should return usage statistics for a coupon', async () => {
            const stats = {
                couponId: coupon._id,
                code: coupon.code,
                usedCount: 5,
                maxUses: 100,
                remainingUses: 95,
                isActive: true,
                expiryDate: coupon.expiryDate
            };
            
            sandbox.stub(couponRepository, 'getCouponStats').resolves(stats);
            
            const result = await couponRepository.getCouponStats(coupon._id);
            
            expect(result).to.have.property('couponId');
            expect(result.code).to.equal('SAVE20');
            expect(result.usedCount).to.equal(5);
            expect(result.maxUses).to.equal(100);
            expect(result.remainingUses).to.equal(95);
        });

        it('should handle unlimited use coupons (no maxUses)', async () => {
            const unlimitedStats = {
                couponId: coupon._id,
                code: coupon.code,
                usedCount: 10,
                maxUses: null,
                remainingUses: null,
                isActive: true,
                expiryDate: coupon.expiryDate
            };
            
            sandbox.stub(couponRepository, 'getCouponStats').resolves(unlimitedStats);
            
            const result = await couponRepository.getCouponStats(coupon._id);
            
            expect(result.maxUses).to.be.null;
            expect(result.remainingUses).to.be.null;
        });

        it('should throw error if coupon not found', async () => {
            sandbox.stub(couponRepository, 'getCouponStats').throws(new Error('Coupon not found'));
            
            try {
                await couponRepository.getCouponStats(new mongoose.Types.ObjectId());
            } catch (error) {
                expect(error.message).to.equal('Coupon not found');
            }
        });
    });

    describe('Deactivate expired coupons', () => {
        it('should deactivate all expired active coupons', async () => {
            const updateResult = { modifiedCount: 3, matchedCount: 3 };
            sandbox.stub(couponRepository, 'deactivateExpiredCoupons').resolves(updateResult);
            
            const result = await couponRepository.deactivateExpiredCoupons();
            
            expect(result).to.have.property('modifiedCount', 3);
            expect(result).to.have.property('matchedCount', 3);
        });

        it('should return zero counts if no expired coupons to deactivate', async () => {
            const updateResult = { modifiedCount: 0, matchedCount: 0 };
            sandbox.stub(couponRepository, 'deactivateExpiredCoupons').resolves(updateResult);
            
            const result = await couponRepository.deactivateExpiredCoupons();
            
            expect(result.modifiedCount).to.equal(0);
            expect(result.matchedCount).to.equal(0);
        });
    });

    describe('Generate unique coupon code', () => {
        it('should generate a unique code with default length', async () => {
            sandbox.stub(couponRepository, 'generateUniqueCode').resolves('ABC12345');
            
            const result = await couponRepository.generateUniqueCode();
            
            expect(result).to.be.a('string');
            expect(result).to.have.length(8);
            expect(result).to.equal('ABC12345');
        });

        it('should generate a unique code with custom length', async () => {
            sandbox.stub(couponRepository, 'generateUniqueCode').resolves('ABCD1234');
            
            const result = await couponRepository.generateUniqueCode(6);
            
            expect(result).to.be.a('string');
            expect(result).to.have.length(8); // Mocked response
        });

        it('should generate a unique code with prefix', async () => {
            sandbox.stub(couponRepository, 'generateUniqueCode').resolves('SUMMER2024ABC');
            
            const result = await couponRepository.generateUniqueCode(8, 'SUMMER2024');
            
            expect(result).to.be.a('string');
            expect(result).to.include('SUMMER2024');
        });

        it('should throw error if unable to generate unique code after max attempts', async () => {
            sandbox.stub(couponRepository, 'generateUniqueCode').throws(new Error('Unable to generate unique coupon code'));
            
            try {
                await couponRepository.generateUniqueCode();
            } catch (error) {
                expect(error.message).to.equal('Unable to generate unique coupon code');
            }
        });
    });

    describe('Bulk create coupons', () => {
        it('should create multiple coupons with provided codes', async () => {
            const couponsData = [
                { code: 'bulk1', discount: 10 },
                { code: 'bulk2', discount: 15 }
            ];
            
            const createdCoupons = [
                { ...couponsData[0], code: 'BULK1', _id: new mongoose.Types.ObjectId() },
                { ...couponsData[1], code: 'BULK2', _id: new mongoose.Types.ObjectId() }
            ];
            
            sandbox.stub(couponRepository, 'bulkCreateCoupons').resolves(createdCoupons);
            
            const result = await couponRepository.bulkCreateCoupons(couponsData);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].code).to.equal('BULK1');
            expect(result[1].code).to.equal('BULK2');
        });

        it('should generate codes for coupons without codes', async () => {
            const couponsData = [
                { discount: 10 }, // No code provided
                { discount: 15 }  // No code provided
            ];
            
            const createdCoupons = [
                { ...couponsData[0], code: 'GEN12345', _id: new mongoose.Types.ObjectId() },
                { ...couponsData[1], code: 'GEN67890', _id: new mongoose.Types.ObjectId() }
            ];
            
            sandbox.stub(couponRepository, 'bulkCreateCoupons').resolves(createdCoupons);
            
            const result = await couponRepository.bulkCreateCoupons(couponsData);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].code).to.equal('GEN12345');
            expect(result[1].code).to.equal('GEN67890');
        });

        it('should throw error if any coupon code already exists', async () => {
            const couponsData = [
                { code: 'SAVE20', discount: 10 }, // This already exists
                { code: 'NEW30', discount: 15 }
            ];
            
            sandbox.stub(couponRepository, 'bulkCreateCoupons').throws(new Error('Coupon code SAVE20 already exists'));
            
            try {
                await couponRepository.bulkCreateCoupons(couponsData);
            } catch (error) {
                expect(error.message).to.include('Coupon code SAVE20 already exists');
            }
        });
    });

    describe('Record usage (private method)', () => {
        it('should increment usage count when coupon is applied', async () => {
            // This is tested indirectly through applyCoupon
            const appliedCoupon = {
                isValid: true,
                coupon: { ...coupon, usedCount: 6 }, // Incremented from 5 to 6
                discountAmount: 20.00,
                finalAmount: 80.00
            };
            
            sandbox.stub(couponRepository, 'applyCoupon').resolves(appliedCoupon);
            
            const result = await couponRepository.applyCoupon('SAVE20', 100);
            
            expect(result.isValid).to.be.true;
            expect(result.coupon.usedCount).to.equal(6);
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully in findByCode', async () => {
            sandbox.stub(couponRepository, 'findByCode').throws(new Error('Database connection error'));
            
            try {
                await couponRepository.findByCode('SAVE20');
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle validation errors gracefully', async () => {
            sandbox.stub(couponRepository, 'validateCoupon').throws(new Error('Validation failed'));
            
            try {
                await couponRepository.validateCoupon('INVALID');
            } catch (error) {
                expect(error.message).to.include('Validation failed');
            }
        });

        it('should handle invalid ObjectIds gracefully', async () => {
            sandbox.stub(couponRepository, 'getCouponStats').throws(new Error('Invalid ObjectId'));
            
            try {
                await couponRepository.getCouponStats('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle zero order amount', async () => {
            sandbox.stub(couponRepository, 'applyCoupon').resolves({
                isValid: true,
                coupon: coupon,
                discountAmount: 0.00,
                finalAmount: 0.00
            });
            
            const result = await couponRepository.applyCoupon('SAVE20', 0);
            
            expect(result.isValid).to.be.true;
            expect(result.discountAmount).to.equal(0.00);
            expect(result.finalAmount).to.equal(0.00);
        });

        it('should handle coupon with no expiry date', async () => {
            const noExpiryValidation = {
                isValid: true,
                coupon: { ...coupon, expiryDate: null }
            };
            
            sandbox.stub(couponRepository, 'validateCoupon').resolves(noExpiryValidation);
            
            const result = await couponRepository.validateCoupon('NOEXPIRY');
            
            expect(result.isValid).to.be.true;
            expect(result.coupon.expiryDate).to.be.null;
        });

        it('should handle coupon with no usage limit', async () => {
            const unlimitedCoupon = { ...coupon, maxUses: null };
            const validation = {
                isValid: true,
                coupon: unlimitedCoupon
            };
            
            sandbox.stub(couponRepository, 'validateCoupon').resolves(validation);
            
            const result = await couponRepository.validateCoupon('UNLIMITED');
            
            expect(result.isValid).to.be.true;
            expect(result.coupon.maxUses).to.be.null;
        });

        it('should handle coupon with no minimum order amount', async () => {
            const noMinimumCoupon = { ...coupon, minOrderAmount: 0 };
            const validation = {
                isValid: true,
                coupon: noMinimumCoupon
            };
            
            sandbox.stub(couponRepository, 'validateCoupon').resolves(validation);
            
            const result = await couponRepository.validateCoupon('NOMINIMUM');
            
            expect(result.isValid).to.be.true;
            expect(result).to.not.have.property('requiresMinimumOrder');
        });
    });
});
