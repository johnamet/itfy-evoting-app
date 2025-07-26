#!/usr/bin/env node
/**
 * VoteBundle Repository
 * 
 * Extends BaseRepository to provide VoteBundle-specific database operations.
 * Handles vote bundle packages, pricing, popularity, and coupon integration.
 * 
 * @module VoteBundleRepository
 */

import mongoose from 'mongoose';
import BaseRepository from './BaseRepository.js';
import VoteBundle from '../models/VoteBundle.js';

/**
 * Repository class for managing VoteBundle operations.
 * @extends BaseRepository
 */
class VoteBundleRepository extends BaseRepository {
    /**
     * Initializes the repository with the VoteBundle model.
     */
    constructor() {
        super(VoteBundle);
    }

    /**
     * Creates a new vote bundle with validated data.
     * @param {Object} bundleData - The data for the new vote bundle.
     * @param {Object} [options={}] - Additional Mongoose options (e.g., session).
     * @returns {Promise<Object>} The created vote bundle.
     * @throws {Error} If validation fails or the operation encounters an error.
     */
    async createBundle(bundleData, options = {}) {
        try {
            this._validateBundleData(bundleData);

            // Normalize input arrays and defaults
            bundleData.features = Array.isArray(bundleData.features) ? bundleData.features : [bundleData.features].filter(Boolean);
            bundleData.applicableEvents = Array.isArray(bundleData.applicableEvents) ? bundleData.applicableEvents : [bundleData.applicableEvents].filter(Boolean);
            bundleData.applicableCategories = Array.isArray(bundleData.applicableCategories) ? bundleData.applicableCategories : [bundleData.applicableCategories].filter(Boolean);
            bundleData.currency = bundleData.currency || 'GHS';

            return await this.create(bundleData, options);
        } catch (error) {
            throw this._handleError(error, 'createBundle');
        }
    }

    /**
     * Finds vote bundles by popularity status.
     * @param {boolean} [isPopular=true] - Whether to find popular bundles.
     * @param {Object} [options={}] - Query options (e.g., populate, sort).
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByPopularity(isPopular = true, options = {}) {
        try {
            const criteria = { popular: isPopular, isActive: true };
            return await this.find(criteria, {
                ...options,
                sort: { votes: -1, price: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByPopularity');
        }
    }

    /**
     * Finds vote bundles within a specified price range.
     * @param {number} minPrice - Minimum price.
     * @param {number} maxPrice - Maximum price.
     * @param {string} [currency=null] - Currency filter.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByPriceRange(minPrice, maxPrice, currency = null, options = {}) {
        try {
            const criteria = {
                price: { $gte: minPrice, $lte: maxPrice },
                isActive: true
            };
            if (currency) criteria.currency = currency;

            return await this.find(criteria, {
                ...options,
                sort: { price: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByPriceRange');
        }
    }

    /**
     * Finds vote bundles within a specified vote count range.
     * @param {number} minVotes - Minimum vote count.
     * @param {number} [maxVotes=null] - Maximum vote count.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByVoteRange(minVotes, maxVotes = null, options = {}) {
        try {
            const criteria = { votes: { $gte: minVotes }, isActive: true };
            if (maxVotes !== null) criteria.votes.$lte = maxVotes;

            return await this.find(criteria, {
                ...options,
                sort: { votes: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByVoteRange');
        }
    }

    /**
     * Finds vote bundles applicable to a specific event.
     * @param {string|ObjectId} eventId - The event ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByEvent(eventId, options = {}) {
        try {
            const criteria = {
                applicableEvents: new mongoose.Types.ObjectId(eventId),
                isActive: true
            };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'applicableEvents', select: 'name status' },
                    { path: 'applicableCategories', select: 'name' },
                    { path: 'createdBy', select: 'name email' }
                ],
                sort: { popular: -1, votes: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByEvent');
        }
    }

    /**
     * Finds vote bundles applicable to a specific category.
     * @param {string|ObjectId} categoryId - The category ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByCategory(categoryId, options = {}) {
        try {
            const criteria = {
                applicableCategories: new mongoose.Types.ObjectId(categoryId),
                isActive: true
            };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'applicableEvents', select: 'name status' },
                    { path: 'applicableCategories', select: 'name' },
                    { path: 'createdBy', select: 'name email' }
                ],
                sort: { popular: -1, votes: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByCategory');
        }
    }

    /**
     * Finds vote bundles applicable to both an event and category.
     * @param {string|ObjectId} eventId - The event ID.
     * @param {string|ObjectId} categoryId - The category ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByEventAndCategory(eventId, categoryId, options = {}) {
        try {
            const criteria = {
                applicableEvents: new mongoose.Types.ObjectId(eventId),
                applicableCategories: new mongoose.Types.ObjectId(categoryId),
                isActive: true
            };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'applicableEvents', select: 'name status' },
                    { path: 'applicableCategories', select: 'name' }
                ],
                sort: { popular: -1, votes: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByEventAndCategory');
        }
    }

    /**
     * Finds vote bundles created by a specific user.
     * @param {string|ObjectId} userId - The user ID.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByCreator(userId, options = {}) {
        try {
            const criteria = { createdBy: new mongoose.Types.ObjectId(userId) };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'applicableEvents', select: 'name status' },
                    { path: 'applicableCategories', select: 'name' }
                ],
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByCreator');
        }
    }

    /**
     * Finds vote bundles with specific features.
     * @param {string|string[]} features - Feature(s) to search for.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findByFeatures(features, options = {}) {
        try {
            const featureArray = Array.isArray(features) ? features : [features];
            const criteria = { features: { $in: featureArray }, isActive: true };
            return await this.find(criteria, {
                ...options,
                sort: { popular: -1, votes: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findByFeatures');
        }
    }

    /**
     * Finds active vote bundles.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of active vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findActive(options = {}) {
        try {
            const criteria = { isActive: true };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'applicableEvents', select: 'name status' },
                    { path: 'applicableCategories', select: 'name' },
                    { path: 'createdBy', select: 'name email' }
                ],
                sort: { popular: -1, votes: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findActive');
        }
    }

    /**
     * Finds inactive vote bundles.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of inactive vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findInactive(options = {}) {
        try {
            const criteria = { isActive: false };
            return await this.find(criteria, {
                ...options,
                populate: [{ path: 'createdBy', select: 'name email' }],
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findInactive');
        }
    }

    /**
     * Finds vote bundles eligible for coupons.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of coupon-eligible vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async findCouponEligible(options = {}) {
        try {
            const criteria = {
                $or: [
                    { applicableCoupons: { $exists: true, $ne: [] } },
                    { price: { $gte: 10 } }
                ],
                isActive: true
            };
            return await this.find(criteria, {
                ...options,
                populate: [
                    { path: 'applicableCoupons', select: 'code discountType discount expiryDate isActive' },
                    { path: 'applicableEvents', select: 'name status' },
                    { path: 'applicableCategories', select: 'name' }
                ],
                sort: { price: -1, votes: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'findCouponEligible');
        }
    }

    /**
     * Retrieves the best value vote bundles based on votes per price ratio.
     * @param {number} [limit=10] - Number of bundles to return.
     * @param {string} [currency=null] - Currency filter.
     * @returns {Promise<Array>} Array of best value vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async getBestValueBundles(limit = 10, currency = null) {
        try {
            const matchStage = { isActive: true };
            if (currency) matchStage.currency = currency;

            const pipeline = [
                { $match: matchStage },
                { $addFields: { valueRatio: { $divide: ['$votes', '$price'] } } },
                { $sort: { valueRatio: -1, popular: -1 } },
                { $limit: limit },
                {
                    $project: {
                        name: 1,
                        description: 1,
                        votes: 1,
                        price: 1,
                        currency: 1,
                        features: 1,
                        popular: 1,
                        applicableEvents: 1,
                        applicableCategories: 1,
                        valueRatio: { $round: ['$valueRatio', 2] }
                    }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getBestValueBundles');
        }
    }

    /**
     * Updates the price of a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {number} newPrice - The new price.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the price is invalid or the operation encounters an error.
     */
    async updatePricing(bundleId, newPrice, options = {}) {
        try {
            if (newPrice < 0) throw new Error('Price cannot be negative');
            return await this.updateById(bundleId, { price: newPrice }, options);
        } catch (error) {
            throw this._handleError(error, 'updatePricing');
        }
    }

    /**
     * Toggles the popularity status of a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the bundle is not found or the operation encounters an error.
     */
    async togglePopularity(bundleId, options = {}) {
        try {
            const bundle = await this.findById(bundleId);
            if (!bundle) throw new Error('Vote bundle not found');
            return await this.updateById(bundleId, { popular: !bundle.popular }, options);
        } catch (error) {
            throw this._handleError(error, 'togglePopularity');
        }
    }

    /**
     * Toggles the active status of a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the bundle is not found or the operation encounters an error.
     */
    async toggleActiveStatus(bundleId, options = {}) {
        try {
            const bundle = await this.findById(bundleId);
            if (!bundle) throw new Error('Vote bundle not found');
            return await this.updateById(bundleId, { isActive: !bundle.isActive }, options);
        } catch (error) {
            throw this._handleError(error, 'toggleActiveStatus');
        }
    }

    /**
     * Activates a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async activateBundle(bundleId, options = {}) {
        try {
            return await this.updateById(bundleId, { isActive: true }, options);
        } catch (error) {
            throw this._handleError(error, 'activateBundle');
        }
    }

    /**
     * Deactivates a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async deactivateBundle(bundleId, options = {}) {
        try {
            return await this.updateById(bundleId, { isActive: false }, options);
        } catch (error) {
            throw this._handleError(error, 'deactivateBundle');
        }
    }

    /**
     * Adds features to a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {string|string[]} newFeatures - Feature(s) to add.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async addFeatures(bundleId, newFeatures, options = {}) {
        try {
            const featureArray = Array.isArray(newFeatures) ? newFeatures : [newFeatures];
            return await this.updateById(bundleId, { $addToSet: { features: { $each: featureArray } } }, options);
        } catch (error) {
            throw this._handleError(error, 'addFeatures');
        }
    }

    /**
     * Removes features from a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {string|string[]} featuresToRemove - Feature(s) to remove.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async removeFeatures(bundleId, featuresToRemove, options = {}) {
        try {
            const featureArray = Array.isArray(featuresToRemove) ? featuresToRemove : [featuresToRemove];
            return await this.updateById(bundleId, { $pull: { features: { $in: featureArray } } }, options);
        } catch (error) {
            throw this._handleError(error, 'removeFeatures');
        }
    }

    /**
     * Adds applicable events to a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {string|string[]|ObjectId|ObjectId[]} eventIds - Event ID(s) to add.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async addApplicableEvents(bundleId, eventIds, options = {}) {
        try {
            const eventArray = Array.isArray(eventIds) ? eventIds : [eventIds];
            const objectIdArray = eventArray.map(id => new mongoose.Types.ObjectId(id));
            return await this.updateById(bundleId, { $addToSet: { applicableEvents: { $each: objectIdArray } } }, options);
        } catch (error) {
            throw this._handleError(error, 'addApplicableEvents');
        }
    }

    /**
     * Removes applicable events from a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {string|string[]|ObjectId|ObjectId[]} eventIds - Event ID(s) to remove.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async removeApplicableEvents(bundleId, eventIds, options = {}) {
        try {
            const eventArray = Array.isArray(eventIds) ? eventIds : [eventIds];
            const objectIdArray = eventArray.map(id => new mongoose.Types.ObjectId(id));
            return await this.updateById(bundleId, { $pull: { applicableEvents: { $in: objectIdArray } } }, options);
        } catch (error) {
            throw this._handleError(error, 'removeApplicableEvents');
        }
    }

    /**
     * Adds applicable categories to a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {string|string[]|ObjectId|ObjectId[]} categoryIds - Category ID(s) to add.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async addApplicableCategories(bundleId, categoryIds, options = {}) {
        try {
            const categoryArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
            const objectIdArray = categoryArray.map(id => new mongoose.Types.ObjectId(id));
            return await this.updateById(bundleId, { $addToSet: { applicableCategories: { $each: objectIdArray } } }, options);
        } catch (error) {
            throw this._handleError(error, 'addApplicableCategories');
        }
    }

    /**
     * Removes applicable categories from a vote bundle.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {string|string[]|ObjectId|ObjectId[]} categoryIds - Category ID(s) to remove.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object|null>} The updated vote bundle.
     * @throws {Error} If the operation encounters an error.
     */
    async removeApplicableCategories(bundleId, categoryIds, options = {}) {
        try {
            const categoryArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
            const objectIdArray = categoryArray.map(id => new mongoose.Types.ObjectId(id));
            return await this.updateById(bundleId, { $pull: { applicableCategories: { $in: objectIdArray } } }, options);
        } catch (error) {
            throw this._handleError(error, 'removeApplicableCategories');
        }
    }

    /**
     * Retrieves statistics and analytics for vote bundles.
     * @returns {Promise<Object>} Bundle statistics.
     * @throws {Error} If the operation encounters an error.
     */
    async getBundleStats() {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: null,
                        totalBundles: { $sum: 1 },
                        popularBundles: { $sum: { $cond: [{ $eq: ['$popular', true] }, 1, 0] } },
                        avgPrice: { $avg: '$price' },
                        maxPrice: { $max: '$price' },
                        minPrice: { $min: '$price' },
                        totalVotes: { $sum: '$votes' },
                        avgVotes: { $avg: '$votes' },
                        maxVotes: { $max: '$votes' },
                        minVotes: { $min: '$votes' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalBundles: 1,
                        popularBundles: 1,
                        nonPopularBundles: { $subtract: ['$totalBundles', '$popularBundles'] },
                        avgPrice: { $round: ['$avgPrice', 2] },
                        maxPrice: 1,
                        minPrice: 1,
                        priceRange: { $subtract: ['$maxPrice', '$minPrice'] },
                        totalVotes: 1,
                        avgVotes: { $round: ['$avgVotes', 0] },
                        maxVotes: 1,
                        minVotes: 1,
                        voteRange: { $subtract: ['$maxVotes', '$minVotes'] }
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            return stats || {
                totalBundles: 0,
                popularBundles: 0,
                nonPopularBundles: 0,
                avgPrice: 0,
                maxPrice: 0,
                minPrice: 0,
                priceRange: 0,
                totalVotes: 0,
                avgVotes: 0,
                maxVotes: 0,
                minVotes: 0,
                voteRange: 0
            };
        } catch (error) {
            throw this._handleError(error, 'getBundleStats');
        }
    }

    /**
     * Searches vote bundles by name, description, or features.
     * @param {string} searchTerm - The search term.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of matching vote bundles.
     * @throws {Error} If the operation encounters an error.
     */
    async searchBundles(searchTerm, options = {}) {
        try {
            const searchRegex = new RegExp(searchTerm, 'i');
            const criteria = {
                $or: [
                    { name: { $regex: searchRegex } },
                    { description: { $regex: searchRegex } },
                    { features: { $regex: searchRegex } }
                ]
            };
            return await this.find(criteria, {
                ...options,
                sort: { popular: -1, votes: -1, name: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'searchBundles');
        }
    }

    /**
     * Finds vote bundles within a specific budget.
     * @param {number} budget - The maximum budget.
     * @param {Object} [options={}] - Query options.
     * @returns {Promise<Array>} Array of vote bundles within budget.
     * @throws {Error} If the operation encounters an error.
     */
    async getBundlesForBudget(budget, options = {}) {
        try {
            const criteria = { price: { $lte: budget }, isActive: true };
            return await this.find(criteria, {
                ...options,
                sort: { votes: -1, price: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getBundlesForBudget');
        }
    }

    /**
     * Updates the popularity status of multiple vote bundles.
     * @param {Object} criteria - Selection criteria.
     * @param {boolean} popular - The new popularity status.
     * @param {Object} [options={}] - Update options.
     * @returns {Promise<Object>} Update result.
     * @throws {Error} If the operation encounters an error.
     */
    async bulkUpdatePopularity(criteria, popular, options = {}) {
        try {
            return await this.updateMany(criteria, { popular }, options);
        } catch (error) {
            throw this._handleError(error, 'bulkUpdatePopularity');
        }
    }

    /**
     * Deletes a vote bundle if not used in any votes.
     * @param {string|ObjectId} bundleId - The vote bundle ID.
     * @param {Object} [options={}] - Delete options.
     * @returns {Promise<Object|null>} The deleted vote bundle.
     * @throws {Error} If the bundle is used in votes or the operation encounters an error.
     */
    async deleteBundle(bundleId, options = {}) {
        try {
            const voteCount = await mongoose.model('Vote').countDocuments({ voteBundles: bundleId });
            if (voteCount > 0) throw new Error('Cannot delete vote bundle used in existing votes');
            return await this.deleteById(bundleId, options);
        } catch (error) {
            throw this._handleError(error, 'deleteBundle');
        }
    }

    /**
     * Validates vote bundle data.
     * @private
     * @param {Object} bundleData - The data to validate.
     * @throws {Error} If validation fails.
     */
    _validateBundleData(bundleData) {
        const { name, description, votes, price } = bundleData;

        if (!name?.trim()) throw new Error('Name is required');
        if (!description?.trim()) throw new Error('Description is required');
        if (!Number.isFinite(votes) || votes <= 0) throw new Error('Votes must be a positive number');
        if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a non-negative number');
        if (bundleData.features && !Array.isArray(bundleData.features) && typeof bundleData.features !== 'string') {
            throw new Error('Features must be an array or string');
        }
    }
}

export default VoteBundleRepository;