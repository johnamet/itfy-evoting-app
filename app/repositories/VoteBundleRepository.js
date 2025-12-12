import BaseRepository from '../BaseRepository.js';
import VoteBundle from '../models/VoteBundle.js';
import { mainCacheManager } from '../utils/engine/CacheManager.js';

/**
 * VoteBundleRepository
 * 
 * Manages vote bundles (packages of votes for purchase) with intelligent caching.
 * Vote bundles are cached with a 30-minute TTL since they are accessed frequently
 * but don't change often.
 * 
 * Cache Strategy:
 * - Read operations are cached automatically
 * - Price and vote count queries are cached
 * - Purchase count updates invalidate entity caches
 * - Active status changes invalidate caches
 * 
 * @extends BaseRepository
 */
class VoteBundleRepository extends BaseRepository {
    constructor() {
        super(VoteBundle, {
            enableCache: true,
            cacheManager: mainCacheManager,
            cacheTTL: 1800 // 30 minutes
        });
    }

    /**
     * Create a new vote bundle
     * 
     * @param {Object} bundleData - Bundle data
     * @param {string} bundleData.name - Bundle name
     * @param {number} bundleData.voteCount - Number of votes in bundle
     * @param {number} bundleData.price - Bundle price
     * @param {string} [bundleData.description] - Bundle description
     * @param {boolean} [bundleData.featured=false] - Whether bundle is featured
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Created vote bundle
     */
    async createBundle(bundleData, options = {}) {
        this._validateRequiredFields(bundleData, ['name', 'voteCount', 'price']);

        if (bundleData.voteCount <= 0) {
            throw new Error('Vote count must be positive');
        }

        if (bundleData.price < 0) {
            throw new Error('Price cannot be negative');
        }

        const bundleToCreate = {
            ...bundleData,
            featured: bundleData.featured !== undefined ? bundleData.featured : false,
            active: true,
            purchaseCount: 0
        };

        return await this.create(bundleToCreate, options);
    }

    /**
     * Find active bundles
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Active vote bundles
     */
    async findActiveBundles(options = {}) {
        return await this.find(
            { active: true },
            {
                ...options,
                sort: options.sort || { voteCount: 1 }
            }
        );
    }

    /**
     * Find featured bundles
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Featured bundles
     */
    async findFeaturedBundles(options = {}) {
        return await this.find(
            { active: true, featured: true },
            {
                ...options,
                sort: options.sort || { voteCount: 1 }
            }
        );
    }

    /**
     * Find bundle by vote count
     * 
     * @param {number} voteCount - Exact vote count
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Object|null>} Vote bundle or null
     */
    async findByVoteCount(voteCount, options = {}) {
        if (!voteCount) {
            throw new Error('Vote count is required');
        }

        return await this.findOne(
            { voteCount, active: true },
            options
        );
    }

    /**
     * Find bundles in price range
     * 
     * @param {number} minPrice - Minimum price
     * @param {number} maxPrice - Maximum price
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Bundles in price range
     */
    async findByPriceRange(minPrice, maxPrice, options = {}) {
        if (minPrice === undefined || maxPrice === undefined) {
            throw new Error('Min and max price are required');
        }

        return await this.find(
            {
                active: true,
                price: { $gte: minPrice, $lte: maxPrice }
            },
            {
                ...options,
                sort: options.sort || { price: 1 }
            }
        );
    }

    /**
     * Update bundle
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} updateData - Update data
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated bundle
     */
    async updateBundle(bundleId, updateData, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        // Validate if voteCount or price is being updated
        if (updateData.voteCount !== undefined && updateData.voteCount <= 0) {
            throw new Error('Vote count must be positive');
        }

        if (updateData.price !== undefined && updateData.price < 0) {
            throw new Error('Price cannot be negative');
        }

        // Prevent updating purchaseCount directly
        const { purchaseCount, ...safeUpdateData } = updateData;

        return await this.updateById(bundleId, safeUpdateData, options);
    }

    /**
     * Increment purchase count
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated bundle
     */
    async incrementPurchaseCount(bundleId, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        const bundle = await this.Model.findByIdAndUpdate(
            bundleId,
            { $inc: { purchaseCount: 1 } },
            { new: true, session: options.session }
        ).lean();

        // Manually invalidate cache
        await this._invalidateCache('findById', bundleId, { entity: bundle });

        return bundle;
    }

    /**
     * Activate bundle
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated bundle
     */
    async activateBundle(bundleId, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        return await this.updateById(bundleId, { active: true }, options);
    }

    /**
     * Deactivate bundle
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated bundle
     */
    async deactivateBundle(bundleId, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        return await this.updateById(bundleId, { active: false }, options);
    }

    /**
     * Set bundle as featured
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated bundle
     */
    async setFeatured(bundleId, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        return await this.updateById(bundleId, { featured: true }, options);
    }

    /**
     * Unset bundle as featured
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Updated bundle
     */
    async unsetFeatured(bundleId, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        return await this.updateById(bundleId, { featured: false }, options);
    }

    /**
     * Delete bundle
     * 
     * @param {string} bundleId - Bundle ID
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Deleted bundle
     */
    async deleteBundle(bundleId, options = {}) {
        if (!bundleId) {
            throw new Error('Bundle ID is required');
        }

        return await this.deleteById(bundleId, options);
    }

    /**
     * Get most popular bundles
     * Based on purchase count
     * 
     * @param {number} [limit=5] - Number of bundles to return
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Most popular bundles
     */
    async getMostPopular(limit = 5, options = {}) {
        return await this.find(
            { active: true },
            {
                ...options,
                sort: { purchaseCount: -1 },
                limit
            }
        );
    }

    /**
     * Calculate value per vote
     * Returns bundles sorted by best value (price per vote)
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Bundles with value metrics
     */
    async findBestValue(options = {}) {
        const bundles = await this.Model.aggregate([
            { $match: { active: true } },
            {
                $addFields: {
                    pricePerVote: {
                        $divide: ['$price', '$voteCount']
                    }
                }
            },
            {
                $sort: { pricePerVote: 1 }
            },
            {
                $limit: options.limit || 10
            }
        ]);

        return bundles;
    }

    /**
     * Get bundle statistics
     * 
     * @returns {Promise<Object>} Bundle statistics
     */
    async getBundleStats() {
        const [totalBundles, activeBundles, featuredBundles, stats] = await Promise.all([
            this.count({}),
            this.count({ active: true }),
            this.count({ active: true, featured: true }),
            this.Model.aggregate([
                { $match: { active: true } },
                {
                    $group: {
                        _id: null,
                        totalPurchases: { $sum: '$purchaseCount' },
                        avgPrice: { $avg: '$price' },
                        minPrice: { $min: '$price' },
                        maxPrice: { $max: '$price' },
                        totalVotes: { $sum: '$voteCount' }
                    }
                }
            ])
        ]);

        return {
            totalBundles,
            activeBundles,
            inactiveBundles: totalBundles - activeBundles,
            featuredBundles,
            totalPurchases: stats[0]?.totalPurchases || 0,
            avgPrice: stats[0]?.avgPrice?.toFixed(2) || '0.00',
            minPrice: stats[0]?.minPrice || 0,
            maxPrice: stats[0]?.maxPrice || 0,
            totalAvailableVotes: stats[0]?.totalVotes || 0
        };
    }

    /**
     * Get revenue by bundle
     * Calculate total revenue generated by each bundle
     * 
     * @returns {Promise<Array>} Revenue breakdown by bundle
     */
    async getRevenueByBundle() {
        const revenue = await this.Model.aggregate([
            { $match: { active: true } },
            {
                $addFields: {
                    totalRevenue: {
                        $multiply: ['$price', '$purchaseCount']
                    }
                }
            },
            {
                $sort: { totalRevenue: -1 }
            },
            {
                $project: {
                    name: 1,
                    voteCount: 1,
                    price: 1,
                    purchaseCount: 1,
                    totalRevenue: 1
                }
            }
        ]);

        return revenue;
    }

    /**
     * Get total revenue from all bundles
     * 
     * @returns {Promise<number>} Total revenue
     */
    async getTotalRevenue() {
        const result = await this.Model.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: {
                            $multiply: ['$price', '$purchaseCount']
                        }
                    }
                }
            }
        ]);

        return result[0]?.totalRevenue || 0;
    }

    /**
     * Find bundles not purchased yet
     * 
     * @param {Object} [options={}] - Query options
     * @returns {Promise<Array>} Unpurchased bundles
     */
    async findUnpurchased(options = {}) {
        return await this.find(
            { active: true, purchaseCount: 0 },
            {
                ...options,
                sort: options.sort || { voteCount: 1 }
            }
        );
    }

    /**
     * Clone bundle
     * Creates a copy with a new name
     * 
     * @param {string} bundleId - Source bundle ID
     * @param {string} newName - Name for the cloned bundle
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Cloned bundle
     */
    async cloneBundle(bundleId, newName, options = {}) {
        if (!bundleId || !newName) {
            throw new Error('Bundle ID and new name are required');
        }

        const sourceBundle = await this.findById(bundleId);
        
        if (!sourceBundle) {
            throw new Error('Source bundle not found');
        }

        const { _id, createdAt, updatedAt, purchaseCount, ...bundleData } = sourceBundle.toObject();

        const clonedBundleData = {
            ...bundleData,
            name: newName,
            purchaseCount: 0
        };

        return await this.createBundle(clonedBundleData, options);
    }

    /**
     * Bulk update bundle prices
     * Apply percentage increase/decrease to all active bundles
     * 
     * @param {number} percentageChange - Percentage to change (positive for increase, negative for decrease)
     * @param {Object} [options={}] - Repository options
     * @returns {Promise<Object>} Update result
     */
    async bulkUpdatePrices(percentageChange, options = {}) {
        if (percentageChange === undefined) {
            throw new Error('Percentage change is required');
        }

        const bundles = await this.findActiveBundles({ skipCache: true });
        
        return await this.withTransaction(async (session) => {
            const updates = bundles.map(bundle => {
                const newPrice = bundle.price * (1 + percentageChange / 100);
                const roundedPrice = Math.round(newPrice * 100) / 100; // Round to 2 decimals
                
                return this.updateById(
                    bundle._id,
                    { price: roundedPrice },
                    { ...options, session }
                );
            });

            await Promise.all(updates);

            return {
                success: true,
                updatedCount: bundles.length
            };
        });
    }
}

export default VoteBundleRepository;
