#!/usr/bin/env node
/**
 * Enhanced Payment Repository
 * 
 * Provides payment-specific database operations with intelligent caching.
 * 
 * @module PaymentRepository
 * @version 2.0.0
 */

import BaseRepository from '../BaseRepository.js';
import Payment from '../models/Payment.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

class PaymentRepository extends BaseRepository {
    constructor() {
        super(Payment, {
            enableCache: true,
            cacheManager: mainCacheManager,
        });
    }

    // ============================================
    // PAYMENT MANAGEMENT
    // ============================================

    /**
     * Create a new payment
     * @param {Object} paymentData - Payment data
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async createPayment(paymentData, options = {}) {
        try {
            this.validateRequiredFields(paymentData, [
                'user',
                'amount',
                'reference',
            ]);

            const payment = await this.create(paymentData, options);

            this.log('createPayment', { 
                paymentId: payment._id,
                reference: payment.reference,
            });

            return payment;
        } catch (error) {
            throw this.handleError(error, 'createPayment', { 
                reference: paymentData.reference,
            });
        }
    }

    /**
     * Update payment status
     * @param {String} paymentId - Payment ID
     * @param {String} status - Payment status
     * @param {Object} additionalData - Additional data to update
     * @returns {Promise<Object>}
     */
    async updatePaymentStatus(paymentId, status, additionalData = {}) {
        try {
            this.validateObjectId(paymentId, 'Payment ID');

            const updateData = {
                status,
                ...additionalData,
            };

            if (status === 'success') {
                updateData.paidAt = new Date();
            }

            const payment = await this.updateById(paymentId, updateData);

            this.log('updatePaymentStatus', { paymentId, status });

            return payment;
        } catch (error) {
            throw this.handleError(error, 'updatePaymentStatus', { paymentId, status });
        }
    }

    // ============================================
    // PAYMENT QUERIES
    // ============================================

    /**
     * Find payment by reference
     * @param {String} reference - Payment reference
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>}
     */
    async findByReference(reference, options = {}) {
        try {
            if (!reference) {
                throw new Error('Reference is required');
            }

            return await this.findOne(
                { reference },
                { ...options, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByReference', { reference });
        }
    }

    /**
     * Find payments by user
     * @param {String} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByUser(userId, options = {}) {
        try {
            this.validateObjectId(userId, 'User ID');

            return await this.find(
                { user: userId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByUser', { userId });
        }
    }

    /**
     * Find payments by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByEvent(eventId, options = {}) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.find(
                { event: eventId, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByEvent', { eventId });
        }
    }

    /**
     * Find payments by status
     * @param {String} status - Payment status
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findByStatus(status, options = {}) {
        try {
            return await this.find(
                { status, deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findByStatus', { status });
        }
    }

    /**
     * Find successful payments
     * @param {Object} filter - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findSuccessfulPayments(filter = {}, options = {}) {
        try {
            return await this.find(
                { ...filter, status: 'success', deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findSuccessfulPayments');
        }
    }

    /**
     * Find pending payments
     * @param {Object} filter - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Array>}
     */
    async findPendingPayments(filter = {}, options = {}) {
        try {
            return await this.find(
                { ...filter, status: 'pending', deleted: false },
                { ...options, sort: { createdAt: -1 }, lean: true }
            );
        } catch (error) {
            throw this.handleError(error, 'findPendingPayments');
        }
    }

    // ============================================
    // PAYMENT STATISTICS
    // ============================================

    /**
     * Get total revenue
     * @param {Object} filter - Optional filter
     * @returns {Promise<Number>}
     */
    async getTotalRevenue(filter = {}) {
        try {
            const result = await this.aggregate([
                { 
                    $match: { 
                        ...filter,
                        status: 'success',
                        deleted: false,
                    } 
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                    },
                },
            ]);

            return result.length > 0 ? result[0].total : 0;
        } catch (error) {
            throw this.handleError(error, 'getTotalRevenue');
        }
    }

    /**
     * Get revenue by event
     * @param {String} eventId - Event ID
     * @returns {Promise<Number>}
     */
    async getEventRevenue(eventId) {
        try {
            this.validateObjectId(eventId, 'Event ID');

            return await this.getTotalRevenue({ event: this.toObjectId(eventId) });
        } catch (error) {
            throw this.handleError(error, 'getEventRevenue', { eventId });
        }
    }

    /**
     * Get payment statistics
     * @param {Object} filter - Optional filter
     * @returns {Promise<Object>}
     */
    async getPaymentStats(filter = {}) {
        try {
            const [totalCount, successCount, pendingCount, failedCount, totalRevenue] = await Promise.all([
                this.count({ ...filter, deleted: false }),
                this.count({ ...filter, status: 'success', deleted: false }),
                this.count({ ...filter, status: 'pending', deleted: false }),
                this.count({ ...filter, status: 'failed', deleted: false }),
                this.getTotalRevenue(filter),
            ]);

            return {
                totalCount,
                successCount,
                pendingCount,
                failedCount,
                totalRevenue,
                successRate: totalCount > 0 ? (successCount / totalCount * 100).toFixed(2) : 0,
            };
        } catch (error) {
            throw this.handleError(error, 'getPaymentStats');
        }
    }

    /**
     * Count payments by status
     * @param {String} status - Payment status
     * @param {Object} filter - Additional filters
     * @returns {Promise<Number>}
     */
    async countByStatus(status, filter = {}) {
        try {
            return await this.count({
                ...filter,
                status,
                deleted: false,
            });
        } catch (error) {
            throw this.handleError(error, 'countByStatus', { status });
        }
    }

    // ============================================
    // PAYMENT VERIFICATION
    // ============================================

    /**
     * Verify payment
     * @param {String} reference - Payment reference
     * @param {Object} verificationData - Verification data
     * @returns {Promise<Object>}
     */
    async verifyPayment(reference, verificationData) {
        try {
            const payment = await this.findByReference(reference);

            if (!payment) {
                throw new Error('Payment not found');
            }

            return await this.updateById(payment._id, {
                status: 'success',
                verified: true,
                verifiedAt: new Date(),
                verificationData,
            });
        } catch (error) {
            throw this.handleError(error, 'verifyPayment', { reference });
        }
    }

    /**
     * Fail payment
     * @param {String} reference - Payment reference
     * @param {String} reason - Failure reason
     * @returns {Promise<Object>}
     */
    async failPayment(reference, reason = null) {
        try {
            const payment = await this.findByReference(reference);

            if (!payment) {
                throw new Error('Payment not found');
            }

            return await this.updateById(payment._id, {
                status: 'failed',
                failedAt: new Date(),
                failureReason: reason,
            });
        } catch (error) {
            throw this.handleError(error, 'failPayment', { reference });
        }
    }

    // ============================================
    // BATCH OPERATIONS
    // ============================================

    /**
     * Mark old pending payments as expired
     * @param {Number} hours - Hours after which payments are considered expired
     * @returns {Promise<Object>}
     */
    async expireOldPendingPayments(hours = 24) {
        try {
            const expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() - hours);

            return await this.updateMany(
                {
                    status: 'pending',
                    createdAt: { $lt: expirationDate },
                },
                {
                    status: 'expired',
                    expiredAt: new Date(),
                }
            );
        } catch (error) {
            throw this.handleError(error, 'expireOldPendingPayments', { hours });
        }
    }
}

export default PaymentRepository;
