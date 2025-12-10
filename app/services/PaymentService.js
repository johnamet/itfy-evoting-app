/**
 * PaymentService
 * 
 * Handles payment processing, transaction management, revenue tracking,
 * refunds, and payment verification with Paystack integration.
 * 
 * @extends BaseService
 * @module services/PaymentService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';
import crypto from 'crypto';
import config from '../config/ConfigManager.js';

export default class PaymentService extends BaseService {
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'PaymentService',
            primaryRepository: 'payment',
        });

        this.paystackSecretKey = config.get('paystack.secretKey');
        this.paystackPublicKey = config.get('paystack.publicKey');
        this.validStatuses = ['pending', 'successful', 'failed', 'refunded'];
        
        this.emailService = options.emailService || null;
        this.notificationService = options.notificationService || null;
    }

    /**
     * Initialize payment
     */
    async initializePayment(paymentData, userId) {
        return this.runInContext('initializePayment', async () => {
            // Validate required fields
            this.validateRequiredFields(paymentData, [
                'amount', 'email', 'eventId'
            ]);

            // Check if event exists
            const event = await this.repo('event').findById(paymentData.eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Generate unique reference
            const reference = this._generateReference();

            // Calculate final amount (apply coupon if provided)
            let finalAmount = paymentData.amount;
            let discountAmount = 0;
            let couponId = null;

            if (paymentData.couponCode) {
                // Validate coupon (assuming CouponService is available)
                const coupon = await this.repo('coupon').findOne({
                    code: paymentData.couponCode.toUpperCase(),
                    active: true,
                });

                if (coupon && !this.isDatePast(coupon.expiryDate || new Date(Date.now() + 86400000))) {
                    // Calculate discount
                    if (coupon.discountType === 'percentage') {
                        discountAmount = (paymentData.amount * coupon.discountValue) / 100;
                    } else {
                        discountAmount = coupon.discountValue;
                    }

                    // Apply max discount cap
                    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                        discountAmount = coupon.maxDiscountAmount;
                    }

                    finalAmount = paymentData.amount - discountAmount;
                    couponId = coupon._id;
                }
            }

            // Create payment record
            const payment = await this.repo('payment').create({
                userId,
                eventId: paymentData.eventId,
                reference,
                amount: finalAmount,
                originalAmount: paymentData.amount,
                discountAmount,
                couponId,
                email: paymentData.email,
                status: 'pending',
                metadata: paymentData.metadata || {},
            });

            await this.logActivity(userId, 'create', 'payment', {
                paymentId: payment._id,
                reference,
                amount: finalAmount,
            });

            return this.handleSuccess({
                payment: {
                    id: payment._id,
                    reference,
                    amount: finalAmount,
                    publicKey: this.paystackPublicKey,
                },
            }, 'Payment initialized successfully');
        });
    }

    /**
     * Verify Paystack payment
     */
    async verifyPayment(reference) {
        return this.runInContext('verifyPayment', async () => {
            const payment = await this.repo('payment').findOne({ reference });

            if (!payment) {
                throw new Error('Payment not found');
            }

            // In production, make actual API call to Paystack
            // For now, we'll simulate verification
            const verified = true; // Replace with actual Paystack API call

            if (verified) {
                // Update payment status
                await this.repo('payment').update(payment._id, {
                    status: 'successful',
                    paidAt: new Date(),
                });

                // Record coupon usage if applicable
                if (payment.couponId) {
                    await this.repo('couponUsage').create({
                        couponId: payment.couponId,
                        userId: payment.userId,
                        eventId: payment.eventId,
                        paymentId: payment._id,
                        originalAmount: payment.originalAmount,
                        discountAmount: payment.discountAmount,
                        finalAmount: payment.amount,
                    });

                    // Update coupon statistics
                    await this.repo('coupon').update(payment.couponId, {
                        $inc: {
                            usageCount: 1,
                            totalDiscount: payment.discountAmount,
                        },
                    });
                }

                // Update event revenue
                await this.repo('event').update(payment.eventId, {
                    $inc: { totalRevenue: payment.amount },
                });

                await this.logActivity(payment.userId, 'verify', 'payment', {
                    paymentId: payment._id,
                    reference,
                    status: 'successful',
                });

                // Get user and event details for notifications
                const user = await this.repo('user').findById(payment.userId);
                const event = await this.repo('event').findById(payment.eventId);

                // Send payment receipt email
                if (this.emailService && user && user.email) {
                    try {
                        await this.emailService.sendEmail({
                            to: user.email,
                            subject: 'Payment Receipt - Vote Purchase Successful',
                            template: 'payment-receipt',
                            context: {
                                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                                reference: payment.reference,
                                amount: payment.amount,
                                originalAmount: payment.originalAmount,
                                discountAmount: payment.discountAmount,
                                eventName: event ? event.name : 'Event',
                                paymentDate: new Date(),
                            },
                        });
                    } catch (emailError) {
                        this.log('warn', 'Failed to send payment receipt email', { 
                            error: emailError.message,
                            paymentId: payment._id 
                        });
                    }
                }

                // Send notification
                if (this.notificationService) {
                    try {
                        await this.notificationService.createNotification({
                            userId: payment.userId,
                            type: 'payment',
                            title: 'Payment Successful',
                            message: `Your payment of ₦${payment.amount.toLocaleString()} for ${event ? event.name : 'event'} was successful.`,
                            priority: 'high',
                            metadata: {
                                paymentId: payment._id,
                                reference: payment.reference,
                                amount: payment.amount,
                                eventId: payment.eventId,
                            },
                        });
                    } catch (notifError) {
                        this.log('warn', 'Failed to send payment notification', { 
                            error: notifError.message,
                            paymentId: payment._id 
                        });
                    }
                }

                return this.handleSuccess({
                    verified: true,
                    payment: {
                        id: payment._id,
                        reference,
                        amount: payment.amount,
                        status: 'successful',
                    },
                }, 'Payment verified successfully');
            } else {
                await this.repo('payment').update(payment._id, {
                    status: 'failed',
                });

                return this.handleSuccess({
                    verified: false,
                    payment: {
                        id: payment._id,
                        reference,
                        status: 'failed',
                    },
                }, 'Payment verification failed');
            }
        });
    }

    /**
     * Verify Paystack webhook signature
     */
    verifyPaystackSignature(signature, body) {
        const hash = crypto
            .createHmac('sha512', this.paystackSecretKey)
            .update(JSON.stringify(body))
            .digest('hex');

        return hash === signature;
    }

    /**
     * Handle Paystack webhook
     */
    async handleWebhook(event, data) {
        return this.runInContext('handleWebhook', async () => {
            if (event === 'charge.success') {
                const { reference } = data;
                await this.verifyPayment(reference);
            }

            return this.handleSuccess(null, 'Webhook processed');
        });
    }

    /**
     * Get payment by ID
     */
    async getPayment(paymentId) {
        return this.runInContext('getPayment', async () => {
            const payment = await this.repo('payment').findById(paymentId);

            if (!payment) {
                throw new Error('Payment not found');
            }

            // Get related data
            const user = await this.repo('user').findById(payment.userId);
            const event = await this.repo('event').findById(payment.eventId);

            return this.handleSuccess({
                payment,
                user: user ? {
                    id: user._id,
                    name: `${user.firstName} ${user.lastName}`,
                    email: user.email,
                } : null,
                event: event ? {
                    id: event._id,
                    name: event.name,
                } : null,
            }, 'Payment retrieved successfully');
        });
    }

    /**
     * List payments with filters
     */
    async listPayments(filters = {}, pagination = {}) {
        return this.runInContext('listPayments', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = {};

            // Filter by user
            if (filters.userId) {
                query.userId = filters.userId;
            }

            // Filter by event
            if (filters.eventId) {
                query.eventId = filters.eventId;
            }

            // Filter by status
            if (filters.status) {
                query.status = filters.status;
            }

            // Filter by date range
            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            // Search by reference or email
            if (filters.search) {
                query.$or = [
                    { reference: { $regex: filters.search, $options: 'i' } },
                    { email: { $regex: filters.search, $options: 'i' } },
                ];
            }

            const payments = await this.repo('payment').findWithPagination(query, {
                page,
                limit,
                sort: filters.sort || { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(payments.docs, payments.total, page, limit),
                'Payments retrieved successfully'
            );
        });
    }

    /**
     * Get user payments
     */
    async getUserPayments(userId, pagination = {}) {
        return this.listPayments({ userId }, pagination);
    }

    /**
     * Get event payments
     */
    async getEventPayments(eventId, pagination = {}) {
        return this.listPayments({ eventId }, pagination);
    }

    /**
     * Get payment statistics
     */
    async getPaymentStatistics(filters = {}) {
        return this.runInContext('getPaymentStatistics', async () => {
            const query = {};

            // Apply filters
            if (filters.eventId) {
                query.eventId = filters.eventId;
            }

            if (filters.startDate || filters.endDate) {
                query.createdAt = {};
                if (filters.startDate) {
                    query.createdAt.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.createdAt.$lte = new Date(filters.endDate);
                }
            }

            // Total revenue
            const revenueData = await this.repo('payment').aggregate([
                { $match: { ...query, status: 'successful' } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        totalTransactions: { $sum: 1 },
                        averageTransaction: { $avg: '$amount' },
                    },
                },
            ]);

            // Revenue by status
            const revenueByStatus = await this.repo('payment').aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        total: { $sum: '$amount' },
                    },
                },
            ]);

            // Revenue over time
            const revenueOverTime = await this.repo('payment').aggregate([
                { $match: { ...query, status: 'successful' } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$createdAt',
                            },
                        },
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Revenue by event
            const revenueByEvent = await this.repo('payment').aggregate([
                { $match: { ...query, status: 'successful' } },
                {
                    $group: {
                        _id: '$eventId',
                        revenue: { $sum: '$amount' },
                        transactions: { $sum: 1 },
                    },
                },
                { $sort: { revenue: -1 } },
            ]);

            return this.handleSuccess({
                statistics: {
                    totalRevenue: revenueData[0]?.totalRevenue || 0,
                    totalTransactions: revenueData[0]?.totalTransactions || 0,
                    averageTransaction: revenueData[0]?.averageTransaction || 0,
                    revenueByStatus,
                    revenueOverTime,
                    revenueByEvent,
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Refund payment
     */
    async refundPayment(paymentId, adminId, reason = '') {
        return this.runInContext('refundPayment', async () => {
            const payment = await this.repo('payment').findById(paymentId);

            if (!payment) {
                throw new Error('Payment not found');
            }

            if (payment.status !== 'successful') {
                throw new Error('Can only refund successful payments');
            }

            // Update payment status
            await this.repo('payment').update(paymentId, {
                status: 'refunded',
                refundedAt: new Date(),
                refundedBy: adminId,
                refundReason: reason,
            });

            // Reverse event revenue
            await this.repo('event').update(payment.eventId, {
                $inc: { totalRevenue: -payment.amount },
            });

            await this.logActivity(adminId, 'refund', 'payment', {
                paymentId,
                reference: payment.reference,
                amount: payment.amount,
                reason,
            });

            return this.handleSuccess(null, 'Payment refunded successfully');
        });
    }

    /**
     * Generate unique payment reference
     */
    _generateReference() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10).toUpperCase();
        return `ITFY-${timestamp}-${random}`;
    }
}
