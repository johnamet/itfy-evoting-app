# Complete Repository Redesign Instructions for ITFY E-Voting System

## Design Philosophy & Principles

### 1. Core Design Goals
- **Pure Data Access Layer**: Repositories should ONLY handle database operations, no business logic
- **Type Safety**: Strong validation and error handling
- **Performance Optimized**: Strategic use of lean queries, projections, and indexes
- **Transaction Support**: Built-in support for multi-document transactions
- **Testability**: Easy to mock and test
- **Consistent API**: Predictable method signatures across all repositories
- **Cache-Ready**: Structure that supports caching layers

### 2. New Dependencies to Add
```json
{
  "mongoose": "^8.0.0",
  "lodash": "^4.17.21",              // Utility functions
  "async": "^3.2.5",                 // Async operations
  "cache-manager": "^5.2.4",         // Caching support
  "cache-manager-mongodb": "^3.0.0", // MongoDB cache adapter
  "p-retry": "^6.1.0",               // Retry failed operations
  "p-queue": "^8.0.1"                // Queue management
}
```

---

## Repository Architecture

### Base Repository Structure

```javascript
// Core responsibilities:
1. CRUD Operations (Create, Read, Update, Delete)
2. Query Building & Execution
3. Transaction Management
4. Error Handling & Logging
5. Performance Optimization (lean, select, projection)
6. Batch Operations
7. Aggregation Helpers
8. Cache Integration (optional)
```

---

## BaseRepository - Complete Redesign

### Current Issues:
- Too many generic methods that aren't used
- No transaction management
- Poor error context
- No performance optimization helpers
- Missing batch operation support

### New Design:

```javascript
class BaseRepository {
    constructor(model) {
        this.model = model;
        this.modelName = model.modelName;
        this.cache = null; // Optional cache instance
    }

    // ============ CORE CRUD OPERATIONS ============
    
    /**
     * Create single document
     * @param {Object} data - Document data
     * @param {Object} options - { session, lean, populate, select }
     * @returns {Promise<Document>}
     */
    async create(data, options = {})
    
    /**
     * Create multiple documents (optimized bulk insert)
     * @param {Array} dataArray - Array of document data
     * @param {Object} options - { session, ordered, lean }
     * @returns {Promise<Array>}
     */
    async createMany(dataArray, options = {})
    
    /**
     * Find by ID with options
     * @param {String|ObjectId} id
     * @param {Object} options - { lean, populate, select, session }
     * @returns {Promise<Document|null>}
     */
    async findById(id, options = {})
    
    /**
     * Find one document
     * @param {Object} filter
     * @param {Object} options - { lean, populate, select, sort, session }
     * @returns {Promise<Document|null>}
     */
    async findOne(filter, options = {})
    
    /**
     * Find multiple documents
     * @param {Object} filter
     * @param {Object} options - { lean, populate, select, sort, limit, skip, session }
     * @returns {Promise<Array>}
     */
    async find(filter, options = {})
    
    /**
     * Find with pagination
     * @param {Object} filter
     * @param {Object} options - { page, limit, sort, lean, populate, select }
     * @returns {Promise<Object>} { docs, total, page, pages, hasNext, hasPrev }
     */
    async findPaginated(filter, options = {})
    
    /**
     * Update by ID
     * @param {String|ObjectId} id
     * @param {Object} update
     * @param {Object} options - { new, runValidators, session, lean }
     * @returns {Promise<Document|null>}
     */
    async updateById(id, update, options = {})
    
    /**
     * Update one document
     * @param {Object} filter
     * @param {Object} update
     * @param {Object} options - { new, runValidators, session, upsert }
     * @returns {Promise<Document|null>}
     */
    async updateOne(filter, update, options = {})
    
    /**
     * Update multiple documents
     * @param {Object} filter
     * @param {Object} update
     * @param {Object} options - { session }
     * @returns {Promise<Object>} { matchedCount, modifiedCount }
     */
    async updateMany(filter, update, options = {})
    
    /**
     * Delete by ID (hard delete)
     * @param {String|ObjectId} id
     * @param {Object} options - { session }
     * @returns {Promise<Document|null>}
     */
    async deleteById(id, options = {})
    
    /**
     * Delete one document
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Document|null>}
     */
    async deleteOne(filter, options = {})
    
    /**
     * Delete multiple documents
     * @param {Object} filter
     * @param {Object} options - { session }
     * @returns {Promise<Object>} { deletedCount }
     */
    async deleteMany(filter, options = {})
    
    // ============ SOFT DELETE OPERATIONS ============
    
    async softDeleteById(id, deletedBy, options = {})
    async softDeleteOne(filter, deletedBy, options = {})
    async softDeleteMany(filter, deletedBy, options = {})
    async restoreById(id, options = {})
    async restoreOne(filter, options = {})
    async restoreMany(filter, options = {})
    
    // ============ COUNT & EXISTS OPERATIONS ============
    
    async count(filter, options = {})
    async countActive(filter, options = {})
    async countDeleted(filter, options = {})
    async exists(filter, options = {})
    async existsById(id, options = {})
    
    // ============ BATCH OPERATIONS ============
    
    /**
     * Bulk write operations (optimized)
     * @param {Array} operations - Array of write operations
     * @param {Object} options - { session, ordered }
     * @returns {Promise<Object>} Bulk write result
     */
    async bulkWrite(operations, options = {})
    
    /**
     * Batch update by IDs
     * @param {Array} ids
     * @param {Object} update
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async updateManyByIds(ids, update, options = {})
    
    /**
     * Batch delete by IDs
     * @param {Array} ids
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async deleteManyByIds(ids, options = {})
    
    // ============ AGGREGATION OPERATIONS ============
    
    /**
     * Execute aggregation pipeline
     * @param {Array} pipeline
     * @param {Object} options - { session }
     * @returns {Promise<Array>}
     */
    async aggregate(pipeline, options = {})
    
    /**
     * Aggregate with pagination
     * @param {Array} pipeline
     * @param {Object} options - { page, limit }
     * @returns {Promise<Object>}
     */
    async aggregatePaginate(pipeline, options = {})
    
    /**
     * Get distinct values
     * @param {String} field
     * @param {Object} filter
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async distinct(field, filter, options = {})
    
    // ============ TRANSACTION HELPERS ============
    
    /**
     * Start a new session
     * @returns {Promise<ClientSession>}
     */
    async startSession()
    
    /**
     * Execute function within transaction
     * @param {Function} fn - Async function to execute
     * @param {Object} options - Transaction options
     * @returns {Promise<any>}
     */
    async withTransaction(fn, options = {})
    
    /**
     * Execute with retry logic
     * @param {Function} fn - Async function to execute
     * @param {Object} options - { retries, minTimeout, maxTimeout }
     * @returns {Promise<any>}
     */
    async withRetry(fn, options = {})
    
    // ============ QUERY BUILDERS ============
    
    /**
     * Build query with filters
     * @param {Object} filters - Filter object
     * @returns {Object} Mongoose query filter
     */
    buildFilter(filters)
    
    /**
     * Build sort object
     * @param {Object|String} sort
     * @returns {Object}
     */
    buildSort(sort)
    
    /**
     * Build projection
     * @param {String|Array|Object} fields
     * @returns {Object}
     */
    buildProjection(fields)
    
    // ============ SEARCH OPERATIONS ============
    
    /**
     * Text search
     * @param {String} searchText
     * @param {Object} filter
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async textSearch(searchText, filter, options = {})
    
    /**
     * Search by multiple fields
     * @param {String} query
     * @param {Array} fields
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async searchByFields(query, fields, options = {})
    
    // ============ DATE RANGE OPERATIONS ============
    
    async findInDateRange(field, startDate, endDate, options = {})
    async findRecent(limit, options = {})
    async findOlderThan(field, date, options = {})
    
    // ============ STATISTICS OPERATIONS ============
    
    /**
     * Get collection statistics
     * @param {Object} filter
     * @returns {Promise<Object>}
     */
    async getStats(filter = {})
    
    /**
     * Group and count by field
     * @param {String} field
     * @param {Object} filter
     * @returns {Promise<Array>}
     */
    async groupByAndCount(field, filter = {})
    
    // ============ VALIDATION HELPERS ============
    
    /**
     * Validate ObjectId
     * @param {String} id
     * @param {String} fieldName
     * @throws {Error}
     */
    validateObjectId(id, fieldName = 'ID')
    
    /**
     * Validate ObjectIds array
     * @param {Array} ids
     * @param {String} fieldName
     * @throws {Error}
     */
    validateObjectIds(ids, fieldName = 'IDs')
    
    /**
     * Validate required fields
     * @param {Object} data
     * @param {Array} requiredFields
     * @throws {Error}
     */
    validateRequiredFields(data, requiredFields)
    
    // ============ ERROR HANDLING ============
    
    /**
     * Handle and format errors
     * @param {Error} error
     * @param {String} operation
     * @param {Object} context
     * @returns {Error}
     */
    handleError(error, operation, context = {})
    
    /**
     * Log operation
     * @param {String} operation
     * @param {Object} data
     */
    log(operation, data = {})
    
    // ============ CACHE OPERATIONS (Optional) ============
    
    async getCached(key, ttl = 300)
    async setCached(key, value, ttl = 300)
    async deleteCached(key)
    async clearCache()
}
```

---

## Repository-by-Repository Implementation Guide

### 1. **UserRepository**

```javascript
class UserRepository extends BaseRepository {
    constructor() {
        super(User); // User model
    }
    
    // ============ AUTHENTICATION ============
    
    /**
     * Find user by email (with password)
     * @param {String} email
     * @param {Object} options
     * @returns {Promise<User|null>}
     */
    async findByEmail(email, options = {}) {
        // Implementation:
        // 1. Normalize email (lowercase, trim)
        // 2. Query with +password select
        // 3. Populate role if needed
        // 4. Return user or null
    }
    
    /**
     * Authenticate user
     * @param {String} email
     * @param {String} password
     * @returns {Promise<User|null>}
     */
    async authenticate(email, password) {
        // Implementation:
        // 1. Find user by email with password
        // 2. Verify password using user.comparePassword()
        // 3. Update lastLogin and lastLoginIP
        // 4. Return user (without password) or null
        // 5. Log authentication attempt
    }
    
    /**
     * Update password
     * @param {String} userId
     * @param {String} newPassword
     * @param {String} currentPassword - for verification
     * @returns {Promise<Boolean>}
     */
    async updatePassword(userId, newPassword, currentPassword = null)
    
    /**
     * Lock account after failed attempts
     * @param {String} userId
     * @returns {Promise<User>}
     */
    async lockAccount(userId)
    
    /**
     * Unlock account
     * @param {String} userId
     * @returns {Promise<User>}
     */
    async unlockAccount(userId)
    
    // ============ USER MANAGEMENT ============
    
    /**
     * Find users by role
     * @param {String} roleId
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async findByRole(roleId, options = {})
    
    /**
     * Find active users
     * @param {Object} filter
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async findActiveUsers(filter = {}, options = {})
    
    /**
     * Search users (by name, email)
     * @param {String} query
     * @param {Object} options
     * @returns {Promise<Array>}
     */
    async searchUsers(query, options = {})
    
    /**
     * Get user profile with relations
     * @param {String} userId
     * @returns {Promise<User|null>}
     */
    async getUserProfile(userId)
    
    /**
     * Update user profile
     * @param {String} userId
     * @param {Object} profileData
     * @param {String} updatedBy
     * @returns {Promise<User>}
     */
    async updateProfile(userId, profileData, updatedBy)
    
    /**
     * Check if email is available
     * @param {String} email
     * @param {String} excludeUserId - for updates
     * @returns {Promise<Boolean>}
     */
    async isEmailAvailable(email, excludeUserId = null)
    
    // ============ STATISTICS ============
    
    /**
     * Get user statistics
     * @param {Object} filter
     * @returns {Promise<Object>}
     */
    async getUserStats(filter = {})
    
    /**
     * Get users by role breakdown
     * @returns {Promise<Array>}
     */
    async getUsersByRoleBreakdown()
    
    /**
     * Get recent registrations
     * @param {Number} days
     * @returns {Promise<Array>}
     */
    async getRecentRegistrations(days = 7)
}
```

---

### 2. **RoleRepository**

```javascript
class RoleRepository extends BaseRepository {
    constructor() {
        super(Role);
    }
    
    // ============ ROLE QUERIES ============
    
    async findByName(name)
    async findByLevel(level)
    async findByLevelRange(minLevel, maxLevel)
    async findSystemRoles()
    async findCustomRoles()
    
    // ============ PERMISSION CHECKS ============
    
    async hasPermission(roleId, permission)
    async getRolePermissions(roleId) // including inherited
    async getRoleHierarchy(roleId)
    
    // ============ ROLE MANAGEMENT ============
    
    async createRole(roleData, createdBy)
    async updateRole(roleId, updateData, updatedBy)
    async deleteRole(roleId) // prevent if system role or has users
    
    // ============ VALIDATION ============
    
    async validatePermission(permission)
    async canDeleteRole(roleId)
}
```

---

### 3. **EventRepository**

```javascript
class EventRepository extends BaseRepository {
    constructor() {
        super(Event);
    }
    
    // ============ EVENT LIFECYCLE ============
    
    async createEvent(eventData, createdBy)
    async publishEvent(eventId, publishedBy)
    async startEvent(eventId, startedBy)
    async pauseEvent(eventId, pausedBy)
    async completeEvent(eventId, completedBy)
    async cancelEvent(eventId, reason, cancelledBy)
    
    // ============ EVENT QUERIES ============
    
    async findActiveEvents(options = {})
    async findUpcomingEvents(days = 30, options = {})
    async findPastEvents(options = {})
    async findByStatus(status, options = {})
    async findByDateRange(startDate, endDate, options = {})
    
    // ============ SEARCH & FILTER ============
    
    async searchEvents(query, filters = {}, options = {})
    async findByLocation(coordinates, radius, options = {})
    async findByType(type, options = {})
    async findByVisibility(visibility, options = {})
    
    // ============ EVENT DETAILS ============
    
    async getEventWithDetails(eventId) // full details with categories, candidates
    async getEventMetrics(eventId)
    async getEventCategories(eventId)
    async getEventCandidates(eventId)
    
    // ============ VOTING STATUS ============
    
    async isVotingOpen(eventId)
    async canUserVote(eventId, userId)
    async getVotingStatus(eventId)
    
    // ============ STATISTICS ============
    
    async getEventStats(eventId)
    async getEventParticipation(eventId)
    async getEventRevenue(eventId)
    
    // ============ BATCH OPERATIONS ============
    
    async updateEventMetrics(eventId)
    async findEventsRequiringAction() // for cron jobs
}
```

---

### 4. **CategoryRepository**

```javascript
class CategoryRepository extends BaseRepository {
    constructor() {
        super(Category);
    }
    
    // ============ CATEGORY MANAGEMENT ============
    
    async createCategory(categoryData, createdBy)
    async updateCategory(categoryId, updateData, updatedBy)
    async deleteCategory(categoryId) // check for dependencies
    
    // ============ CATEGORY QUERIES ============
    
    async findByEvent(eventId, options = {})
    async findActiveCategories(eventId, options = {})
    async findVotingOpenCategories(options = {})
    async findByName(name, eventId)
    
    // ============ VOTING OPERATIONS ============
    
    async openVoting(categoryId, openedBy)
    async closeVoting(categoryId, closedBy)
    async isVotingOpen(categoryId)
    async validateVote(categoryId, candidateId, votes)
    
    // ============ CATEGORY DETAILS ============
    
    async getCategoryWithCandidates(categoryId)
    async getCategoryMetrics(categoryId)
    async getCategoryWinner(categoryId)
    async getTopCandidates(categoryId, limit = 3)
    
    // ============ STATISTICS ============
    
    async getCategoryStats(categoryId)
    async getCategoriesStats(eventId)
}
```

---

### 5. **CandidateRepository**

```javascript
class CandidateRepository extends BaseRepository {
    constructor() {
        super(Candidate);
    }
    
    // ============ AUTHENTICATION ============
    
    async findByCId(cId)
    async authenticateByCId(cId, password)
    async authenticateByEmail(email, password)
    
    // ============ CANDIDATE MANAGEMENT ============
    
    async createCandidate(candidateData, createdBy)
    async updateCandidate(candidateId, updateData, updatedBy)
    async deleteCandidate(candidateId) // check for votes
    
    // ============ APPROVAL WORKFLOW ============
    
    async approveCandidate(candidateId, approvedBy)
    async rejectCandidate(candidateId, reason, rejectedBy)
    async activateCandidate(candidateId, activatedBy)
    async disqualifyCandidate(candidateId, reason, disqualifiedBy)
    
    // ============ CANDIDATE QUERIES ============
    
    async findByEvent(eventId, filters = {}, options = {})
    async findByCategory(categoryId, options = {})
    async findByStatus(status, options = {})
    async findApprovedCandidates(eventId, options = {})
    
    // ============ SEARCH ============
    
    async searchCandidates(query, filters = {}, options = {})
    async findByEmail(email)
    
    // ============ VOTING DETAILS ============
    
    async getCandidateWithVotes(candidateId)
    async getCandidateRanking(candidateId)
    async getLeaderboard(eventId, categoryId, limit = 10)
    
    // ============ STATISTICS ============
    
    async getCandidateStats(candidateId)
    async getCandidatesStats(eventId, categoryId = null)
    
    // ============ BATCH OPERATIONS ============
    
    async bulkApprove(candidateIds, approvedBy)
    async bulkDisqualify(candidateIds, reason, disqualifiedBy)
    async updateVoteCount(candidateId, increment = 1) // atomic
}
```

---

### 6. **VoteBundleRepository**

```javascript
class VoteBundleRepository extends BaseRepository {
    constructor() {
        super(VoteBundle);
    }
    
    // ============ BUNDLE MANAGEMENT ============
    
    async createBundle(bundleData, createdBy)
    async updateBundle(bundleId, updateData, updatedBy)
    async deleteBundle(bundleId) // check for usage
    async activateBundle(bundleId)
    async deactivateBundle(bundleId)
    
    // ============ BUNDLE QUERIES ============
    
    async findAvailableBundles(filters = {}, options = {})
    async findByEvent(eventId, options = {})
    async findByCategory(categoryId, options = {})
    async findPopularBundles(limit = 5)
    async findByPriceRange(minPrice, maxPrice, options = {})
    
    // ============ PRICING ============
    
    async calculatePrice(bundleId, quantity, couponCode = null)
    async getBestValueBundles(limit = 10)
    
    // ============ AVAILABILITY ============
    
    async checkAvailability(bundleId, quantity)
    async reserveStock(bundleId, quantity, reservedBy)
    async releaseReservation(bundleId, quantity)
    async updateStock(bundleId, quantity, operation = 'subtract')
    
    // ============ STATISTICS ============
    
    async getBundleStats(bundleId)
    async getSalesStats(filters = {})
    async getMostPurchased(limit = 10)
}
```

---

### 7. **PaymentRepository**

```javascript
class PaymentRepository extends BaseRepository {
    constructor() {
        super(Payment);
    }
    
    // ============ PAYMENT CREATION ============
    
    async createPayment(paymentData, options = {})
    async initializePayment(paymentData)
    
    // ============ PAYMENT QUERIES ============
    
    async findByReference(reference)
    async findByTransactionId(transactionId)
    async findByVoter(email, options = {})
    async findByEvent(eventId, options = {})
    async findByStatus(status, options = {})
    async findPendingPayments(olderThan = null)
    async findUnverifiedPayments(options = {})
    async findUnreconciledPayments(options = {})
    
    // ============ PAYMENT LIFECYCLE ============
    
    async verifyPayment(reference)
    async completePayment(reference, gatewayData)
    async failPayment(reference, reason)
    async refundPayment(paymentId, amount, reason, refundedBy)
    async cancelPayment(reference, reason)
    
    // ============ FRAUD DETECTION ============
    
    async assessFraudRisk(paymentId)
    async blockPayment(paymentId, reason, blockedBy)
    async findSuspiciousPayments(threshold = 0.7)
    async findByIpAddress(ipAddress, timeWindow = 3600000) // 1 hour
    
    // ============ RECONCILIATION ============
    
    async reconcilePayment(paymentId, reconciledBy)
    async markDiscrepancy(paymentId, reason)
    async resolveDiscrepancy(paymentId, resolution, resolvedBy)
    
    // ============ VOTER OPERATIONS ============
    
    async hasVoterPaid(email, eventId, categoryId = null)
    async getVoterPayments(email, eventId = null)
    async getVoterTotalSpent(email, eventId = null)
    
    // ============ STATISTICS ============
    
    async getPaymentStats(filters = {})
    async getRevenueStats(filters = {})
    async getPaymentMethodBreakdown(filters = {})
    async getDailyRevenue(startDate, endDate)
    async getTopSpenders(limit = 10)
    
    // ============ BATCH OPERATIONS ============
    
    async bulkVerify(references)
    async expireOldPendingPayments(olderThanHours = 24)
}
```

---

### 8. **VoteRepository**

```javascript
class VoteRepository extends BaseRepository {
    constructor() {
        super(Vote);
    }
    
    // ============ VOTE CASTING ============
    
    async castVote(voteData, options = {})
    async castBulkVotes(votesData, options = {}) // within transaction
    
    // ============ VOTE VALIDATION ============
    
    async validateVote(voteData)
    async hasVoted(voter, eventId, categoryId)
    async canVote(voter, eventId, categoryId)
    async findDuplicateVotes(voter, eventId, categoryId)
    
    // ============ VOTE QUERIES ============
    
    async findByCandidate(candidateId, options = {})
    async findByEvent(eventId, options = {})
    async findByCategory(categoryId, options = {})
    async findByVoter(voterEmail, options = {})
    async findByPayment(paymentId)
    async findByDateRange(startDate, endDate, options = {})
    
    // ============ VOTE MANAGEMENT ============
    
    async invalidateVote(voteId, reason, invalidatedBy)
    async validateVote(voteId, validatedBy)
    async disputeVote(voteId, reason, disputedBy)
    async resolveDispute(voteId, resolution, resolvedBy)
    async cancelVote(voteId, reason, cancelledBy)
    
    // ============ VOTE COUNTING ============
    
    async countValidVotes(candidateId)
    async countVotesByCategory(categoryId)
    async countVotesByEvent(eventId)
    async getWeightedVoteCount(candidateId)
    
    // ============ RESULTS ============
    
    async getVoteResults(eventId, categoryId = null)
    async getLeaderboard(eventId, categoryId)
    async getCandidateRanking(candidateId)
    
    // ============ STATISTICS ============
    
    async getVotingStats(filters = {})
    async getVotingTrends(eventId, interval = 'hourly')
    async getVoterParticipation(eventId)
    async getPeakVotingTimes(eventId)
    
    // ============ ANOMALY DETECTION ============
    
    async detectDuplicates(threshold = 0.8)
    async detectAnomalies(eventId, threshold = 3) // standard deviations
    async findSuspiciousPatterns(filters = {})
    async findVotesByIp(ipAddress, timeWindow = 3600000)
    
    // ============ BATCH OPERATIONS ============
    
    async bulkInvalidate(voteIds, reason, invalidatedBy)
    async deleteByEvent(eventId, options = {})
}
```

---

### 9. **CouponRepository**

```javascript
class CouponRepository extends BaseRepository {
    constructor() {
        super(Coupon);
    }
    
    // ============ COUPON MANAGEMENT ============
    
    async createCoupon(couponData, createdBy)
    async updateCoupon(couponId, updateData, updatedBy)
    async deleteCoupon(couponId) // check for usage
    async activateCoupon(couponId)
    async deactivateCoupon(couponId)
    
    // ============ COUPON QUERIES ============
    
    async findByCode(code)
    async findAvailableCoupons(context = {})
    async findForUser(userId, context = {})
    async findByEvent(eventId, options = {})
    async findExpiringSoon(days = 7)
    
    // ============ VALIDATION ============
    
    async validateCoupon(code, context = {})
    async canApply(code, order, user)
    async isAvailable(code)
    async isExpired(couponId)
    async isExhausted(couponId)
    
    // ============ DISCOUNT CALCULATION ============
    
    async calculateDiscount(code, amount, context = {})
    async getBestCoupon(order, availableCoupons = null)
    async getStackableCoupons(order)
    
    // ============ USAGE TRACKING ============
    
    async recordUsage(couponId, usageData)
    async incrementUsage(couponId)
    async getUserUsageCount(couponId, userId)
    async getTotalUsage(couponId)
    
    // ============ STATISTICS ============
    
    async getCouponStats(couponId)
    async getUsageStats(filters = {})
    async getTopCoupons(limit = 10)
    async getRedemptionRate(couponId)
    
    // ============ BATCH OPERATIONS ============
    
    async bulkCreate(couponsData, createdBy)
    async bulkExpire(couponIds)
    async expireOldCoupons()
    async deactivateExhaustedCoupons()
}
```

---

### 10. **AnalyticsRepository**

```javascript
class AnalyticsRepository extends BaseRepository {
    constructor() {
        super(Analytics);
    }
    
    // ============ SNAPSHOT MANAGEMENT ============
    
    async createSnapshot(type, period, data)
    async updateSnapshot(snapshotId, data)
    async findLatestSnapshot(type, period, scope = {})
    async findSnapshotsInRange(type, startDate, endDate)
    
    // ============ METRICS COMPUTATION ============
    
    async computeOverviewMetrics(startDate, endDate)
    async computeVotingMetrics(eventId, startDate, endDate)

    async computeRevenueMetrics(startDate, endDate)
    async computeEngagementMetrics(startDate, endDate)
    
    // ============ TIME SERIES ============
    
    async getTimeSeries(metric, startDate, endDate, interval = 'day')
    async aggregateByPeriod(metric, period, filters = {})
    
    // ============ COMPARISONS ============
    
    async comparePerformance(entityId, comparisonPeriod = 'previous')
    async getTrends(metric, periods = 7)
    async calculateGrowthRate(metric, currentPeriod, previousPeriod)
    
    // ============ LEADERBOARDS ============
    
    async getTopPerformers(metric, limit = 10, filters = {})
    async getRankings(scope, metric, filters = {})
    
    // ============ ANOMALY DETECTION ============
    
    async detectAnomalies(metric, threshold = 3)
    async flagUnusualActivity(scope, timeWindow = 3600000)
    
    // ============ FORECASTING ============
    
    async generateForecast(metric, periods = 7)
    async predictTrend(metric, data, horizon = 30)
    
    // ============ AGGREGATIONS ============
    
    async aggregateVotingData(filters = {})
    async aggregateRevenueData(filters = {})
    async aggregateUserData(filters = {})
    
    // ============ CLEANUP ============
    
    async deleteOldSnapshots(olderThan)
    async archiveSnapshots(olderThan)
}
```

---

## Implementation Guidelines

### Error Handling Pattern

```javascript
async methodName(params) {
    try {
        // Validate inputs
        this.validateObjectId(id, 'Entity ID');
        this.validateRequiredFields(data, ['field1', 'field2']);
        
        // Execute operation
        const result = await this.model.operation(params);
        
        // Log success
        this.log('methodName', { id, success: true });
        
        return result;
        
    } catch (error) {
        // Handle and format error
        throw this.handleError(error, 'methodName', { id, ...params });
    }
}
```

### Transaction Pattern

```javascript
async complexOperation(data) {
    return await this.withTransaction(async (session) => {
        // Multiple operations within transaction
        const result1 = await this.create(data1, { session });
        const result2 = await this.updateById(id, data2, { session });
        
        return { result1, result2 };
    });
}
```

### Pagination Pattern

```javascript
async findWithPagination(filter, options) {
    const {
        page = 1,
        limit = 20,
        sort = { createdAt: -1 },
        lean = true,
        populate = [],
        select = null
    } = options;
    
    return await this.findPaginated(filter, {
        page,
        limit,
        sort,
        lean,
        populate,
        select
    });
}
```

---

## Testing Strategy

### Unit Tests for Each Repository
```javascript
describe('UserRepository', () => {
    describe('authenticate', () => {
        it('should authenticate valid credentials')
        it('should reject invalid password')
        it('should lock account after max attempts')
        it('should update lastLogin on success')
    });
    
    describe('findByRole', () => {
        it('should find users by role')
        it('should return empty array if no users')
        it('should handle invalid role ID')
    });
});
```

---

## Performance Optimization Checklist

For each repository method:
- [ ] Use `lean()` for read-only operations
- [ ] Apply `.select()` to limit fields
- [ ] Use indexes for query filters
- [ ] Implement pagination for large datasets
- [ ] Use `.countDocuments()` instead of `.count()`
- [ ] Use aggregation for complex queries
- [ ] Cache frequently accessed data
- [ ] Use bulk operations for batch updates
- [ ] Avoid N+1 queries with proper populate
- [ ] Use projection in aggregations

---

## Migration Strategy

1. **Move old repositories to a new dir [deprecated]**
2. **Implement methods one-by-one**
3. **Add comprehensive tests**

---