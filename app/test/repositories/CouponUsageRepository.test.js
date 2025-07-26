#!/usr/bin/env node
/**
 * CouponUsage Repository test suite
 * This file contains tests for the CouponUsageRepository class, ensuring that it correctly tracks and analyzes coupon usage.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import CouponUsageRepository from '../../repositories/CouponUsageRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('CouponUsageRepository', () => {
    let couponUsageRepository;
    let sandbox;
    let couponUsage;
    let couponId;
    let eventId;
    let categoryIds;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        couponUsageRepository = new CouponUsageRepository();
        
        couponId = new mongoose.Types.ObjectId();
        eventId = new mongoose.Types.ObjectId();
        categoryIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        
        couponUsage = {
            _id: new mongoose.Types.ObjectId(),
            coupon: couponId,
            orderAmount: 100.00,
            discountAmount: 20.00,
            finalAmount: 80.00,
            usageDate: new Date(),
            event: eventId,
            categories: categoryIds,
            metadata: {
                userAgent: 'Mozilla/5.0',
                ipAddress: '192.168.1.1'
            }
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Record coupon usage', () => {
        it('should record a new coupon usage', async () => {
            sandbox.stub(couponUsageRepository, 'recordUsage').resolves(couponUsage);
            
            const result = await couponUsageRepository.recordUsage(couponUsage);
            
            expect(result).to.have.property('_id');
            expect(result.coupon).to.equal(couponId);
            expect(result.orderAmount).to.equal(100.00);
            expect(result.discountAmount).to.equal(20.00);
            expect(result.finalAmount).to.equal(80.00);
        });

        it('should record usage with minimal required data', async () => {
            const minimalUsage = {
                _id: new mongoose.Types.ObjectId(),
                coupon: couponId,
                orderAmount: 50.00,
                discountAmount: 10.00,
                finalAmount: 40.00,
                usageDate: new Date()
            };
            
            sandbox.stub(couponUsageRepository, 'recordUsage').resolves(minimalUsage);
            
            const result = await couponUsageRepository.recordUsage(minimalUsage);
            
            expect(result).to.have.property('_id');
            expect(result.coupon).to.equal(couponId);
            expect(result.orderAmount).to.equal(50.00);
        });

        it('should handle recording with metadata', async () => {
            const usageWithMetadata = {
                ...couponUsage,
                metadata: {
                    platform: 'web',
                    source: 'email_campaign',
                    campaignId: 'summer2024'
                }
            };
            
            sandbox.stub(couponUsageRepository, 'recordUsage').resolves(usageWithMetadata);
            
            const result = await couponUsageRepository.recordUsage(usageWithMetadata);
            
            expect(result.metadata).to.have.property('platform', 'web');
            expect(result.metadata).to.have.property('source', 'email_campaign');
            expect(result.metadata).to.have.property('campaignId', 'summer2024');
        });
    });

    describe('Get coupon usage count', () => {
        it('should return correct usage count for a coupon', async () => {
            sandbox.stub(couponUsageRepository, 'getCouponUsageCount').resolves(15);
            
            const result = await couponUsageRepository.getCouponUsageCount(couponId);
            
            expect(result).to.equal(15);
        });

        it('should return zero for unused coupon', async () => {
            const unusedCouponId = new mongoose.Types.ObjectId();
            sandbox.stub(couponUsageRepository, 'getCouponUsageCount').resolves(0);
            
            const result = await couponUsageRepository.getCouponUsageCount(unusedCouponId);
            
            expect(result).to.equal(0);
        });

        it('should handle invalid coupon ID', async () => {
            sandbox.stub(couponUsageRepository, 'getCouponUsageCount').throws(new Error('Invalid ObjectId'));
            
            try {
                await couponUsageRepository.getCouponUsageCount('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });
    });

    describe('Get coupon usage statistics', () => {
        it('should return comprehensive usage statistics', async () => {
            const mockStats = {
                totalUsages: 25,
                totalDiscountGiven: 450.50,
                avgDiscountPerUse: 18.02,
                totalOrderAmount: 2500.00,
                avgOrderAmount: 100.00
            };
            
            sandbox.stub(couponUsageRepository, 'getCouponUsageStats').resolves(mockStats);
            
            const result = await couponUsageRepository.getCouponUsageStats(couponId);
            
            expect(result).to.have.property('totalUsages', 25);
            expect(result).to.have.property('totalDiscountGiven', 450.50);
            expect(result).to.have.property('avgDiscountPerUse', 18.02);
            expect(result).to.have.property('totalOrderAmount', 2500.00);
            expect(result).to.have.property('avgOrderAmount', 100.00);
        });

        it('should return default statistics for unused coupon', async () => {
            const defaultStats = {
                totalUsages: 0,
                totalDiscountGiven: 0,
                avgDiscountPerUse: 0,
                totalOrderAmount: 0,
                avgOrderAmount: 0
            };
            
            sandbox.stub(couponUsageRepository, 'getCouponUsageStats').resolves(defaultStats);
            
            const result = await couponUsageRepository.getCouponUsageStats(new mongoose.Types.ObjectId());
            
            expect(result.totalUsages).to.equal(0);
            expect(result.totalDiscountGiven).to.equal(0);
            expect(result.avgDiscountPerUse).to.equal(0);
        });

        it('should handle aggregation pipeline correctly', async () => {
            const complexStats = {
                totalUsages: 100,
                totalDiscountGiven: 1250.75,
                avgDiscountPerUse: 12.51,
                totalOrderAmount: 8500.00,
                avgOrderAmount: 85.00
            };
            
            sandbox.stub(couponUsageRepository, 'getCouponUsageStats').resolves(complexStats);
            
            const result = await couponUsageRepository.getCouponUsageStats(couponId);
            
            expect(result.totalUsages).to.be.a('number');
            expect(result.totalDiscountGiven).to.be.a('number');
            expect(result.avgDiscountPerUse).to.be.a('number');
        });
    });

    describe('Get coupon usage history', () => {
        it('should return usage history in reverse chronological order', async () => {
            const usageHistory = [
                { ...couponUsage, usageDate: new Date('2024-01-03') },
                { ...couponUsage, _id: new mongoose.Types.ObjectId(), usageDate: new Date('2024-01-02') },
                { ...couponUsage, _id: new mongoose.Types.ObjectId(), usageDate: new Date('2024-01-01') }
            ];
            
            sandbox.stub(couponUsageRepository, 'getCouponUsageHistory').resolves(usageHistory);
            
            const result = await couponUsageRepository.getCouponUsageHistory(couponId);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(3);
            expect(result[0].usageDate).to.be.greaterThan(result[1].usageDate);
            expect(result[1].usageDate).to.be.greaterThan(result[2].usageDate);
        });

        it('should return empty array for unused coupon', async () => {
            sandbox.stub(couponUsageRepository, 'getCouponUsageHistory').resolves([]);
            
            const result = await couponUsageRepository.getCouponUsageHistory(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle pagination options', async () => {
            const paginatedHistory = [
                { ...couponUsage, usageDate: new Date('2024-01-05') },
                { ...couponUsage, _id: new mongoose.Types.ObjectId(), usageDate: new Date('2024-01-04') }
            ];
            
            sandbox.stub(couponUsageRepository, 'getCouponUsageHistory').resolves(paginatedHistory);
            
            const options = { limit: 2, skip: 0 };
            const result = await couponUsageRepository.getCouponUsageHistory(couponId, options);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
        });

        it('should include populated user, event, and category data', async () => {
            const populatedHistory = [
                {
                    ...couponUsage,
                    user: { _id: new mongoose.Types.ObjectId(), name: 'John Doe', email: 'john@example.com' },
                    event: { _id: eventId, name: 'Summer Sale 2024' },
                    categories: [
                        { _id: categoryIds[0], name: 'Electronics' },
                        { _id: categoryIds[1], name: 'Clothing' }
                    ]
                }
            ];
            
            sandbox.stub(couponUsageRepository, 'getCouponUsageHistory').resolves(populatedHistory);
            
            const result = await couponUsageRepository.getCouponUsageHistory(couponId);
            
            expect(result[0]).to.have.property('user');
            expect(result[0].user).to.have.property('name', 'John Doe');
            expect(result[0]).to.have.property('event');
            expect(result[0].event).to.have.property('name', 'Summer Sale 2024');
            expect(result[0].categories).to.be.an('array');
            expect(result[0].categories[0]).to.have.property('name', 'Electronics');
        });
    });

    describe('Get usage statistics by date range', () => {
        it('should return daily statistics for date range', async () => {
            const dateRangeStats = [
                {
                    date: '2024-01-01',
                    dailyUsages: 5,
                    dailyDiscountTotal: 100.00,
                    dailyOrderTotal: 500.00
                },
                {
                    date: '2024-01-02',
                    dailyUsages: 8,
                    dailyDiscountTotal: 160.00,
                    dailyOrderTotal: 800.00
                },
                {
                    date: '2024-01-03',
                    dailyUsages: 3,
                    dailyDiscountTotal: 60.00,
                    dailyOrderTotal: 300.00
                }
            ];
            
            sandbox.stub(couponUsageRepository, 'getUsageStatsByDateRange').resolves(dateRangeStats);
            
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-03');
            const result = await couponUsageRepository.getUsageStatsByDateRange(startDate, endDate);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(3);
            expect(result[0]).to.have.property('date', '2024-01-01');
            expect(result[0]).to.have.property('dailyUsages', 5);
            expect(result[0]).to.have.property('dailyDiscountTotal', 100.00);
            expect(result[0]).to.have.property('dailyOrderTotal', 500.00);
        });

        it('should return empty array for date range with no usage', async () => {
            sandbox.stub(couponUsageRepository, 'getUsageStatsByDateRange').resolves([]);
            
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-07');
            const result = await couponUsageRepository.getUsageStatsByDateRange(startDate, endDate);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle single day date range', async () => {
            const singleDayStats = [
                {
                    date: '2024-01-15',
                    dailyUsages: 12,
                    dailyDiscountTotal: 240.00,
                    dailyOrderTotal: 1200.00
                }
            ];
            
            sandbox.stub(couponUsageRepository, 'getUsageStatsByDateRange').resolves(singleDayStats);
            
            const singleDate = new Date('2024-01-15');
            const result = await couponUsageRepository.getUsageStatsByDateRange(singleDate, singleDate);
            
            expect(result).to.have.length(1);
            expect(result[0].date).to.equal('2024-01-15');
            expect(result[0].dailyUsages).to.equal(12);
        });

        it('should return results sorted by date', async () => {
            const sortedStats = [
                { date: '2024-01-01', dailyUsages: 5, dailyDiscountTotal: 100.00, dailyOrderTotal: 500.00 },
                { date: '2024-01-02', dailyUsages: 8, dailyDiscountTotal: 160.00, dailyOrderTotal: 800.00 },
                { date: '2024-01-03', dailyUsages: 3, dailyDiscountTotal: 60.00, dailyOrderTotal: 300.00 }
            ];
            
            sandbox.stub(couponUsageRepository, 'getUsageStatsByDateRange').resolves(sortedStats);
            
            const result = await couponUsageRepository.getUsageStatsByDateRange(new Date('2024-01-01'), new Date('2024-01-03'));
            
            expect(result[0].date).to.equal('2024-01-01');
            expect(result[1].date).to.equal('2024-01-02');
            expect(result[2].date).to.equal('2024-01-03');
        });
    });

    describe('Get top performing coupons', () => {
        it('should return top performing coupons ordered by usage', async () => {
            const topCoupons = [
                {
                    couponId: new mongoose.Types.ObjectId(),
                    totalUsages: 150,
                    totalDiscountGiven: 3000.00,
                    totalOrderAmount: 15000.00
                },
                {
                    couponId: new mongoose.Types.ObjectId(),
                    totalUsages: 120,
                    totalDiscountGiven: 2400.00,
                    totalOrderAmount: 12000.00
                },
                {
                    couponId: new mongoose.Types.ObjectId(),
                    totalUsages: 100,
                    totalDiscountGiven: 2000.00,
                    totalOrderAmount: 10000.00
                }
            ];
            
            sandbox.stub(couponUsageRepository, 'getTopPerformingCoupons').resolves(topCoupons);
            
            const result = await couponUsageRepository.getTopPerformingCoupons(3);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(3);
            expect(result[0].totalUsages).to.be.greaterThan(result[1].totalUsages);
            expect(result[1].totalUsages).to.be.greaterThan(result[2].totalUsages);
        });

        it('should return default limit of 10 coupons', async () => {
            const defaultTopCoupons = Array.from({ length: 10 }, (_, i) => ({
                couponId: new mongoose.Types.ObjectId(),
                totalUsages: 100 - i * 5,
                totalDiscountGiven: (100 - i * 5) * 20,
                totalOrderAmount: (100 - i * 5) * 100
            }));
            
            sandbox.stub(couponUsageRepository, 'getTopPerformingCoupons').resolves(defaultTopCoupons);
            
            const result = await couponUsageRepository.getTopPerformingCoupons();
            
            expect(result).to.have.length(10);
        });

        it('should return empty array if no coupons have been used', async () => {
            sandbox.stub(couponUsageRepository, 'getTopPerformingCoupons').resolves([]);
            
            const result = await couponUsageRepository.getTopPerformingCoupons();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should include populated coupon details', async () => {
            const topCouponsWithDetails = [
                {
                    couponId: {
                        _id: new mongoose.Types.ObjectId(),
                        code: 'SAVE20',
                        discountType: 'percentage',
                        discountValue: 20
                    },
                    totalUsages: 150,
                    totalDiscountGiven: 3000.00,
                    totalOrderAmount: 15000.00
                }
            ];
            
            sandbox.stub(couponUsageRepository, 'getTopPerformingCoupons').resolves(topCouponsWithDetails);
            
            const result = await couponUsageRepository.getTopPerformingCoupons(1);
            
            expect(result[0]).to.have.property('couponId');
            expect(result[0].couponId).to.have.property('code', 'SAVE20');
            expect(result[0].couponId).to.have.property('discountType', 'percentage');
            expect(result[0].couponId).to.have.property('discountValue', 20);
        });

        it('should handle custom limit parameter', async () => {
            const limitedCoupons = [
                {
                    couponId: new mongoose.Types.ObjectId(),
                    totalUsages: 200,
                    totalDiscountGiven: 4000.00,
                    totalOrderAmount: 20000.00
                },
                {
                    couponId: new mongoose.Types.ObjectId(),
                    totalUsages: 150,
                    totalDiscountGiven: 3000.00,
                    totalOrderAmount: 15000.00
                }
            ];
            
            sandbox.stub(couponUsageRepository, 'getTopPerformingCoupons').resolves(limitedCoupons);
            
            const result = await couponUsageRepository.getTopPerformingCoupons(2);
            
            expect(result).to.have.length(2);
        });
    });

    describe('Error handling', () => {
        it('should handle database errors in recordUsage', async () => {
            sandbox.stub(couponUsageRepository, 'recordUsage').throws(new Error('Database connection error'));
            
            try {
                await couponUsageRepository.recordUsage(couponUsage);
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle invalid ObjectId in getCouponUsageCount', async () => {
            sandbox.stub(couponUsageRepository, 'getCouponUsageCount').throws(new Error('Invalid ObjectId format'));
            
            try {
                await couponUsageRepository.getCouponUsageCount('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });

        it('should handle aggregation pipeline errors', async () => {
            sandbox.stub(couponUsageRepository, 'getCouponUsageStats').throws(new Error('Aggregation pipeline failed'));
            
            try {
                await couponUsageRepository.getCouponUsageStats(couponId);
            } catch (error) {
                expect(error.message).to.include('Aggregation pipeline failed');
            }
        });

        it('should handle date range validation errors', async () => {
            sandbox.stub(couponUsageRepository, 'getUsageStatsByDateRange').throws(new Error('Invalid date range'));
            
            try {
                await couponUsageRepository.getUsageStatsByDateRange('invalid-date', 'invalid-date');
            } catch (error) {
                expect(error.message).to.include('Invalid date range');
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle zero amounts in usage data', async () => {
            const zeroAmountUsage = {
                _id: new mongoose.Types.ObjectId(),
                coupon: couponId,
                orderAmount: 0.00,
                discountAmount: 0.00,
                finalAmount: 0.00,
                usageDate: new Date()
            };
            
            sandbox.stub(couponUsageRepository, 'recordUsage').resolves(zeroAmountUsage);
            
            const result = await couponUsageRepository.recordUsage(zeroAmountUsage);
            
            expect(result.orderAmount).to.equal(0.00);
            expect(result.discountAmount).to.equal(0.00);
            expect(result.finalAmount).to.equal(0.00);
        });

        it('should handle future dates in date range queries', async () => {
            sandbox.stub(couponUsageRepository, 'getUsageStatsByDateRange').resolves([]);
            
            const futureStart = new Date('2025-12-01');
            const futureEnd = new Date('2025-12-31');
            const result = await couponUsageRepository.getUsageStatsByDateRange(futureStart, futureEnd);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle very large discount amounts', async () => {
            const largeDiscountUsage = {
                _id: new mongoose.Types.ObjectId(),
                coupon: couponId,
                orderAmount: 10000.00,
                discountAmount: 5000.00,
                finalAmount: 5000.00,
                usageDate: new Date()
            };
            
            sandbox.stub(couponUsageRepository, 'recordUsage').resolves(largeDiscountUsage);
            
            const result = await couponUsageRepository.recordUsage(largeDiscountUsage);
            
            expect(result.discountAmount).to.equal(5000.00);
            expect(result.orderAmount).to.equal(10000.00);
        });

        it('should handle usage without optional fields', async () => {
            const minimalUsage = {
                _id: new mongoose.Types.ObjectId(),
                coupon: couponId,
                orderAmount: 100.00,
                discountAmount: 20.00,
                finalAmount: 80.00,
                usageDate: new Date()
                // No event, categories, or metadata
            };
            
            sandbox.stub(couponUsageRepository, 'recordUsage').resolves(minimalUsage);
            
            const result = await couponUsageRepository.recordUsage(minimalUsage);
            
            expect(result).to.have.property('coupon');
            expect(result).to.have.property('orderAmount');
            expect(result).to.have.property('discountAmount');
            expect(result).to.not.have.property('event');
            expect(result).to.not.have.property('categories');
        });
    });
});
