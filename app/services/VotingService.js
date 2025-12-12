/**
 * VotingService
 * 
 * Handles vote casting with duplicate prevention, validation, results aggregation,
 * analytics, and vote bundle management. Enforces voting rules and integrity.
 * 
 * @extends BaseService
 * @module services/VotingService
 * @version 2.0.0
 */

import BaseService from './BaseService.js';

export default class VotingService extends BaseService {
    constructor(repositories, options = {}) {
        super(repositories, {
            serviceName: 'VotingService',
            primaryRepository: 'vote',
        });
        
        this.emailService = options.emailService || null;
        this.notificationService = options.notificationService || null;
    }

    /**
     * Cast votes with vote bundle validation, coupon application, and payment verification (Anonymous/Public)
     * 
     * Flow:
     * 1. Voter selects vote bundles (with quantity)
     * 2. Optional: Applies coupon code
     * 3. System calculates total with bundle discounts and coupon
     * 4. Voter pays via payment gateway
     * 5. System verifies payment amount matches calculated total
     * 6. Creates vote(s) based on purchased bundle quantities
     * 
     * @param {Object} voteData - Vote casting data
     * @param {string} voteData.eventId - Event ID
     * @param {string} voteData.candidateId - Candidate ID  
     * @param {string} voteData.categoryId - Category ID
     * @param {string} voteData.voterEmail - Voter email (anonymous identifier)
     * @param {string} voteData.voterName - Voter name (optional)
     * @param {Array} voteData.voteBundles - Array of {bundleId, quantity}
     * @param {string} voteData.couponCode - Coupon code (optional)
     * @param {string} voteData.paymentReference - Payment reference from gateway
     * @param {Object} metadata - Request metadata (IP, user agent, etc.)
     */
    async castVote(voteData, metadata = {}) {
        return this.runInContext('castVote', async () => {
            // Validate required fields for anonymous voting with bundles
            this.validateRequiredFields(voteData, [
                'eventId', 
                'candidateId', 
                'categoryId', 
                'voterEmail', 
                'voteBundles',
                'paymentReference'
            ]);

            const { 
                eventId, 
                candidateId, 
                categoryId, 
                voterEmail, 
                voterName, 
                voteBundles,
                couponCode,
                paymentReference 
            } = voteData;

            // Validate email format
            if (!this.validateEmail(voterEmail)) {
                throw new Error('Invalid email format');
            }

            // Validate vote bundles structure
            if (!Array.isArray(voteBundles) || voteBundles.length === 0) {
                throw new Error('At least one vote bundle is required');
            }

            for (const bundle of voteBundles) {
                if (!bundle.bundleId || !bundle.quantity) {
                    throw new Error('Each bundle must have bundleId and quantity');
                }
                if (bundle.quantity < 1) {
                    throw new Error('Bundle quantity must be at least 1');
                }
            }

            // Check if event exists and is active
            const event = await this.repo('event').findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            if (event.status !== 'active' && event.status !== 'voting_open') {
                throw new Error(`Voting is not allowed. Event status: ${event.status}`);
            }

            // Check if voting period is valid
            const now = new Date();
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);

            if (now < startDate) {
                throw new Error('Voting has not started yet');
            }

            if (now > endDate) {
                throw new Error('Voting period has ended');
            }

            // Check if category exists and belongs to event
            const category = await this.repo('category').findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            if (category.event.toString() !== eventId.toString()) {
                throw new Error('Category does not belong to this event');
            }

            // Check if category allows voting (status check)
            if (category.votingStatus === 'accepting_nominations') {
                throw new Error('Category is still accepting nominations. Voting has not opened yet.');
            }

            if (category.votingStatus === 'closed') {
                throw new Error('Voting for this category has been closed');
            }

            // Check if candidate exists and is active
            const candidate = await this.repo('candidate').findById(candidateId);
            if (!candidate) {
                throw new Error('Candidate not found');
            }

            if (candidate.status !== 'active' && candidate.status !== 'approved') {
                throw new Error(`Candidate is not available for voting. Status: ${candidate.status}`);
            }

            if (candidate.event?.toString() !== eventId.toString()) {
                throw new Error('Candidate does not belong to this event');
            }

            // Verify candidate belongs to category
            if (!candidate.categories?.some(cat => cat.toString() === categoryId.toString())) {
                throw new Error('Candidate does not belong to this category');
            }

            // STEP 1: Validate all vote bundles for this event/category
            const validatedBundles = await this._validateVoteBundles(
                voteBundles, 
                eventId, 
                categoryId
            );

            // STEP 2: Calculate total with bundle discounts and coupon
            const pricing = await this._calculateTotalWithCoupon(
                validatedBundles,
                couponCode,
                voterEmail,
                eventId
            );

            // STEP 3: Verify payment exists and matches calculated amount
            const payment = await this._verifyPaymentAmount(
                paymentReference,
                pricing.total,
                voterEmail,
                eventId
            );

            // STEP 4: Check for duplicate vote using email + event + category
            // Only enforce if category does NOT allow multiple votes
            if (!category.votingRules?.allowMultiple) {
                const duplicateQuery = {
                    event: eventId,
                    category: categoryId,
                    'voter.email': voterEmail.toLowerCase(),
                };

                const existingVote = await this.repo('vote').findOne(duplicateQuery);

                if (existingVote) {
                    throw new Error('You have already voted in this category. Multiple votes are not allowed.');
                }
            } else {
                // Category allows multiple votes - check maxVotes limit if set
                if (category.votingRules?.maxVotes) {
                    const existingVotesCount = await this.repo('vote').countDocuments({
                        event: eventId,
                        category: categoryId,
                        'voter.email': voterEmail.toLowerCase(),
                    });

                    if (existingVotesCount >= category.votingRules.maxVotes) {
                        throw new Error(`You have reached the maximum vote limit (${category.votingRules.maxVotes}) for this category`);
                    }
                }
            }

            // Additional IP-based duplicate check for extra security
            if (metadata.ipAddress) {
                const recentVoteFromIP = await this.repo('vote').findOne({
                    event: eventId,
                    category: categoryId,
                    'source.ipAddress': metadata.ipAddress,
                    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
                });

                if (recentVoteFromIP && recentVoteFromIP.voter.email.toLowerCase() !== voterEmail.toLowerCase()) {
                    this.log('warn', 'Multiple votes from same IP detected', {
                        ip: metadata.ipAddress,
                        eventId,
                        categoryId
                    });
                }
            }

            // STEP 5: Calculate total votes from all bundles
            const totalVotesToCast = validatedBundles.reduce(
                (sum, bundle) => sum + (bundle.votes * bundle.quantity), 
                0
            );

            // STEP 6: Create votes (one vote record for this transaction, tracking all purchased bundles)
            const voteRecord = {
                candidate: candidateId,
                event: eventId,
                category: categoryId,
                voter: {
                    email: voterEmail.toLowerCase(),
                    name: voterName || 'Anonymous',
                    userId: null // No user ID for anonymous voting
                },
                voteBundles: validatedBundles.map(b => b._id), // Reference all purchased bundles
                verification: {
                    paymentVerified: true,
                    paymentId: payment._id,
                    eligibilityChecked: true,
                    eligibilityValid: true,
                    duplicateChecked: true,
                    isDuplicate: false
                },
                source: {
                    ipAddress: metadata.ipAddress,
                    userAgent: metadata.userAgent,
                    device: metadata.device,
                    location: metadata.location,
                    referrer: metadata.referrer,
                    platform: metadata.platform || 'web'
                },
                weight: {
                    baseWeight: 1,
                    multiplier: totalVotesToCast, // Total votes from all bundles
                    finalWeight: totalVotesToCast
                },
                status: 'valid'
            };

            // Create the vote
            const vote = await this.repo('vote').create(voteRecord);

            // STEP 7: Mark payment as used and update with vote details
            await this.repo('payment').updateById(payment._id, {
                'usage.used': true,
                'usage.usedAt': new Date(),
                'usage.votesCast': totalVotesToCast,
                'usage.votes': [vote._id]
            });

            // STEP 8: Record coupon usage if coupon was applied
            if (pricing.coupon && pricing.couponDiscount > 0) {
                try {
                    await this.repo('couponUsage').create({
                        coupon: pricing.coupon._id,
                        voter: {
                            email: voterEmail.toLowerCase(),
                            name: voterName
                        },
                        event: eventId,
                        payment: payment._id,
                        amounts: {
                            originalAmount: pricing.subtotal,
                            discountAmount: pricing.couponDiscount,
                            finalAmount: pricing.total
                        },
                        metadata: {
                            voteBundles: validatedBundles.map(b => ({
                                bundleId: b._id,
                                name: b.name,
                                quantity: b.quantity
                            }))
                        }
                    });

                    // Update coupon usage count
                    await this.repo('coupon').updateById(pricing.coupon._id, {
                        $inc: { 'usage.totalUsed': 1 }
                    });
                } catch (couponError) {
                    this.log('warn', 'Failed to record coupon usage', { 
                        error: couponError.message,
                        couponId: pricing.coupon._id 
                    });
                }
            }

            // STEP 9: Update counters with total votes cast
            await this.repo('candidate').updateById(candidateId, {
                $inc: { 'voting.totalVotes': totalVotesToCast }
            });

            await this.repo('category').updateById(categoryId, {
                $inc: { 'metrics.totalVotes': totalVotesToCast }
            });

            await this.repo('event').updateById(eventId, {
                $inc: { 'metrics.totalVotes': totalVotesToCast }
            });

            // STEP 10: Update vote bundle purchase counts
            for (const bundle of validatedBundles) {
                await this.repo('voteBundle').updateById(bundle._id, {
                    $inc: { 
                        'availability.sold': bundle.quantity,
                        'availability.remaining': -bundle.quantity
                    }
                });
            }

            // STEP 11: Send vote confirmation email (anonymous)
            if (this.emailService && voterEmail) {
                try {
                    await this.emailService.sendEmail({
                        to: voterEmail,
                        subject: `Vote Confirmation - ${event.name}`,
                        template: 'vote-confirmation',
                        data: {
                            voterName: voterName || 'Voter',
                            eventName: event.name,
                            categoryName: category.name,
                            candidateName: candidate.name,
                            totalVotes: totalVotesToCast,
                            bundles: validatedBundles.map(b => ({
                                name: b.name,
                                quantity: b.quantity,
                                votes: b.votes * b.quantity
                            })),
                            pricing: {
                                subtotal: pricing.subtotal,
                                bundleDiscount: pricing.bundleDiscount,
                                couponDiscount: pricing.couponDiscount,
                                total: pricing.total,
                                currency: pricing.currency
                            },
                            voteDate: vote.createdAt,
                            voteStatus: vote.status,
                            paymentReference: payment.reference
                        }
                    });
                } catch (emailError) {
                    this.log('warn', 'Failed to send vote confirmation email', { 
                        error: emailError.message,
                        voteId: vote._id 
                    });
                }
            }

            return this.handleSuccess(
                { 
                    vote: {
                        id: vote._id,
                        status: vote.status,
                        candidate: {
                            id: candidate._id,
                            name: candidate.name
                        },
                        category: {
                            id: category._id,
                            name: category.name
                        },
                        event: {
                            id: event._id,
                            name: event.name
                        },
                        totalVotes: totalVotesToCast,
                        bundles: validatedBundles.map(b => ({
                            id: b._id,
                            name: b.name,
                            quantity: b.quantity,
                            votesPerBundle: b.votes,
                            totalVotes: b.votes * b.quantity
                        })),
                        pricing: {
                            subtotal: pricing.subtotal,
                            bundleDiscount: pricing.bundleDiscount,
                            couponDiscount: pricing.couponDiscount,
                            couponCode: pricing.coupon?.code,
                            total: pricing.total,
                            currency: pricing.currency
                        },
                        payment: {
                            reference: payment.reference,
                            verified: true
                        },
                        timestamp: vote.createdAt
                    }
                },
                `Successfully cast ${totalVotesToCast} vote(s) for ${candidate.name}`
            );
        });
    }

    /**
     * Validate vote bundles for event/category
     * @private
     */
    async _validateVoteBundles(voteBundles, eventId, categoryId) {
        const validatedBundles = [];

        for (const bundleItem of voteBundles) {
            const { bundleId, quantity } = bundleItem;

            // Fetch bundle
            const bundle = await this.repo('voteBundle').findById(bundleId);
            if (!bundle) {
                throw new Error(`Vote bundle ${bundleId} not found`);
            }

            // Check bundle status
            if (bundle.status !== 'active' && bundle.status !== 'limited') {
                throw new Error(`Vote bundle "${bundle.name}" is not available (status: ${bundle.status})`);
            }

            // Check if bundle has expired
            if (bundle.pricing.validUntil && new Date() > new Date(bundle.pricing.validUntil)) {
                throw new Error(`Vote bundle "${bundle.name}" has expired`);
            }

            // Check if bundle is not yet valid
            if (bundle.pricing.validFrom && new Date() < new Date(bundle.pricing.validFrom)) {
                throw new Error(`Vote bundle "${bundle.name}" is not yet available`);
            }

            // Check bundle availability
            if (bundle.availability.remaining < quantity) {
                throw new Error(
                    `Insufficient stock for "${bundle.name}". Requested: ${quantity}, Available: ${bundle.availability.remaining}`
                );
            }

            // Check applicability for event
            const isApplicableToEvent = bundle.applicability.events.length === 0 || 
                bundle.applicability.events.some(e => e.toString() === eventId.toString());
            
            const isExcludedFromEvent = bundle.applicability.excludeEvents.some(
                e => e.toString() === eventId.toString()
            );

            if (!isApplicableToEvent || isExcludedFromEvent) {
                throw new Error(`Vote bundle "${bundle.name}" is not valid for this event`);
            }

            // Check applicability for category
            const isApplicableToCategory = bundle.applicability.categories.length === 0 || 
                bundle.applicability.categories.some(c => c.toString() === categoryId.toString());
            
            const isExcludedFromCategory = bundle.applicability.excludeCategories.some(
                c => c.toString() === categoryId.toString()
            );

            if (!isApplicableToCategory || isExcludedFromCategory) {
                throw new Error(`Vote bundle "${bundle.name}" is not valid for this category`);
            }

            // Add validated bundle with quantity
            validatedBundles.push({
                ...bundle.toObject(),
                quantity
            });
        }

        return validatedBundles;
    }

    /**
     * Calculate total with bundle discounts and coupon
     * @private
     */
    async _calculateTotalWithCoupon(validatedBundles, couponCode, voterEmail, eventId) {
        let subtotal = 0;
        let bundleDiscount = 0;
        const currency = validatedBundles[0]?.pricing?.currency || 'NGN';

        // Calculate subtotal and bundle discounts
        for (const bundle of validatedBundles) {
            const basePrice = bundle.pricing.basePrice * bundle.quantity;
            const effectivePrice = bundle.effectivePrice * bundle.quantity;
            
            subtotal += basePrice;
            bundleDiscount += (basePrice - effectivePrice);
        }

        const afterBundleDiscount = subtotal - bundleDiscount;
        let couponDiscount = 0;
        let coupon = null;

        // Apply coupon if provided
        if (couponCode) {
            coupon = await this.repo('coupon').findOne({
                code: couponCode.toUpperCase(),
                status: 'active'
            });

            if (!coupon) {
                throw new Error('Invalid coupon code');
            }

            // Check if coupon has expired
            if (coupon.rules.validUntil && new Date() > new Date(coupon.rules.validUntil)) {
                throw new Error('Coupon has expired');
            }

            // Check if coupon is not yet valid
            if (coupon.rules.validFrom && new Date() < new Date(coupon.rules.validFrom)) {
                throw new Error('Coupon is not yet valid');
            }

            // Check usage limits
            if (coupon.rules.usageLimit && coupon.usage.totalUsed >= coupon.rules.usageLimit) {
                throw new Error('Coupon usage limit reached');
            }

            // Check per-user usage limit
            if (coupon.rules.usageLimitPerUser) {
                const userUsageCount = await this.repo('couponUsage').count({
                    coupon: coupon._id,
                    'voter.email': voterEmail.toLowerCase()
                });

                if (userUsageCount >= coupon.rules.usageLimitPerUser) {
                    throw new Error('You have reached the usage limit for this coupon');
                }
            }

            // Check minimum purchase amount
            if (coupon.rules.minimumPurchaseAmount && afterBundleDiscount < coupon.rules.minimumPurchaseAmount) {
                throw new Error(
                    `Minimum purchase amount of ${coupon.rules.minimumPurchaseAmount} ${currency} required for this coupon`
                );
            }

            // Check event applicability
            if (coupon.rules.applicableEvents.length > 0) {
                const isApplicable = coupon.rules.applicableEvents.some(
                    e => e.toString() === eventId.toString()
                );
                if (!isApplicable) {
                    throw new Error('Coupon is not valid for this event');
                }
            }

            // Check event exclusions
            if (coupon.rules.excludeEvents.length > 0) {
                const isExcluded = coupon.rules.excludeEvents.some(
                    e => e.toString() === eventId.toString()
                );
                if (isExcluded) {
                    throw new Error('Coupon cannot be used for this event');
                }
            }

            // Check bundle applicability
            if (coupon.rules.applicableBundles.length > 0) {
                const allBundlesApplicable = validatedBundles.every(bundle => 
                    coupon.rules.applicableBundles.some(b => b.toString() === bundle._id.toString())
                );
                if (!allBundlesApplicable) {
                    throw new Error('Coupon is not valid for all selected bundles');
                }
            }

            // Calculate coupon discount
            if (coupon.discountType === 'percentage') {
                couponDiscount = (afterBundleDiscount * coupon.discount) / 100;
            } else {
                couponDiscount = coupon.discount;
            }

            // Apply maximum discount cap
            if (coupon.rules.maximumDiscountAmount && couponDiscount > coupon.rules.maximumDiscountAmount) {
                couponDiscount = coupon.rules.maximumDiscountAmount;
            }

            // Ensure discount doesn't exceed after-bundle-discount amount
            if (couponDiscount > afterBundleDiscount) {
                couponDiscount = afterBundleDiscount;
            }

            // Round to 2 decimal places
            couponDiscount = Math.round(couponDiscount * 100) / 100;
        }

        const total = afterBundleDiscount - couponDiscount;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            bundleDiscount: Math.round(bundleDiscount * 100) / 100,
            couponDiscount,
            total: Math.round(total * 100) / 100,
            currency,
            coupon
        };
    }

    /**
     * Verify payment amount matches calculated total
     * @private
     */
    async _verifyPaymentAmount(paymentReference, expectedAmount, voterEmail, eventId) {
        const payment = await this.repo('payment').findOne({
            reference: paymentReference
        });

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check payment status
        if (payment.status !== 'success') {
            throw new Error(`Payment has not been successful. Status: ${payment.status}`);
        }

        // Check if payment already used
        if (payment.usage?.used === true) {
            throw new Error('Payment has already been used for voting');
        }

        // Verify payment email matches voter email
        if (payment.voter.email.toLowerCase() !== voterEmail.toLowerCase()) {
            throw new Error('Payment email does not match voter email');
        }

        // Verify payment event matches vote event
        if (payment.event.toString() !== eventId.toString()) {
            throw new Error('Payment is not for this event');
        }

        // Verify payment amount matches expected total
        // Allow 1% tolerance for rounding differences
        const tolerance = expectedAmount * 0.01;
        const amountDifference = Math.abs(payment.amounts.total - expectedAmount);

        if (amountDifference > tolerance) {
            throw new Error(
                `Payment amount mismatch. Expected: ${expectedAmount}, Paid: ${payment.amounts.total}`
            );
        }

        return payment;
    }

    /**
     * Check if an email has already voted in event/category (Anonymous check)
     */
    async checkIfVoted(email, eventId, categoryId = null) {
        return this.runInContext('checkIfVoted', async () => {
            if (!email || !eventId) {
                throw new Error('Email and eventId are required');
            }

            const query = {
                event: eventId,
                'voter.email': email.toLowerCase()
            };

            if (categoryId) {
                query.category = categoryId;
            }

            const vote = await this.repo('vote').findOne(query);

            return !!vote; // Returns true if vote exists, false otherwise
        });
    }

    /**
     * Get vote by ID (Admin only - for verification/audit)
     */
    async getVote(voteId) {
        return this.runInContext('getVote', async () => {
            const vote = await this.repo('vote').findById(voteId);
            
            if (!vote) {
                throw new Error('Vote not found');
            }

            // Get related data
            const [event, candidate, category] = await Promise.all([
                this.repo('event').findById(vote.event),
                this.repo('candidate').findById(vote.candidate),
                this.repo('category').findById(vote.category)
            ]);

            return this.handleSuccess({
                vote: {
                    id: vote._id,
                    status: vote.status,
                    timestamp: vote.createdAt,
                    voter: {
                        email: vote.voter.email,
                        name: vote.voter.name
                    },
                    source: vote.source,
                    verification: vote.verification
                },
                event: event ? { id: event._id, name: event.name } : null,
                candidate: candidate ? { id: candidate._id, name: candidate.name } : null,
                category: category ? { id: category._id, name: category.name } : null,
            }, 'Vote retrieved successfully');
        });
    }

    /**
     * Get vote history by email (Anonymous voter checking their votes)
     */
    async getVoteHistoryByEmail(email, pagination = {}) {
        return this.runInContext('getVoteHistoryByEmail', async () => {
            if (!email) {
                throw new Error('Email is required');
            }

            if (!this.validateEmail(email)) {
                throw new Error('Invalid email format');
            }

            const { page = 1, limit = 20 } = pagination;

            const result = await this.repo('vote').findPaginated(
                { 'voter.email': email.toLowerCase(), status: 'valid' },
                { 
                    page, 
                    limit, 
                    sort: { createdAt: -1 },
                    populate: ['event', 'candidate', 'category']
                }
            );

            // Format response with minimal voter info
            const formattedVotes = result.data.map(vote => ({
                id: vote._id,
                event: {
                    id: vote.event?._id,
                    name: vote.event?.name
                },
                candidate: {
                    id: vote.candidate?._id,
                    name: vote.candidate?.name,
                    profileImage: vote.candidate?.profileImage
                },
                category: {
                    id: vote.category?._id,
                    name: vote.category?.name
                },
                timestamp: vote.createdAt,
                status: vote.status
            }));

            return this.handleSuccess(
                {
                    votes: formattedVotes,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: result.limit,
                        pages: result.pages
                    }
                },
                'Vote history retrieved successfully'
            );
        });
    }

    /**
     * Get event votes with filters
     */
    async getEventVotes(eventId, filters = {}, pagination = {}) {
        return this.runInContext('getEventVotes', async () => {
            const { page, limit } = this.parsePagination(pagination);

            const query = { eventId };

            // Filter by candidate
            if (filters.candidateId) {
                query.candidateId = filters.candidateId;
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

            const votes = await this.repo('vote').findWithPagination(query, {
                page,
                limit,
                sort: { createdAt: -1 },
            });

            return this.handleSuccess(
                this.createPaginatedResponse(votes.docs, votes.total, page, limit),
                'Event votes retrieved successfully'
            );
        });
    }

    /**
     * Get votes by event/category (Admin analytics)
     */
    async getVotesByCategory(eventId, categoryId, pagination = {}) {
        return this.runInContext('getVotesByCategory', async () => {
            const { page = 1, limit = 50 } = pagination;

            const result = await this.repo('vote').findPaginated(
                { 
                    event: eventId,
                    category: categoryId,
                    status: 'valid'
                },
                { 
                    page, 
                    limit, 
                    sort: { createdAt: -1 },
                    populate: ['candidate']
                }
            );

            return this.handleSuccess(
                {
                    votes: result.data,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: result.limit,
                        pages: result.pages
                    }
                },
                'Votes retrieved successfully'
            );
        });
    }

    /**
     * Get event voting statistics
     */
    async getEventVotingStatistics(eventId) {
        return this.runInContext('getEventVotingStatistics', async () => {
            const event = await this.repo('event').findById(eventId);
            
            if (!event) {
                throw new Error('Event not found');
            }

            // Total votes
            const totalVotes = await this.repo('vote').count({ eventId });

            // Unique voters
            const uniqueVoters = await this.repo('vote').distinct('voterId', { eventId });

            // Votes per candidate
            const votesPerCandidate = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: '$candidateId',
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { votes: -1 } },
            ]);

            // Get candidate details
            const candidateIds = votesPerCandidate.map(v => v._id);
            const candidates = await this.repo('candidate').find({
                _id: { $in: candidateIds },
            });

            const candidateMap = new Map(
                candidates.map(c => [c._id.toString(), c])
            );

            const detailedVotes = votesPerCandidate.map((v, index) => {
                const candidate = candidateMap.get(v._id.toString());
                return {
                    rank: index + 1,
                    candidateId: v._id,
                    candidateName: candidate?.name,
                    votes: v.votes,
                    percentage: totalVotes > 0 ? ((v.votes / totalVotes) * 100).toFixed(2) : 0,
                };
            });

            // Votes over time
            const votesOverTime = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d %H:00',
                                date: '$createdAt',
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            // Voter participation rate
            const totalUsers = await this.repo('user').count({ status: 'active' });
            const participationRate = totalUsers > 0
                ? ((uniqueVoters.length / totalUsers) * 100).toFixed(2)
                : 0;

            return this.handleSuccess({
                event: {
                    id: event._id,
                    name: event.name,
                    status: event.status,
                },
                statistics: {
                    totalVotes,
                    uniqueVoters: uniqueVoters.length,
                    participationRate,
                    votesPerCandidate: detailedVotes,
                    votesOverTime,
                },
            }, 'Statistics retrieved successfully');
        });
    }

    /**
     * Get available vote bundles for an event
     */
    async getEventVoteBundles(eventId) {
        return this.runInContext('getEventVoteBundles', async () => {
            if (!eventId) {
                throw new Error('Event ID is required');
            }

            // Check if event exists
            const event = await this.repo('event').findById(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Get bundles that are:
            // 1. Active
            // 2. Applicable to this event (or globally applicable)
            // 3. Not excluded from this event
            // 4. Available (not sold out)
            const bundles = await this.repo('voteBundle').find({
                status: { $in: ['active', 'limited'] },
                $or: [
                    { 'applicability.events': eventId },
                    { 'applicability.events': { $size: 0 } }
                ],
                'applicability.excludeEvents': { $ne: eventId }
            });

            // Filter by availability and format response
            const availableBundles = bundles
                .filter(bundle => bundle.isAvailable)
                .map(bundle => ({
                    id: bundle._id,
                    name: bundle.name,
                    description: bundle.description,
                    votes: bundle.votes,
                    price: {
                        base: bundle.pricing.basePrice,
                        discount: bundle.pricing.discountPrice,
                        effective: bundle.effectivePrice,
                        currency: bundle.pricing.currency,
                        discountPercentage: bundle.pricing.discountPercentage
                    },
                    features: bundle.features,
                    availability: {
                        remaining: bundle.availability.remaining,
                        remainingPercentage: bundle.remainingPercentage,
                        limitPerUser: bundle.availability.limitPerUser
                    },
                    display: bundle.display,
                    status: bundle.status
                }))
                .sort((a, b) => a.display.order - b.display.order || a.votes - b.votes);

            return this.handleSuccess(
                { 
                    event: {
                        id: event._id,
                        name: event.name
                    },
                    bundles: availableBundles 
                },
                'Vote bundles retrieved successfully'
            );
        });
    }

    /**
     * Get available vote bundles for a category
     */
    async getCategoryVoteBundles(categoryId) {
        return this.runInContext('getCategoryVoteBundles', async () => {
            if (!categoryId) {
                throw new Error('Category ID is required');
            }

            // Check if category exists
            const category = await this.repo('category').findById(categoryId);
            if (!category) {
                throw new Error('Category not found');
            }

            // Get bundles applicable to this category
            const bundles = await this.repo('voteBundle').find({
                status: { $in: ['active', 'limited'] },
                $or: [
                    { 'applicability.categories': categoryId },
                    { 'applicability.events': category.event },
                    { 
                        'applicability.events': { $size: 0 },
                        'applicability.categories': { $size: 0 }
                    }
                ],
                'applicability.excludeCategories': { $ne: categoryId },
                'applicability.excludeEvents': { $ne: category.event }
            });

            // Filter by availability and format response
            const availableBundles = bundles
                .filter(bundle => bundle.isAvailable)
                .map(bundle => ({
                    id: bundle._id,
                    name: bundle.name,
                    description: bundle.description,
                    votes: bundle.votes,
                    price: {
                        base: bundle.pricing.basePrice,
                        discount: bundle.pricing.discountPrice,
                        effective: bundle.effectivePrice,
                        currency: bundle.pricing.currency
                    },
                    features: bundle.features,
                    availability: {
                        remaining: bundle.availability.remaining,
                        status: bundle.status
                    },
                    display: bundle.display
                }))
                .sort((a, b) => a.display.order - b.display.order || a.votes - b.votes);

            return this.handleSuccess(
                { 
                    category: {
                        id: category._id,
                        name: category.name,
                        eventId: category.event
                    },
                    bundles: availableBundles 
                },
                'Vote bundles retrieved successfully'
            );
        });
    }

    /**
     * Get all active vote bundles (Public)
     */
    async getActiveVoteBundles() {
        return this.runInContext('getActiveVoteBundles', async () => {
            const bundles = await this.repo('voteBundle').find({
                status: { $in: ['active', 'limited'] }
            });

            const availableBundles = bundles
                .filter(bundle => bundle.isAvailable)
                .map(bundle => ({
                    id: bundle._id,
                    name: bundle.name,
                    description: bundle.description,
                    votes: bundle.votes,
                    price: {
                        base: bundle.pricing.basePrice,
                        effective: bundle.effectivePrice,
                        currency: bundle.pricing.currency,
                        discountPercentage: bundle.pricing.discountPercentage
                    },
                    features: bundle.features,
                    display: bundle.display,
                    popular: bundle.popular
                }))
                .sort((a, b) => {
                    // Highlighted first
                    if (a.display.highlighted && !b.display.highlighted) return -1;
                    if (!a.display.highlighted && b.display.highlighted) return 1;
                    // Then by order
                    return a.display.order - b.display.order || a.votes - b.votes;
                });

            return this.handleSuccess(
                { bundles: availableBundles },
                'Active vote bundles retrieved successfully'
            );
        });
    }

    /**
     * Get voting analytics for event
     */
    async getVotingAnalytics(eventId, period = 'day') {
        return this.runInContext('getVotingAnalytics', async () => {
            const dateFormat = period === 'hour' ? '%Y-%m-%d %H:00' :
                               period === 'day' ? '%Y-%m-%d' :
                               '%Y-%m';

            const analytics = await this.repo('vote').aggregate([
                { $match: { eventId } },
                {
                    $group: {
                        _id: {
                            period: {
                                $dateToString: {
                                    format: dateFormat,
                                    date: '$createdAt',
                                },
                            },
                            candidateId: '$candidateId',
                        },
                        votes: { $sum: 1 },
                    },
                },
                { $sort: { '_id.period': 1 } },
            ]);

            // Get candidate names
            const candidateIds = [...new Set(analytics.map(a => a._id.candidateId))];
            const candidates = await this.repo('candidate').find({
                _id: { $in: candidateIds },
            });

            const candidateMap = new Map(
                candidates.map(c => [c._id.toString(), c.name])
            );

            // Format analytics
            const formattedAnalytics = analytics.map(a => ({
                period: a._id.period,
                candidateId: a._id.candidateId,
                candidateName: candidateMap.get(a._id.candidateId.toString()),
                votes: a.votes,
            }));

            return this.handleSuccess({
                eventId,
                period,
                analytics: formattedAnalytics,
            }, 'Analytics retrieved successfully');
        });
    }

    /**
     * Create vote bundle (admin only)
     */
    async createVoteBundle(bundleData, adminId) {
        return this.runInContext('createVoteBundle', async () => {
            // Validate required fields
            this._validateRequiredFields(bundleData, [
                'name',
                'votes',
                'pricing.basePrice',
                'pricing.currency'
            ]);

            // Validate vote count
            if (bundleData.votes < 1) {
                throw new Error('Vote count must be at least 1');
            }

            // Validate pricing
            if (bundleData.pricing.basePrice < 0) {
                throw new Error('Base price cannot be negative');
            }

            if (bundleData.pricing.discountPrice && 
                bundleData.pricing.discountPrice >= bundleData.pricing.basePrice) {
                throw new Error('Discount price must be less than base price');
            }

            // Set default status
            if (!bundleData.status) {
                bundleData.status = 'draft';
            }

            // Create bundle
            const bundle = await this.repo('voteBundle').create(bundleData);

            await this.logActivity(adminId, 'create', 'voteBundle', {
                bundleId: bundle._id,
                name: bundle.name,
                votes: bundle.votes,
                price: bundle.pricing.basePrice
            });

            return this.handleSuccess(
                { bundle },
                'Vote bundle created successfully'
            );
        });
    }

    /**
     * Update vote bundle (admin only)
     */
    async updateVoteBundle(bundleId, updateData, adminId) {
        return this.runInContext('updateVoteBundle', async () => {
            const bundle = await this.repo('voteBundle').findById(bundleId);
            
            if (!bundle) {
                throw new Error('Vote bundle not found');
            }

            // Prevent updating if bundle has been purchased
            if (bundle.availability.sold > 0 && 
                (updateData.votes || updateData.pricing)) {
                throw new Error('Cannot modify votes or pricing for bundles that have been purchased');
            }

            // Validate pricing updates
            if (updateData.pricing) {
                if (updateData.pricing.basePrice < 0) {
                    throw new Error('Base price cannot be negative');
                }

                if (updateData.pricing.discountPrice && 
                    updateData.pricing.discountPrice >= updateData.pricing.basePrice) {
                    throw new Error('Discount price must be less than base price');
                }
            }

            // Update bundle
            const updatedBundle = await this.repo('voteBundle').update(
                bundleId,
                updateData
            );

            await this.logActivity(adminId, 'update', 'voteBundle', {
                bundleId,
                updates: Object.keys(updateData)
            });

            return this.handleSuccess(
                { bundle: updatedBundle },
                'Vote bundle updated successfully'
            );
        });
    }

    /**
     * Get all vote bundles with filters (admin only)
     */
    async getAllVoteBundles(filters = {}, pagination = {}) {
        return this.runInContext('getAllVoteBundles', async () => {
            const query = {};

            // Filter by status
            if (filters.status) {
                query.status = filters.status;
            }

            // Filter by event
            if (filters.eventId) {
                query.$or = [
                    { 'applicability.events': filters.eventId },
                    { 'applicability.events': { $size: 0 } }
                ];
            }

            // Filter by category
            if (filters.categoryId) {
                query.$or = [
                    { 'applicability.categories': filters.categoryId },
                    { 'applicability.categories': { $size: 0 } }
                ];
            }

            // Search by name
            if (filters.search) {
                query.name = { $regex: filters.search, $options: 'i' };
            }

            const result = await this.repo('voteBundle').findPaginated(
                query,
                {
                    page: pagination.page || 1,
                    limit: pagination.limit || 10,
                    sort: { createdAt: -1 }
                }
            );

            return this.handleSuccess(
                {
                    bundles: result.data,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        limit: result.limit,
                        pages: result.pages
                    }
                },
                'Vote bundles retrieved successfully'
            );
        });
    }

    /**
     * Get single vote bundle details
     */
    async getVoteBundle(bundleId) {
        return this.runInContext('getVoteBundle', async () => {
            const bundle = await this.repo('voteBundle').findById(bundleId);
            
            if (!bundle) {
                throw new Error('Vote bundle not found');
            }

            return this.handleSuccess(
                { bundle },
                'Vote bundle retrieved successfully'
            );
        });
    }

    /**
     * Delete vote bundle (admin only - only if not purchased)
     */
    async deleteVoteBundle(bundleId, adminId) {
        return this.runInContext('deleteVoteBundle', async () => {
            const bundle = await this.repo('voteBundle').findById(bundleId);
            
            if (!bundle) {
                throw new Error('Vote bundle not found');
            }

            // Check if bundle has been purchased
            if (bundle.availability.sold > 0) {
                throw new Error('Cannot delete bundle that has been purchased. Use archive instead.');
            }

            await this.repo('voteBundle').delete(bundleId);

            await this.logActivity(adminId, 'delete', 'voteBundle', {
                bundleId,
                name: bundle.name
            });

            return this.handleSuccess(null, 'Vote bundle deleted successfully');
        });
    }

    /**
     * Archive vote bundle (admin only - for purchased bundles)
     */
    async archiveVoteBundle(bundleId, adminId) {
        return this.runInContext('archiveVoteBundle', async () => {
            const bundle = await this.repo('voteBundle').findById(bundleId);
            
            if (!bundle) {
                throw new Error('Vote bundle not found');
            }

            if (bundle.status === 'archived') {
                throw new Error('Bundle is already archived');
            }

            const updatedBundle = await this.repo('voteBundle').update(
                bundleId,
                { status: 'archived' }
            );

            await this.logActivity(adminId, 'archive', 'voteBundle', {
                bundleId,
                name: bundle.name,
                soldCount: bundle.availability.sold
            });

            return this.handleSuccess(
                { bundle: updatedBundle },
                'Vote bundle archived successfully'
            );
        });
    }

    /**
     * Delete vote (admin only, rare operation)
     */
    async deleteVote(voteId, adminId, reason) {
        return this.runInContext('deleteVote', async () => {
            const vote = await this.repo('vote').findById(voteId);
            
            if (!vote) {
                throw new Error('Vote not found');
            }

            // Decrement counters
            await this.repo('event').update(vote.eventId, {
                $inc: { currentVotes: -1 },
            });

            await this.repo('candidate').update(vote.candidateId, {
                $inc: { votes: -1 },
            });

            await this.repo('vote').delete(voteId);

            await this.logActivity(adminId, 'delete', 'vote', {
                voteId,
                eventId: vote.eventId,
                candidateId: vote.candidateId,
                reason,
            });

            return this.handleSuccess(null, 'Vote deleted successfully');
        });
    }
}
