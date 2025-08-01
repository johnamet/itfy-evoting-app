/**
 * Payment Service
 * 
 * Handles Paystack payment integration for vote bundles including:
 * - Payment initialization and verification
 * - Bundle and coupon validation
 * - Vote casting after successful payment
 * - Webhook handling for payment status updates
 */

import BaseService from './BaseService.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { configDotenv } from 'dotenv';

configDotenv();

// Repositories
import PaymentRepository from '../repositories/PaymentRepository.js';
import VoteBundleRepository from '../repositories/VoteBundleRepository.js';
import CouponRepository from '../repositories/CouponRepository.js';
import VoteRepository from '../repositories/VoteRepository.js';
import EventRepository from '../repositories/EventRepository.js';
import CategoryRepository from '../repositories/CategoryRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import CandidateRepository from '../repositories/CandidateRepository.js';

// Services
import VotingService from './VotingService.js';
import CouponService from './CouponService.js';
import EmailService from './EmailService.js';

class PaymentService extends BaseService {
    constructor() {
        super();
        this.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
        this.paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
        this.paystackBaseUrl = 'https://api.paystack.co';
        this.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || this.paystackSecretKey;
        
        // Initialize repositories
        this.paymentRepository = new PaymentRepository();
        this.voteBundleRepository = new VoteBundleRepository();
        this.couponRepository = new CouponRepository();
        this.voteRepository = new VoteRepository();
        this.eventRepository = new EventRepository();
        this.categoryRepository = new CategoryRepository();
        this.userRepository = new UserRepository();
        this.candidateRepository = new CandidateRepository();
        
        // Initialize services
        this.votingService = new VotingService();
        this.couponService = new CouponService();
        this.emailService = new EmailService();
        
        if (!this.paystackSecretKey) {
            throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
        }
    }

    /**
     * Initialize payment for a vote bundle with optional coupon
     * @param {Object} paymentData - Payment initialization data
     * @returns {Promise<Object>} Payment initialization response
     */
    async initializePayment(paymentData) {
        try {
            this._log('initialize_payment', { 
                email: paymentData.voter.email,
                bundleId: paymentData.bundleId,
                eventId: paymentData.eventId,
                categoryId: paymentData.categoryId,
                couponCode: paymentData.couponCode
            });

            // Validate required fields
            this._validateRequiredFields(paymentData, ['voter', 'bundleId', 'eventId', 'categoryId']);
            this._validateRequiredFields(paymentData.voter, ['email', 'ipAddress']);

            // Check if voter has already paid for this event/category
            const existingPayment = await this.paymentRepository.hasVoterPaid(
                paymentData.voter.email,
                paymentData.eventId,
                paymentData.categoryId
            );

            if (existingPayment) {
                if (existingPayment.status === 'success') {
                    throw new Error('You have already purchased votes for this event and category');
                } else if (existingPayment.status === 'pending' && !existingPayment.isExpired) {
                    // Return existing pending payment
                    return {
                        success: true,
                        message: 'Existing payment found',
                        data: {
                            payment: existingPayment,
                            authorization_url: existingPayment.paystackData.authorization_url,
                            access_code: existingPayment.paystackData.access_code,
                            reference: existingPayment.reference
                        }
                    };
                }
            }

            // Validate bundle and get pricing
            const bundleValidation = await this._validateVoteBundle(
                paymentData.bundleId, 
                paymentData.eventId, 
                paymentData.categoryId
            );

            if (!bundleValidation.isValid) {
                throw new Error(bundleValidation.message);
            }

            const bundle = bundleValidation.bundle;
            let originalAmount = bundle.price;
            let discountAmount = 0;
            let coupon = null;

            // Apply coupon if provided
            if (paymentData.couponCode) {
                const couponValidation = await this._validateAndApplyCoupon(
                    paymentData.couponCode,
                    paymentData.eventId,
                    paymentData.categoryId,
                    originalAmount
                );

                if (!couponValidation.isValid) {
                    throw new Error(couponValidation.message);
                }

                coupon = couponValidation.coupon;
                discountAmount = couponValidation.discountAmount;
            }

            const finalAmount = originalAmount - discountAmount;

            // Generate unique reference
            const reference = this._generatePaymentReference();

            // Create payment record
            const paymentRecord = await this.paymentRepository.create({
                reference,
                voter: {
                    email: paymentData.voter.email.toLowerCase(),
                    contact: paymentData.voter.contact,
                    name: paymentData.voter.name,
                    ipAddress: paymentData.voter.ipAddress,
                    userAgent: paymentData.voter.userAgent
                },
                voteBundle: paymentData.bundleId,
                event: paymentData.eventId,
                category: paymentData.categoryId,
                coupon: coupon?._id,
                originalAmount,
                discountAmount,
                finalAmount,
                currency: paymentData.currency || 'GHS',
                votesRemaining: bundle.votes,
                metadata: {
                    fraud_check: await this._performFraudCheck(paymentData.voter)
                }
            });

            // Initialize payment with Paystack
            const paystackResponse = await this._initializePaystackPayment({
                email: paymentData.voter.email,
                amount: finalAmount,
                reference,
                metadata: {
                    payment_id: paymentRecord._id,
                    event_id: paymentData.eventId,
                    category_id: paymentData.categoryId,
                    bundle_id: paymentData.bundleId,
                    voter_email: paymentData.voter.email
                }
            });

            // Update payment record with Paystack data
            await this.paymentRepository.updateById(paymentRecord._id, {
                'paystackData.authorization_url': paystackResponse.authorization_url,
                'paystackData.access_code': paystackResponse.access_code
            });

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
            this._logError('initialize_payment_error', error);
            throw error;
        }
    }

    /**
     * Perform fraud check on voter data
     * @param {Object} voter - Voter information
     * @returns {Promise<Object>} Fraud check result
     */
    async _performFraudCheck(voter) {
        try {
            const checks = {
                passed: true,
                reasons: []
            };

            // Check for excessive payments from same IP in short time
            const recentPayments = await this.paymentRepository.findByIpAddress(
                voter.ipAddress, 
                { timeframe: 60 * 60 * 1000 } // Last hour
            );

            if (recentPayments.length > 5) {
                checks.passed = false;
                checks.reasons.push('Excessive payments from IP address');
            }

            // Check for suspicious email patterns
            if (voter.email.includes('+') && voter.email.split('+').length > 2) {
                checks.passed = false;
                checks.reasons.push('Suspicious email pattern');
            }

            return checks;
        } catch (error) {
            this._logError('fraud_check_error', error);
            return { passed: true, reasons: [] };
        }
    }

    /**
     * Verify payment with Paystack and update status
     * @param {string} reference - Payment reference
     * @returns {Promise<Object>} Verification result
     */
    async verifyPayment(reference) {
        try {
            this._log('verify_payment', { reference });

            // Get payment record
            const payment = await this.paymentRepository.findByReference(reference, {
                populate: [
                    { path: 'user', select: 'name email' },
                    { path: 'voteBundle', select: 'name votes price' },
                    { path: 'event', select: 'name' },
                    { path: 'category', select: 'name' }
                ]
            });

            if (!payment) {
                throw new Error('Payment not found');
            }

            if (payment.status === 'success') {
                return {
                    success: true,
                    payment,
                    message: 'Payment already verified'
                };
            }

            // Verify with Paystack
            const verification = await this._verifyPaystackTransaction(reference);

            if (verification.status === 'success') {
                // Update payment status
                const updatedPayment = await this.paymentRepository.updateByReference(reference, {
                    status: 'success',
                    paidAt: new Date(verification.paid_at),
                    'paystackData.transaction_id': verification.id,
                    'paystackData.gateway_response': verification.gateway_response,
                    'paystackData.channel': verification.channel,
                    'paystackData.fees': verification.fees / 100, // Convert from kobo
                    'paystackData.customer': verification.customer,
                    'metadata.webhook_verified': false // Will be set to true when webhook is received
                });

                // Send payment confirmation email
                try {
                    const user = await this.userRepository.findById(payment.user);
                    const voteBundle = await this.voteBundleRepository.findById(payment.voteBundle);
                    const event = await this.eventRepository.findById(voteBundle.event);

                    await this.emailService.sendPaymentConfirmation(
                        {
                            name: user.name,
                            fullName: user.name,
                            email: user.email
                        },
                        {
                            id: updatedPayment._id,
                            amount: verification.amount / 100,
                            currency: verification.currency || 'NGN',
                            createdAt: updatedPayment.paidAt,
                            reference: verification.reference,
                            transactionId: verification.id
                        },
                        {
                            id: event._id,
                            name: event.name,
                            title: event.name,
                            votingStartDate: event.startDate,
                            votingEndDate: event.endDate
                        }
                    );
                    
                    this._log('payment_confirmation_email_sent', { 
                        userId: user._id, 
                        email: user.email,
                        reference 
                    });
                } catch (emailError) {
                    this._logError('payment_confirmation_email_failed', emailError, { reference });
                    // Don't fail the payment verification if email fails
                }

                this._log('payment_verified', { 
                    reference,
                    transactionId: verification.id,
                    amount: verification.amount / 100 
                });

                return {
                    success: true,
                    payment: updatedPayment,
                    verification,
                    message: 'Payment verified successfully'
                };

            } else {
                // Update payment status as failed
                await this.paymentRepository.updateByReference(reference, {
                    status: 'failed',
                    'paystackData.gateway_response': verification.gateway_response
                });

                return {
                    success: false,
                    payment,
                    verification,
                    message: 'Payment verification failed'
                };
            }

        } catch (error) {
            throw this._handleError(error, 'verify_payment', { reference });
        }
    }

    /**
     * Cast vote after successful payment
     * @param {string} reference - Payment reference
     * @param {string} candidateId - Candidate ID to vote for
     * @param {string} voterIp - Voter's IP address
     * @returns {Promise<Object>} Vote casting result
     */
    async castVoteAfterPayment(reference, candidateId, voterIp) {
        return await this._withTransaction(async (session) => {
            try {
                this._log('cast_vote_after_payment', { reference, candidateId });

                // Get verified payment
                const payment = await this.paymentRepository.findByReference(reference, {
                    populate: ['user', 'voteBundle', 'event', 'category']
                });

                if (!payment) {
                    throw new Error('Payment not found');
                }

                if (payment.status !== 'success') {
                    throw new Error('Payment not verified');
                }

                if (payment.votesRemaining <= 0) {
                    throw new Error('No votes remaining for this payment');
                }

                // Validate candidate
                const candidate = await this.candidateRepository.findById(candidateId);
                if (!candidate) {
                    throw new Error('Candidate not found');
                }

                if (candidate.event.toString() !== payment.event.toString()) {
                    throw new Error('Candidate does not belong to payment event');
                }

                if (candidate.category.toString() !== payment.category.toString()) {
                    throw new Error('Candidate does not belong to payment category');
                }

                // Cast the vote using VotingService
                const vote = await this.votingService.castVote({
                    userId: payment.user._id,
                    candidateId,
                    eventId: payment.event._id,
                    categoryId: payment.category._id,
                    ipAddress: voterIp,
                    paymentReference: reference
                }, { session });

                // Decrement votes remaining
                await this.paymentRepository.updateByReference(reference, {
                    $inc: { votesRemaining: -1 }
                }, { session });

                this._log('vote_cast_after_payment', { 
                    reference,
                    voteId: vote._id,
                    candidateId,
                    votesRemaining: payment.votesRemaining - 1
                });

                return {
                    success: true,
                    vote,
                    votesRemaining: payment.votesRemaining - 1,
                    message: 'Vote cast successfully'
                };

            } catch (error) {
                throw this._handleError(error, 'cast_vote_after_payment', { reference, candidateId });
            }
        });
    }

    /**
     * Handle Paystack webhook events
     * @param {Object} event - Webhook event data
     * @param {string} signature - Webhook signature
     * @returns {Promise<Object>} Webhook handling result
     */
    async handleWebhook(event, signature) {
        try {
            this._log('webhook_received', { event: event.event });

            // Verify webhook signature
            if (!this._verifyWebhookSignature(event, signature)) {
                throw new Error('Invalid webhook signature');
            }

            switch (event.event) {
                case 'charge.success':
                    return await this._handleChargeSuccess(event.data);
                
                case 'charge.failed':
                    return await this._handleChargeFailed(event.data);
                
                default:
                    this._log('unhandled_webhook', { event: event.event });
                    return { success: true, message: 'Event not handled' };
            }

        } catch (error) {
            throw this._handleError(error, 'handle_webhook', { event: event.event });
        }
    }

    /**
     * Get payment details
     * @param {string} reference - Payment reference
     * @returns {Promise<Object>} Payment details
     */
    async getPaymentDetails(reference) {
        try {
            const payment = await this.paymentRepository.findByReference(reference, {
                populate: [
                    { path: 'user', select: 'name email' },
                    { path: 'voteBundle', select: 'name votes price' },
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
                payment,
                message: 'Payment details retrieved successfully'
            };

        } catch (error) {
            throw this._handleError(error, 'get_payment_details', { reference });
        }
    }

    // Private helper methods

    /**
     * Validate vote bundle
     * @param {string} bundleId - Bundle ID
     * @param {string} eventId - Event ID
     * @param {string} categoryId - Category ID
     * @returns {Promise<Object>} Validation result
     */
    async _validateVoteBundle(bundleId, eventId, categoryId) {
        try {
            const bundle = await this.voteBundleRepository.findById(bundleId);
            
            if (!bundle) {
                return { isValid: false, message: 'Vote bundle not found' };
            }

            if (!bundle.isActive) {
                return { isValid: false, message: 'Vote bundle is not active' };
            }

            if (bundle.event.toString() !== eventId.toString()) {
                return { isValid: false, message: 'Bundle does not belong to this event' };
            }

            if (bundle.category.toString() !== categoryId.toString()) {
                return { isValid: false, message: 'Bundle does not belong to this category' };
            }

            return { isValid: true, bundle };

        } catch (error) {
            return { isValid: false, message: 'Error validating bundle: ' + error.message };
        }
    }

    /**
     * Validate and apply coupon
     * @param {string} couponCode - Coupon code
     * @param {string} eventId - Event ID
     * @param {string} categoryId - Category ID
     * @param {number} amount - Original amount
     * @returns {Promise<Object>} Validation result
     */
    async _validateAndApplyCoupon(couponCode, eventId, categoryId, amount) {
        try {
            const coupon = await this.couponRepository.findByCode(couponCode);
            
            if (!coupon) {
                return { isValid: false, message: 'Coupon not found' };
            }

            // Use CouponService to validate and calculate discount
            const validation = await this.couponService.validateCoupon({
                code: couponCode,
                eventId,
                categoryId,
                amount
            });

            if (!validation.isValid) {
                return validation;
            }

            return {
                isValid: true,
                coupon,
                discountAmount: validation.discountAmount
            };

        } catch (error) {
            return { isValid: false, message: 'Error validating coupon: ' + error.message };
        }
    }

    /**
     * Initialize Paystack transaction
     * @param {Object} data - Transaction data
     * @returns {Promise<Object>} Paystack response
     */
    async _initializePaystackTransaction(data) {
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

            return result.data;

        } catch (error) {
            throw new Error(`Paystack initialization failed: ${error.message}`);
        }
    }

    /**
     * Verify Paystack transaction
     * @param {string} reference - Transaction reference
     * @returns {Promise<Object>} Verification result
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
     * Verify webhook signature
     * @param {Object} event - Webhook event
     * @param {string} signature - Webhook signature
     * @returns {boolean} Verification result
     */
    _verifyWebhookSignature(event, signature) {
        try {
            const hash = crypto
                .createHmac('sha512', this.webhookSecret)
                .update(JSON.stringify(event))
                .digest('hex');
            
            return hash === signature;
        } catch (error) {
            this._log('webhook_signature_error', { error: error.message });
            return false;
        }
    }

    /**
     * Handle successful charge webhook
     * @param {Object} data - Charge data
     * @returns {Promise<Object>} Handling result
     */
    async _handleChargeSuccess(data) {
        try {
            const reference = data.reference;
            
            const updatedPayment = await this.paymentRepository.updateByReference(reference, {
                status: 'success',
                paidAt: new Date(data.paid_at),
                'paystackData.transaction_id': data.id,
                'paystackData.gateway_response': data.gateway_response,
                'paystackData.channel': data.channel,
                'paystackData.fees': data.fees / 100,
                'paystackData.customer': data.customer,
                'metadata.webhook_verified': true
            });

            this._log('webhook_charge_success', { 
                reference,
                transactionId: data.id,
                amount: data.amount / 100
            });

            return {
                success: true,
                payment: updatedPayment,
                message: 'Charge success processed'
            };

        } catch (error) {
            throw this._handleError(error, 'handle_charge_success', data);
        }
    }

    /**
     * Handle failed charge webhook
     * @param {Object} data - Charge data
     * @returns {Promise<Object>} Handling result
     */
    async _handleChargeFailed(data) {
        try {
            const reference = data.reference;
            
            const updatedPayment = await this.paymentRepository.updateByReference(reference, {
                status: 'failed',
                'paystackData.gateway_response': data.gateway_response,
                'metadata.webhook_verified': true
            });

            this._log('webhook_charge_failed', { 
                reference,
                reason: data.gateway_response
            });

            return {
                success: true,
                payment: updatedPayment,
                message: 'Charge failure processed'
            };

        } catch (error) {
            throw this._handleError(error, 'handle_charge_failed', data);
        }
    }

    /**
     * Generate unique payment reference
     * @returns {string} Payment reference
     */
    _generatePaymentReference() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `PAY_${timestamp}_${random}`;
    }

    /**
     * Validate required fields
     * @param {Object} data - Data to validate
     * @param {Array} requiredFields - Required field names
     */
    _validateRequiredFields(data, requiredFields) {
        for (const field of requiredFields) {
            if (!data[field]) {
                throw new Error(`${field} is required`);
            }
        }
    }
}

export default PaymentService;
