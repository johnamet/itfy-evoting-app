#!/usr/bin/env node
/**
 * Payment Service
 * 
 * Handles Paystack payment integration for vote bundles including:
 * - Payment initialization and verification
 * - Bundle and coupon validation
 * - Webhook handling for payment status updates
 */

import BaseService from './BaseService.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { configDotenv } from 'dotenv';
import mongoose from 'mongoose';

configDotenv();

// Repositories
import PaymentRepository from '../repositories/PaymentRepository.js';
import VoteBundleRepository from '../repositories/VoteBundleRepository.js';
import CouponRepository from '../repositories/CouponRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import CategoryRepository from '../repositories/CategoryRepository.js';
import CandidateRepository from '../repositories/CandidateRepository.js';

// Services
import CouponService from './CouponService.js';
import EmailService from './EmailService.js';

class PaymentService extends BaseService {
    constructor() {
        super();
        this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        this.paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
        this.paystackBaseUrl = 'https://api.paystack.co';
        this.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || this.paystackSecretKey;

        this.paymentRepository = new PaymentRepository();
        this.voteBundleRepository = new VoteBundleRepository();
        this.couponRepository = new CouponRepository();
        this.eventRepository = new EventRepository();
        this.categoryRepository = new CategoryRepository();
        this.candidateRepository = new CandidateRepository();

        this.couponService = new CouponService();
        this.emailService = new EmailService();

        this.emailService._initializeTransporter()

        if (!this.paystackSecretKey) {
            throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
        }
    }

    /**
     * Initialize payment for vote bundles
     */
    async initializePayment(paymentData, options = {}) {
        try {
            this._log('initialize_payment', {
                email: paymentData.email,
                eventId: paymentData.eventId,
                categoryId: paymentData.categoryId
            });

            this._validateRequiredFields(paymentData, ['email', 'bundles', 'eventId', 'categoryId', 'candidateId']);
            this._validateObjectId(paymentData.eventId, 'Event ID');
            this._validateObjectId(paymentData.categoryId, 'Category ID');
            this._validateObjectId(paymentData.candidateId, 'Candidate ID');

            // Validate candidate
            const candidate = await this.candidateRepository.findById(paymentData.candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }
            if (candidate.event.toString() !== paymentData.eventId) {
                throw new Error('Candidate does not belong to this event');
            }
            if (!candidate.categories.some(cat => cat.toString() === paymentData.categoryId)) {
                throw new Error('Candidate does not belong to this category');
            }

            // Check existing payment
            const existingPayment = await this.paymentRepository.hasVoterPaid(
                paymentData.email,
                paymentData.eventId,
                paymentData.categoryId,
            );

            if (existingPayment && existingPayment.status === 'pending' && !existingPayment.isExpired) {
                return {
                    success: true,
                    message: 'Existing pending payment found',
                    data: {
                        payment: existingPayment,
                        authorization_url: existingPayment.paystackData.authorization_url,
                        access_code: existingPayment.paystackData.access_code,
                        reference: existingPayment.reference
                    }
                };
            }

            // Calculate bundle costs
            const bundleCalculation = await this._calculateBundleCosts(
                paymentData.bundles,
                paymentData.eventId,
                paymentData.categoryId
            );

            let finalAmount = bundleCalculation.totalAmount;
            let discountAmount = 0;
            const appliedCoupons = [];

            // Apply coupons
            if (paymentData.coupons && paymentData.coupons.length > 0) {
                const couponResult = await this._applyCoupons(
                    paymentData.coupons,
                    bundleCalculation.validatedBundles,
                    paymentData.eventId,
                    paymentData.categoryId,
                    bundleCalculation.totalAmount
                );
                finalAmount = couponResult.discountedAmount;
                discountAmount = bundleCalculation.totalAmount - couponResult.discountedAmount;
                appliedCoupons.push(...couponResult.appliedCoupons);
            }

            // Generate unique reference
            const reference = this._generatePaymentReference();

            // Create payment record
            const paymentRecord = await this.paymentRepository.createPayment({
                reference,
                voter: {
                    email: paymentData.email.toLowerCase(),
                    ipAddress: paymentData.voterIp,
                    userAgent: paymentData.userAgent
                },
                voteBundles: bundleCalculation.validatedBundles.map(b => b.bundleId),
                event: paymentData.eventId,
                candidate: paymentData.candidateId,
                category: paymentData.categoryId,
                coupon: appliedCoupons.length > 0 ? appliedCoupons[0]._id : null,
                originalAmount: bundleCalculation.totalAmount,
                discountAmount,
                finalAmount,
                currency: 'GHS',
                votesRemaining: bundleCalculation.totalVotes,
                metadata: {
                    candidateId: paymentData.candidateId,
                    fraud_check: await this._performFraudCheck({
                        email: paymentData.email,
                        ipAddress: paymentData.voterIp
                    })
                }
            }, options);

            // Initialize Paystack payment
            const paystackResponse = await this._initializePaystackPayment({
                email: paymentData.email,
                amount: finalAmount * 100, // Convert to kobo
                reference,
                callback_url: paymentData.callback_url,
                metadata: {
                    payment_id: paymentRecord._id,
                    event_id: paymentData.eventId,
                    category_id: paymentData.categoryId,
                    candidate_id: paymentData.candidateId,
                    voter_email: paymentData.email
                }
            });

            await this.paymentRepository.updateByReference(paymentRecord.reference, {
                paystackData: {
                    authorization_url: paystackResponse.authorization_url,
                    access_code: paystackResponse.access_code
                }
            }, options);

            console.log('Payment record updated with Paystack data:', paymentRecord);

            return {
                success: true,
                message: 'Payment initialized successfully',
                data: {
                    payment: paymentRecord,
                    authorization_url: paystackResponse.authorization_url,
                    access_code: paystackResponse.access_code,
                    reference
                }
            };

        } catch (error) {
            throw this._handleError(error, 'initialize_payment', paymentData);
        }
    }

    /**
     * Verify payment without casting vote
     */
    async verifyPayment(reference) {
        try {
            this._log('verify_payment', { reference });

            const payment = await this.paymentRepository.findByReference(reference, {
                populate: ['voteBundles', 'event', 'category', 'coupon', 'candidate']
            });

            if (!payment) {
                throw new Error('Payment not found');
            }

            if (payment.status === 'success') {
                return {
                    verified: true,
                    data: { payment },
                    message: 'Payment already verified'
                };
            }

            const verification = await this._verifyPaystackTransaction(reference);

            if (verification.status === 'success') {
                const updatedPayment = await this.paymentRepository.updatePaymentStatus(reference, {
                    status: 'success',
                    paidAt: new Date(verification.paid_at),
                    paystackData: {
                        transaction_id: verification.id,
                        gateway_response: verification.gateway_response,
                        channel: verification.channel,
                        fees: verification.fees / 100,
                        customer: verification.customer
                    },
                    'metadata.webhook_verified': false
                });

                // Send payment confirmation email
                try {
                    const event = await this.eventRepository.findById(updatedPayment.event);
                    await this.emailService.sendPaymentConfirmation(
                        {
                            name: updatedPayment.voter.name || 'Voter',
                            email: updatedPayment.voter.email
                        },
                        {
                            id: updatedPayment._id,
                            amount: verification.amount / 100,
                            currency: verification.currency || 'GHS',
                            createdAt: updatedPayment.paidAt,
                            reference: verification.reference,
                            transactionId: verification.id
                        },
                        {
                            id: event._id,
                            name: event.name
                        }
                    );

                    this._log('payment_confirmation_email_sent', {
                        reference,
                        email: updatedPayment.voter.email
                    });
                } catch (emailError) {
                    this._handleError('payment_confirmation_email_failed', emailError, { reference });
                }

                return {
                    verified: true,
                    data: { payment: updatedPayment },
                    message: 'Payment verified successfully'
                };

            } else {
                await this.paymentRepository.updatePaymentStatus(reference, {
                    status: 'failed',
                    paystackData: {
                        gateway_response: verification.gateway_response
                    }
                });

                return {
                    verified: false,
                    data: { payment },
                    message: 'Payment verification failed: ' + verification.gateway_response
                };
            }

        } catch (error) {
            throw this._handleError(error, 'verify_payment', { reference });
        }
    }

    /**
     * Handle Paystack webhook events
     */
    async handleWebhook(event, signature) {
        try {
            this._log('webhook_received', { event: event.event });

            if (!this._verifyWebhookSignature(event, signature, this.webhookSecret)) {
                throw new Error('Invalid webhook signature');
            }

            if (event.event === 'charge.success') {
                const result = await this._handleChargeSuccess(event.data);
                // Trigger vote casting
                const payment = await this.paymentRepository.findByReference(event.data.reference);
                if (payment && payment.metadata.candidateId) {
                    // Use dynamic import to avoid circular dependency
                    const { default: VotingService } = await import('./VotingService.js');
                    const votingService = new VotingService();

                    await votingService.completeVote(
                        event.data.reference,
                        payment.candidate,
                        payment.voter.ipAddress
                    );
                }
                return result;
            } else if (event.event === 'charge.failed') {
                return await this._handleChargeFailed(event.data);
            }

            return { success: true, message: 'Event not handled' };

        } catch (error) {
            throw this._handleError(error, 'handle_webhook', { event: event.event });
        }
    }

    /**
     * Get payment details
     */
    async getPaymentDetails(reference) {
        try {
            const payment = await this.paymentRepository.findByReference(reference, {
                populate: [
                    { path: 'voteBundles', select: 'name votes price' },
                    { path: 'event', select: 'name' },
                    { path: 'category', select: 'name' },
                    { path: 'coupon', select: 'code discountType discountValue' }
                ]
            });

            if (!payment) {
                throw new Error('Payment not found');
            }

            return {
                success: true,
                data: payment,
                message: 'Payment details retrieved successfully'
            };

        } catch (error) {
            throw this._handleError(error, 'get_payment_details', { reference });
        }
    }

    /**
     * Get payment statistics
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Object>} Payment statistics
     */
    async getPaymentStatistics(filters = {}) {
        try {
            this._log('get_payment_statistics', { filters });

            const stats = await this.paymentRepository.getPaymentStatistics(filters);

            return {
                success: true,
                data: stats
            };
        } catch (error) {
            throw this._handleError(error, 'get_payment_statistics', { filters });
        }
    }

    /**
     * Get payments with filters and pagination
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Paginated payments
     */
    async getPayments(filters = {}, options = {}) {
        try {
            this._log('get_payments', { filters, options });

            const { page = 1, limit = 20 } = options;
            const { page: paginationPage, limit: paginationLimit } = this._generatePaginationOptions(page, limit);

            const payments = await this.paymentRepository.getPayments(filters, {
                page: paginationPage,
                limit: paginationLimit
            });

            const total = await this.paymentRepository.countPayments(filters);

            return {
                success: true,
                data: this._formatPaginationResponse(payments, total, paginationPage, paginationLimit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_payments', { filters, options });
        }
    }

    /**
     * Get payments by event
     * @param {String} eventId - Event ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Event payments
     */
    async getPaymentsByEvent(eventId, options = {}) {
        try {
            this._log('get_payments_by_event', { eventId, options });

            this._validateObjectId(eventId, 'Event ID');

            const { page = 1, limit = 20 } = options;
            const payments = await this.paymentRepository.getPaymentsByEvent(eventId, { page, limit });
            const total = await this.paymentRepository.countPayments({ eventId });

            return {
                success: true,
                data: this._formatPaginationResponse(payments, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_payments_by_event', { eventId });
        }
    }

    /**
     * Get payments by category
     * @param {String} categoryId - Category ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Category payments
     */
    async getPaymentsByCategory(categoryId, options = {}) {
        try {
            this._log('get_payments_by_category', { categoryId, options });

            this._validateObjectId(categoryId, 'Category ID');

            const { page = 1, limit = 20 } = options;
            const payments = await this.paymentRepository.getPaymentsByCategory(categoryId, { page, limit });
            const total = await this.paymentRepository.countPayments({ categoryId });

            return {
                success: true,
                data: this._formatPaginationResponse(payments, total, page, limit)
            };
        } catch (error) {
            throw this._handleError(error, 'get_payments_by_category', { categoryId });
        }
    }

    /**
     * Get payment summary
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Object>} Payment summary
     */
    async getPaymentSummary(filters = {}) {
        try {
            this._log('get_payment_summary', { filters });

            const summary = await this.paymentRepository.getPaymentSummary(filters);
            return {
                success: true,
                data: summary
            };
        } catch (error) {
            throw this._handleError(error, 'get_payment_summary', { filters });
        }
    }

    /**
     * Calculate bundle costs
     */
    async _calculateBundleCosts(bundles, eventId, categoryId) {
        const validatedBundles = [];
        let totalAmount = 0;
        let totalVotes = 0;

        for (const bundle of bundles) {
            if (!bundle.bundleId || !bundle.quantity || bundle.quantity <= 0) {
                throw new Error('Each bundle must have bundleId and positive quantity');
            }

            const bundleDoc = await this.voteBundleRepository.findById(bundle.bundleId);
            if (!bundleDoc) {
                throw new Error(`Bundle ${bundle.bundleId} not found`);
            }

            if (!bundleDoc.isActive) {
                throw new Error(`Bundle ${bundle.bundleId} is not active`);
            }

            if (bundleDoc.applicableEvents.length > 0 && !bundleDoc.applicableEvents.some(id => id.toString() === eventId)) {
                throw new Error(`Bundle ${bundle.bundleId} not applicable to event`);
            }

            if (bundleDoc.applicableCategories.length > 0 && !bundleDoc.applicableCategories.some(id => id.toString() === categoryId)) {
                throw new Error(`Bundle ${bundle.bundleId} not applicable to category`);
            }

            validatedBundles.push({
                bundleId: bundle.bundleId,
                quantity: bundle.quantity,
                price: bundleDoc.price,
                votes: bundleDoc.votes
            });

            totalAmount += bundleDoc.price * bundle.quantity;
            totalVotes += bundleDoc.votes * bundle.quantity;
        }

        return {
            totalAmount,
            totalVotes,
            validatedBundles
        };
    }

    /**
     * Apply coupons
     */
    async _applyCoupons(coupons, bundles, eventId, categoryId, totalAmount) {
        const appliedCoupons = [];
        let discountedAmount = totalAmount;

        for (const couponCode of coupons) {
            const couponValidation = await this.couponService.validateCoupon({
                code: couponCode,
                eventId,
                categoryId,
                amount: discountedAmount
            });

            if (!couponValidation.isValid) {
                continue;
            }

            discountedAmount -= couponValidation.discountAmount;
            appliedCoupons.push(couponValidation.coupon);
        }

        return {
            discountedAmount: Math.max(0, discountedAmount),
            appliedCoupons
        };
    }

    /**
     * Perform fraud check
     */
    async _performFraudCheck(voter) {
        try {
            const checks = {
                passed: true,
                reasons: []
            };

            const recentPayments = await this.paymentRepository.findByIpAddress(
                voter.ipAddress,
                { timeframe: 60 * 60 * 1000 }
            );

            if (recentPayments.length > 5) {
                checks.passed = false;
                checks.reasons.push('Excessive payments from IP address');
            }

            if (voter.email.includes('+') && voter.email.split('+').length > 2) {
                checks.passed = false;
                checks.reasons.push('Suspicious email pattern');
            }

            return checks;

        } catch (error) {
            this._handleError('fraud_check_error', error);
            return { passed: true, reasons: [] };
        }
    }

    /**
     * Initialize Paystack transaction
     */
    async _initializePaystackPayment(data) {
        try {
            const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.paystackSecretKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || 'Failed to initialize Paystack transaction');
            }

            console.log(result)

            return result.data;

        } catch (error) {
            throw new Error(`Paystack initialization failed: ${error.message}`);
        }
    }

    /**
     * Verify Paystack transaction
     */
    async _verifyPaystackTransaction(reference) {
        try {
            const response = await fetch(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.paystackSecretKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || 'Failed to verify Paystack transaction');
            }

            return result.data;

        } catch (error) {
            throw new Error(`Paystack verification failed: ${error.message}`);
        }
    }

    /**
     * Verify Paystack webhook signature
     * @param {Buffer|string} rawBody - The raw request body as received
     * @param {string} signature - The x-paystack-signature header
     * @param {string} webhookSecret - Paystack secret key
     * @returns {boolean} - True if signature is valid, false otherwise
     */
    _verifyWebhookSignature(rawBody, signature, webhookSecret) {
        try {
            // Ensure rawBody is a Buffer or string as received (no parsing beforehand)
            const hash = crypto
                .createHmac('sha512', webhookSecret)
                .update(rawBody)
                .digest('hex')
                .toLowerCase(); // Ensure lowercase hex

            // Log for debugging (remove in production for performance)
            console.log('Received signature:', signature);
            console.log('Computed hash:', hash);

            return hash === signature;
        } catch (error) {
            console.error('Webhook signature verification error:', error);
            return false;
        }
    }

    /**
     * Handle successful charge webhook
     */
    async _handleChargeSuccess(data) {
        try {
            const reference = data.reference;

            const updatedPayment = await this.paymentRepository.updatePaymentStatus(reference, {
                status: 'success',
                paidAt: new Date(data.paid_at),
                paystackData: {
                    transaction_id: data.id,
                    gateway_response: data.gateway_response,
                    channel: data.channel,
                    fees: data.fees / 100,
                    customer: data.customer
                },
                'metadata.webhook_verified': true
            });

            return {
                success: true,
                data: { payment: updatedPayment },
                message: 'Charge success processed'
            };

        } catch (error) {
            throw this._handleError(error, 'handle_charge_success', data);
        }
    }

    /**
     * Handle failed charge webhook
     */
    async _handleChargeFailed(data) {
        try {
            const reference = data.reference;

            const updatedPayment = await this.paymentRepository.updatePaymentStatus(reference, {
                status: 'failed',
                paystackData: {
                    gateway_response: data.gateway_response
                },
                'metadata.webhook_verified': true
            });

            return {
                success: true,
                data: { payment: updatedPayment },
                message: 'Charge failure processed'
            };

        } catch (error) {
            throw this._handleError(error, 'handle_charge_failed', data);
        }
    }

    /**
     * Generate unique payment reference
     */
    _generatePaymentReference() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `PAY_${timestamp}_${random}`;
    }

    /**
     * Validate ObjectId
     */
    _validateObjectId(id, name) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error(`Invalid ${name}`);
        }
    }
}

export default PaymentService;