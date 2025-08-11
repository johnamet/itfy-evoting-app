#!/usr/bin/env node
/**
 * Payment Repository
 * 
 * Extends BaseRepository to provide Payment-specific database operations.
 * Handles payment transactions, Paystack integration, and vote bundle purchases.
 * 
 * @module PaymentRepository
 */

import mongoose from 'mongoose';
import BaseRepository from './BaseRepository.js';
import Payment from '../models/Payment.js';

/**
 * Repository class for managing Payment operations.
 * @extends BaseRepository
 */
class PaymentRepository extends BaseRepository {
    /**
     * Initializes the repository with the Payment model.
     */
    constructor() {
        super(Payment);
    }

    /**
     * Creates a new payment record with validation.
     * @param {Object} paymentData - The payment data.
     * @param {Object} [options={}] - Additional Mongoose options (e.g., session).
     * @returns {Promise<Object>} The created payment document.
     */
    async createPayment(paymentData, options = {}) {
        try {
            this._validatePaymentData(paymentData);
            return await this.create(paymentData, options);
        } catch (error) {
            throw this._handleError(error, 'createPayment');
        }
    }

    /**
     * Finds a payment by Paystack reference.
     * @param {string} reference - The Paystack transaction reference.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object|null>} The payment document or null.
     */
    async findByReference(reference, options = {}) {
        try {
            console.log(options)
            return await this.findOne({ reference }, options);
        } catch (error) {
            throw this._handleError(error, 'findByReference');
        }
    }

    /**
     * Finds a payment by Paystack transaction ID.
     * @param {string} transactionId - The Paystack transaction ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Object|null>} The payment document or null.
     */
    async findByTransactionId(transactionId, options = {}) {
        try {
            return await this.findOne({ 'paystackData.transaction_id': transactionId }, options);
        } catch (error) {
            throw this._handleError(error, 'findByTransactionId');
        }
    }

    /**
     * Updates payment status and Paystack data.
     * @param {string} reference - The payment reference.
     * @param {Object} updateData - Data to update.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated payment document.
     */
    async updatePaymentStatus(reference, updateData, options = {}) {
        try {
            const payment = await this.findOne({ reference }, options);
            if (!payment) {
            return null;
            }
            
            // Update the payment document
            Object.assign(payment, updateData);
            return await payment.save();
        } catch (error) {
            throw this._handleError(error, 'updatePaymentStatus');
        }
    }

    /**
     * Updates a payment by reference with any data.
     * @param {string} reference - The payment reference.
     * @param {Object} updateData - Data to update.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated payment document.
     */
    async updateByReference(reference, updateData, options = {}) {
        try {
            const payment = await this.findOne({ reference }, options);
            if (!payment) {
                return null;
            }
            
            // Update the payment document
            Object.assign(payment, updateData);
            return await payment.save();
        } catch (error) {
            throw this._handleError(error, 'updateByReference');
        }
    }

    /**
     * Gets user payments for a specific event and category.
     * @param {string} userId - The user ID.
     * @param {string} eventId - The event ID.
     * @param {string} categoryId - The category ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of payment documents.
     */
    async getUserPayments(userId, eventId, categoryId, options = {}) {
        try {
            const criteria = {
                user: new mongoose.Types.ObjectId(userId),
                event: new mongoose.Types.ObjectId(eventId),
                category: new mongoose.Types.ObjectId(categoryId)
            };

            return await this.findMany(criteria, {
                ...options,
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getUserPayments');
        }
    }

    /**
     * Gets successful payments for a user in a specific event/category.
     * @param {string} userId - The user ID.
     * @param {string} eventId - The event ID.
     * @param {string} categoryId - The category ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of successful payment documents.
     */
    async getSuccessfulPayments(userId, eventId, categoryId, options = {}) {
        try {
            const criteria = {
                user: new mongoose.Types.ObjectId(userId),
                event: new mongoose.Types.ObjectId(eventId),
                category: new mongoose.Types.ObjectId(categoryId),
                status: 'success'
            };

            return await this.findMany(criteria, {
                ...options,
                sort: { paidAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getSuccessfulPayments');
        }
    }

    /**
     * Gets total available votes for a user in an event/category.
     * @param {string} userId - The user ID.
     * @param {string} eventId - The event ID.
     * @param {string} categoryId - The category ID.
     * @returns {Promise<number>} Total votes remaining.
     */
    async getTotalVotesRemaining(userId, eventId, categoryId) {
        try {
            const result = await this.model.aggregate([
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        event: new mongoose.Types.ObjectId(eventId),
                        category: new mongoose.Types.ObjectId(categoryId),
                        status: 'success'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalVotesRemaining: { $sum: '$votesRemaining' }
                    }
                }
            ]);

            return result.length > 0 ? result[0].totalVotesRemaining : 0;
        } catch (error) {
            throw this._handleError(error, 'getTotalVotesRemaining');
        }
    }

    /**
     * Decrements votes remaining for a payment after vote is cast.
     * @param {string} paymentId - The payment ID.
     * @param {number} votesUsed - Number of votes used (default: 1).
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated payment document.
     */
    async decrementVotes(paymentId, votesUsed = 1, options = {}) {
        try {
            return await this.findByIdAndUpdate(
                paymentId,
                {
                    $inc: {
                        votesCast: votesUsed,
                        votesRemaining: -votesUsed
                    }
                },
                { new: true, ...options }
            );
        } catch (error) {
            throw this._handleError(error, 'decrementVotes');
        }
    }

    /**
     * Finds payments that need cleanup (expired and abandoned).
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of expired payment documents.
     */
    async findExpiredPayments(options = {}) {
        try {
            const criteria = {
                status: 'pending',
                expiresAt: { $lt: new Date() }
            };

            return await this.findMany(criteria, options);
        } catch (error) {
            throw this._handleError(error, 'findExpiredPayments');
        }
    }

    /**
     * Find payment by voter email
     * @param {string} email - Voter email
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Payments for the voter
     */
    async findByVoter(email, options = {}) {
        try {
            return await Payment.findByVoter(email, options);
        } catch (error) {
            console.error('Error finding payments by voter:', error);
            throw error;
        }
    }

    /**
     * Check if voter has already paid for event/category
     * @param {string} email - Voter email
     * @param {string} eventId - Event ID
     * @param {string} categoryId - Category ID
     * @returns {Promise<Object|null>} Existing payment or null
     */
    async hasVoterPaid(email, eventId, categoryId) {
        try {
            return await Payment.hasVoterPaid(email, eventId, categoryId);
        } catch (error) {
            console.error('Error checking voter payment:', error);
            throw error;
        }
    }

    /**
     * Find payments by IP address (for fraud detection)
     * @param {string} ipAddress - IP address
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Payments from the IP
     */
    async findByIpAddress(ipAddress, options = {}) {
        try {
            const query = { 'voter.ipAddress': ipAddress };
            if (options.timeframe) {
                query.createdAt = { $gte: new Date(Date.now() - options.timeframe) };
            }
            if (options.event) query.event = options.event;
            
            return await Payment.find(query)
                .populate('voteBundle')
                .populate('event')
                .populate('category')
                .sort({ createdAt: -1 });
        } catch (error) {
            console.error('Error finding payments by IP:', error);
            throw error;
        }
    }

    /**
     * Update payment with vote casting information
     * @param {string} paymentId - Payment ID
     * @param {string} candidateId - Candidate ID
     * @param {number} votesToCast - Number of votes to cast
     * @returns {Promise<Object>} Updated payment
     */
    async castVotes(paymentId, candidateId, votesToCast = 1) {
        try {
            const payment = await Payment.findById(paymentId);
            if (!payment) {
                throw new Error('Payment not found');
            }

            await payment.castVotes(candidateId, votesToCast);
            return payment;
        } catch (error) {
            console.error('Error casting votes:', error);
            throw error;
        }
    }

    /**
     * Validates payment data before creation.
     * @private
     * @param {Object} paymentData - The payment data to validate.
     * @throws {Error} If validation fails.
     */
    _validatePaymentData(paymentData) {
        const required = ['reference', 'candidate', 'voteBundles', 'event', 'category', 'originalAmount', 'finalAmount'];

        for (const field of required) {
            if (!paymentData[field]) {
                throw new Error(`${field} is required`);
            }
        }

        // Validate ObjectIds
        const objectIdFields = ['candidate', 'event', 'category'];
        for (const field of objectIdFields) {
            if (paymentData[field] && !mongoose.Types.ObjectId.isValid(paymentData[field])) {
            throw new Error(`Invalid ${field} ObjectId`);
            }
        }

        // Validate voteBundles array
        if (paymentData.voteBundles && Array.isArray(paymentData.voteBundles)) {
            for (const bundleId of paymentData.voteBundles) {
            if (!mongoose.Types.ObjectId.isValid(bundleId)) {
                throw new Error(`Invalid voteBundles ObjectId: ${bundleId}`);
            }
            }
        }

        // Validate amounts
        if (paymentData.originalAmount < 0 || paymentData.finalAmount < 0) {
            throw new Error('Amounts cannot be negative');
        }

        if (paymentData.discountAmount && paymentData.discountAmount < 0) {
            throw new Error('Discount amount cannot be negative');
        }

        // Validate reference format (should be unique string)
        if (typeof paymentData.reference !== 'string' || paymentData.reference.length < 10) {
            throw new Error('Invalid payment reference format');
        }
    }

    /**
     * Handles errors with context.
     * @private
     * @param {Error} error - The error to handle.
     * @param {string} operation - The operation that failed.
     * @throws {Error} The processed error.
     */
    _handleError(error, operation) {
        console.error(`PaymentRepository.${operation} error:`, error);
        
        if (error.code === 11000) {
            throw new Error('Payment reference already exists');
        }
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            throw new Error(`Validation failed: ${messages.join(', ')}`);
        }
        
        throw error;
    }

    /**
     * Get payment statistics with aggregation
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Object>} Payment statistics
     */
    async getPaymentStatistics(filters = {}) {
        try {
            const matchStage = this._buildFilterStage(filters);

            const stats = await Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$finalAmount" },
                        avgAmount: { $avg: "$finalAmount" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        statusBreakdown: {
                            $push: {
                                status: "$_id",
                                count: "$count",
                                totalAmount: "$totalAmount",
                                avgAmount: "$avgAmount"
                            }
                        },
                        totalPayments: { $sum: "$count" },
                        totalRevenue: { $sum: "$totalAmount" }
                    }
                }
            ]);

            return stats[0] || {
                statusBreakdown: [],
                totalPayments: 0,
                totalRevenue: 0
            };
        } catch (error) {
            throw new Error(`Failed to get payment statistics: ${error.message}`);
        }
    }

    /**
     * Get payments with filters and pagination
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Payments
     */
    async getPayments(filters = {}, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const filter = this._buildFilterStage(filters);
            const skip = (page - 1) * limit;

            return await Payment.find(filter)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate('voteBundles')
                .populate('event')
                .populate('category')
                .populate('coupon')
                .lean();
        } catch (error) {
            throw new Error(`Failed to get payments: ${error.message}`);
        }
    }

    /**
     * Count payments with filters
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Number>} Payment count
     */
    async countPayments(filters = {}) {
        try {
            const filter = this._buildFilterStage(filters);
            return await Payment.countDocuments(filter);
        } catch (error) {
            throw new Error(`Failed to count payments: ${error.message}`);
        }
    }

    /**
     * Get payments by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Event payments
     */
    async getPaymentsByEvent(eventId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const skip = (page - 1) * limit;

            return await Payment.find({ event: eventId })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate('voteBundles')
                .populate('category')
                .lean();
        } catch (error) {
            throw new Error(`Failed to get payments by event: ${error.message}`);
        }
    }

    /**
     * Get payments by category
     * @param {String} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Category payments
     */
    async getPaymentsByCategory(categoryId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const skip = (page - 1) * limit;

            return await Payment.find({ category: categoryId })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .populate('voteBundles')
                .populate('event')
                .lean();
        } catch (error) {
            throw new Error(`Failed to get payments by category: ${error.message}`);
        }
    }

    /**
     * Get payment summary
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Object>} Payment summary
     */
    async getPaymentSummary(filters = {}) {
        try {
            const matchStage = this._buildFilterStage(filters);

            const summary = await Payment.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalPayments: { $sum: 1 },
                        totalRevenue: { $sum: "$finalAmount" },
                        avgPayment: { $avg: "$finalAmount" },
                        successfulPayments: {
                            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                        },
                        failedPayments: {
                            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                        },
                        pendingPayments: {
                            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                        }
                    }
                }
            ]);

            return summary[0] || {
                totalPayments: 0,
                totalRevenue: 0,
                avgPayment: 0,
                successfulPayments: 0,
                failedPayments: 0,
                pendingPayments: 0
            };
        } catch (error) {
            throw new Error(`Failed to get payment summary: ${error.message}`);
        }
    }

    /**
     * Build filter stage for aggregation
     * @param {Object} filters - Filter criteria
     * @returns {Object} MongoDB filter object
     * @private
     */
    _buildFilterStage(filters) {
        const matchStage = {};

        if (filters.eventId) {
            matchStage['event'] = mongoose.Types.ObjectId(filters.eventId);
        }

        if (filters.categoryId) {
            matchStage['category'] = mongoose.Types.ObjectId(filters.categoryId);
        }

        if (filters.status) {
            matchStage.status = filters.status;
        }

        if (filters.email) {
            matchStage['voter.email'] = { $regex: filters.email, $options: 'i' };
        }

        if (filters.startDate || filters.endDate) {
            matchStage.createdAt = {};
            if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
            if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
        }

        return matchStage;
    }
}

export default PaymentRepository;
