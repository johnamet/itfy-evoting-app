#!/usr/bin/env node
/**
 * NominationService - Business logic for candidate nominations
 * 
 * Handles:
 * - Public nomination submissions
 * - Admin review and approval workflow
 * - Duplicate detection
 * - Email notifications
 * - Verification token management
 * - Deadline enforcement
 * 
 * @module NominationService
 * @extends BaseService
 * @version 1.0.0
 */

import BaseService from './BaseService.js';
import { emailQueue } from '../config/queue.js';
import AuthHelpers from '../utils/authHelpers.js';
import validator from 'validator';

class NominationService extends BaseService {
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'NominationService',
            primaryRepository: 'nomination',
            ...options
        });

        this.emailService = options.emailService || null;
        this.VERIFICATION_EXPIRY_DAYS = 7;
    }

    /**
     * Submit a new nomination (public endpoint)
     * 
     * @param {Object} nominationData - Nomination details
     * @param {string} nominationData.eventId - Event ID
     * @param {string} nominationData.categoryId - Category ID
     * @param {Object} nominationData.nominator - Nominator info (name, email, phone, relationship)
     * @param {Object} nominationData.nominee - Nominee info (name, email, phone, reasonForNomination)
     * @param {Object} metadata - Submission metadata (ip, userAgent)
     * @returns {Promise<Object>} Submission result
     */
    async submitNomination(nominationData, metadata = {}) {
        return this.runInContext('submitNomination', async () => {
            const { eventId, categoryId, nominator, nominee } = nominationData;

            // Validate required fields
            this._validateRequiredFields(nominationData, ['eventId', 'categoryId', 'nominator', 'nominee']);
            this._validateRequiredFields(nominator, ['name', 'email']);
            this._validateRequiredFields(nominee, ['name', 'email', 'reasonForNomination']);

            // Validate emails
            this._validateEmail(nominator.email);
            this._validateEmail(nominee.email);

            // Validate reason length
            if (nominee.reasonForNomination.length < 50) {
                throw new Error('Reason for nomination must be at least 50 characters');
            }

            if (nominee.reasonForNomination.length > 1000) {
                throw new Error('Reason for nomination cannot exceed 1000 characters');
            }

            // Check if event exists and is accepting nominations
            const event = await this.repo('event').findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Check nomination deadline
            if (event.nominationDeadline && new Date() > new Date(event.nominationDeadline)) {
                throw new Error('Nomination deadline has passed for this event');
            }

            if (!['draft', 'active', 'upcoming'].includes(event.status)) {
                throw new Error(`Event is not accepting nominations (status: ${event.status})`);
            }

            // Check if category exists and belongs to event
            const category = await this.repo('category').findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            if (category.event.toString() !== eventId) {
                throw new Error('Category does not belong to this event');
            }

            // Check for duplicate nomination
            const duplicate = await this.repo('nomination').checkDuplicate(
                eventId,
                categoryId,
                nominee.email
            );

            if (duplicate) {
                throw new Error(
                    duplicate.status === 'approved'
                        ? 'This person has already been nominated and approved for this category'
                        : 'This person has already been nominated for this category and is pending review'
                );
            }

            // Create nomination
            const nomination = await this.repo('nomination').createNomination({
                event: eventId,
                category: categoryId,
                nominator: {
                    name: nominator.name.trim(),
                    email: nominator.email.toLowerCase().trim(),
                    phone: nominator.phone?.trim(),
                    relationship: nominator.relationship?.trim()
                },
                nominee: {
                    name: nominee.name.trim(),
                    email: nominee.email.toLowerCase().trim(),
                    phone: nominee.phone?.trim(),
                    reasonForNomination: nominee.reasonForNomination.trim()
                },
                submission: {
                    submittedAt: new Date(),
                    ip: metadata.ip,
                    userAgent: metadata.userAgent
                }
            });

            // Send notification to admins
            await this._notifyAdminsOfNewNomination(nomination, event, category);

            // Send confirmation email to nominator
            if (this.emailService) {
                await emailQueue.add('nomination-confirmation', {
                    to: nominator.email,
                    nominatorName: nominator.name,
                    nomineeName: nominee.name,
                    categoryName: category.name,
                    eventName: event.name,
                    nominationId: nomination._id
                });
            }

            this.log('info', `New nomination submitted: ${nominee.name} for ${category.name}`);

            return this.handleSuccess(
                {
                    nomination: {
                        id: nomination._id,
                        status: nomination.status,
                        nomineeName: nominee.name,
                        categoryName: category.name,
                        submittedAt: nomination.submission.submittedAt
                    }
                },
                'Nomination submitted successfully and is pending admin review'
            );
        });
    }

    /**
     * Get pending nominations for admin review
     * 
     * @param {string} eventId - Event ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Paginated nominations
     */
    async getPendingNominations(eventId, options = {}) {
        return this.runInContext('getPendingNominations', async () => {
            const { page = 1, limit = 10 } = options;

            const result = await this.repo('nomination').findWithPagination(
                { event: eventId, status: 'pending' },
                page,
                limit,
                { populate: true, sort: { 'submission.submittedAt': -1 } }
            );

            return this.handleSuccess(result, 'Pending nominations retrieved');
        });
    }

    /**
     * Get all nominations for an event
     * 
     * @param {string} eventId - Event ID
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Nominations
     */
    async getNominationsByEvent(eventId, filters = {}, options = {}) {
        return this.runInContext('getNominationsByEvent', async () => {
            const { page = 1, limit = 20 } = options;

            const result = await this.repo('nomination').findWithPagination(
                { event: eventId, ...filters },
                page,
                limit,
                { populate: true, sort: { 'submission.submittedAt': -1 } }
            );

            return this.handleSuccess(result, 'Nominations retrieved');
        });
    }

    /**
     * Get nomination details
     * 
     * @param {string} nominationId - Nomination ID
     * @returns {Promise<Object>} Nomination details
     */
    async getNominationDetails(nominationId) {
        return this.runInContext('getNominationDetails', async () => {
            const nomination = await this.repo('nomination').findById(nominationId);
            
            if (!nomination) {
                throw new Error('Nomination not found');
            }

            await nomination.populate([
                { path: 'event', select: 'name startDate endDate status' },
                { path: 'category', select: 'name description' },
                { path: 'candidate', select: 'name email status credentials.emailVerified' },
                { path: 'review.reviewedBy', select: 'firstName lastName email' }
            ]);

            return this.handleSuccess({ nomination }, 'Nomination details retrieved');
        });
    }

    /**
     * Approve a nomination (admin action)
     * 
     * @param {string} nominationId - Nomination ID
     * @param {string} adminId - Admin user ID
     * @returns {Promise<Object>} Approval result with candidate details
     */
    async approveNomination(nominationId, adminId) {
        return this.runInContext('approveNomination', async () => {
            const nomination = await this.repo('nomination').findById(nominationId);
            
            if (!nomination) {
                throw new Error('Nomination not found');
            }

            if (nomination.status !== 'pending') {
                throw new Error(`Cannot approve nomination with status: ${nomination.status}`);
            }

            // Populate event and category info
            await nomination.populate(['event', 'category']);

            // Check if candidate already exists with this email for this event
            const existingCandidate = await this.repo('candidate').findOne({
                email: nomination.nominee.email,
                event: nomination.event._id
            });

            if (existingCandidate) {
                // Mark nomination as duplicate
                await this.repo('nomination').markAsDuplicate(
                    nominationId,
                    adminId,
                    existingCandidate._id
                );

                return this.handleSuccess(
                    {
                        nomination: { status: 'duplicate' },
                        candidate: existingCandidate
                    },
                    'Candidate already exists - nomination marked as duplicate'
                );
            }

            // Create placeholder candidate profile
            const candidate = await this.repo('candidate').create({
                name: nomination.nominee.name,
                email: nomination.nominee.email,
                event: nomination.event._id,
                categories: [nomination.category._id],
                nominatedCategories: [nomination.category._id],
                status: 'awaiting_verification',
                profile: {
                    contactEmail: nomination.nominee.email,
                    phone: nomination.nominee.phone
                },
                nominationForm: nomination._id,
                metadata: {
                    nominatedBy: null // External nominator, not a User
                }
            });

            // Generate verification token (7-day expiry)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + this.VERIFICATION_EXPIRY_DAYS);

            const verificationToken = await AuthHelpers.generateAndStoreVerificationToken(
                candidate._id.toString(),
                'candidate',
                this.VERIFICATION_EXPIRY_DAYS * 24 * 60 * 60 // seconds
            );

            // Update candidate with verification info
            candidate.verification = {
                token: verificationToken,
                sentAt: new Date(),
                expiresAt: expiresAt
            };
            await candidate.save();

            // Update nomination status
            await this.repo('nomination').approve(nominationId, adminId, candidate._id);

            // Send verification email to nominee
            await this._sendVerificationEmail(
                candidate,
                nomination,
                verificationToken,
                expiresAt
            );

            // Log activity
            await this.logActivity(adminId, 'approve', 'nomination', {
                nominationId,
                candidateId: candidate._id,
                nomineeName: nomination.nominee.name,
                categoryName: nomination.category.name
            });

            this.log('info', `Nomination approved: ${nomination.nominee.name} for ${nomination.category.name}`);

            return this.handleSuccess(
                {
                    nomination: { status: 'approved' },
                    candidate: {
                        id: candidate._id,
                        name: candidate.name,
                        email: candidate.email,
                        status: candidate.status,
                        verificationSentAt: candidate.verification.sentAt,
                        verificationExpiresAt: candidate.verification.expiresAt
                    }
                },
                'Nomination approved and verification email sent to nominee'
            );
        });
    }

    /**
     * Reject a nomination (admin action)
     * 
     * @param {string} nominationId - Nomination ID
     * @param {string} adminId - Admin user ID
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Rejection result
     */
    async rejectNomination(nominationId, adminId, reason) {
        return this.runInContext('rejectNomination', async () => {
            this._validateRequiredFields({ reason }, ['reason']);

            const nomination = await this.repo('nomination').findById(nominationId);
            
            if (!nomination) {
                throw new Error('Nomination not found');
            }

            if (nomination.status !== 'pending') {
                throw new Error(`Cannot reject nomination with status: ${nomination.status}`);
            }

            // Update nomination status
            await this.repo('nomination').reject(nominationId, adminId, reason);

            // Optionally send notification to nominator
            if (this.emailService) {
                await emailQueue.add('nomination-rejected', {
                    to: nomination.nominator.email,
                    nominatorName: nomination.nominator.name,
                    nomineeName: nomination.nominee.name,
                    reason: reason,
                    nominationId
                });
            }

            // Log activity
            await this.logActivity(adminId, 'reject', 'nomination', {
                nominationId,
                nomineeName: nomination.nominee.name,
                reason
            });

            this.log('info', `Nomination rejected: ${nomination.nominee.name} - ${reason}`);

            return this.handleSuccess(
                { nomination: { status: 'rejected' } },
                'Nomination rejected'
            );
        });
    }

    /**
     * Get nomination statistics
     * 
     * @param {string} eventId - Event ID
     * @returns {Promise<Object>} Statistics
     */
    async getNominationStats(eventId) {
        return this.runInContext('getNominationStats', async () => {
            const stats = await this.repo('nomination').getNominationStats(eventId);

            return this.handleSuccess({ stats }, 'Nomination statistics retrieved');
        });
    }

    /**
     * Search nominations
     * 
     * @param {string} searchText - Search query
     * @param {Object} filters - Additional filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Search results
     */
    async searchNominations(searchText, filters = {}, options = {}) {
        return this.runInContext('searchNominations', async () => {
            const nominations = await this.repo('nomination').searchNominations(
                searchText,
                filters,
                options
            );

            return this.handleSuccess(
                { nominations, count: nominations.length },
                'Search completed'
            );
        });
    }

    /**
     * Resend verification email to candidate
     * 
     * @param {string} candidateId - Candidate ID
     * @param {string} adminId - Admin user ID (optional)
     * @returns {Promise<Object>} Result
     */
    async resendVerificationEmail(candidateId, adminId = null) {
        return this.runInContext('resendVerificationEmail', async () => {
            const candidate = await this.repo('candidate').findById(candidateId);
            
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (candidate.status !== 'awaiting_verification') {
                throw new Error(`Cannot resend verification for candidate with status: ${candidate.status}`);
            }

            // Check if previous token is still valid (to prevent spam)
            if (candidate.verification?.expiresAt && new Date() < new Date(candidate.verification.expiresAt)) {
                const hoursRemaining = Math.ceil(
                    (new Date(candidate.verification.expiresAt) - new Date()) / (1000 * 60 * 60)
                );
                
                if (hoursRemaining > 24) { // Only allow resend if less than 24 hours remain
                    throw new Error('Verification email was recently sent. Please wait before requesting another.');
                }
            }

            // Generate new verification token
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + this.VERIFICATION_EXPIRY_DAYS);

            const verificationToken = await AuthHelpers.generateAndStoreVerificationToken(
                candidate._id.toString(),
                'candidate',
                this.VERIFICATION_EXPIRY_DAYS * 24 * 60 * 60
            );

            // Update candidate
            candidate.verification = {
                token: verificationToken,
                sentAt: new Date(),
                expiresAt: expiresAt
            };
            await candidate.save();

            // Get nomination and category info
            const nomination = await this.repo('nomination').findById(candidate.nominationForm);
            await nomination.populate('category');

            // Send verification email
            await this._sendVerificationEmail(
                candidate,
                nomination,
                verificationToken,
                expiresAt
            );

            if (adminId) {
                await this.logActivity(adminId, 'resend_verification', 'candidate', {
                    candidateId,
                    candidateName: candidate.name
                });
            }

            this.log('info', `Verification email resent to: ${candidate.email}`);

            return this.handleSuccess(
                {
                    verificationSentAt: candidate.verification.sentAt,
                    verificationExpiresAt: candidate.verification.expiresAt
                },
                'Verification email sent'
            );
        });
    }

    /**
     * Process expired verification tokens (background job)
     * 
     * @returns {Promise<Object>} Processing result
     */
    async processExpiredVerifications() {
        return this.runInContext('processExpiredVerifications', async () => {
            const expiredCandidates = await this.repo('candidate').find({
                status: 'awaiting_verification',
                'verification.expiresAt': { $lt: new Date() }
            });

            let processedCount = 0;

            for (const candidate of expiredCandidates) {
                await candidate.markAsExpired();
                
                // Update nomination if it exists
                if (candidate.nominationForm) {
                    const nomination = await this.repo('nomination').findById(candidate.nominationForm);
                    if (nomination && nomination.status === 'approved') {
                        nomination.review = nomination.review || {};
                        nomination.review.notes = 'Verification deadline expired';
                        await nomination.save();
                    }
                }

                processedCount++;
                this.log('info', `Marked candidate as expired: ${candidate.email}`);
            }

            return this.handleSuccess(
                { processedCount },
                `Processed ${processedCount} expired verifications`
            );
        });
    }

    // ================================
    // PRIVATE HELPER METHODS
    // ================================

    /**
     * Send verification email to nominee
     * @private
     */
    async _sendVerificationEmail(candidate, nomination, token, expiresAt) {
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-nomination/${token}`;
        
        await emailQueue.add('nominee-verification', {
            to: candidate.email,
            nomineeName: candidate.name,
            categoryName: nomination.category.name,
            eventName: nomination.event?.name || 'the event',
            verificationUrl,
            expiresAt: expiresAt.toLocaleDateString(),
            reasonForNomination: nomination.nominee.reasonForNomination,
            nominatorName: nomination.nominator.name
        });
    }

    /**
     * Notify admins of new nomination
     * @private
     */
    async _notifyAdminsOfNewNomination(nomination, event, category) {
        // Get admin users (level 3+)
        const admins = await this.repo('user').find({
            level: { $gte: 3 },
            status: 'active'
        });

        for (const admin of admins) {
            if (this.emailService) {
                await emailQueue.add('admin-new-nomination', {
                    to: admin.email,
                    adminName: `${admin.firstName} ${admin.lastName}`,
                    nomineeName: nomination.nominee.name,
                    nominatorName: nomination.nominator.name,
                    categoryName: category.name,
                    eventName: event.name,
                    reviewUrl: `${process.env.ADMIN_URL || 'http://localhost:3000/admin'}/nominations/${nomination._id}`,
                    reason: nomination.nominee.reasonForNomination.substring(0, 200) + '...'
                });
            }
        }
    }
}

export default NominationService;
