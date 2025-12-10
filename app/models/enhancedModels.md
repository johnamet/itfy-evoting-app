# Complete Model Redesign Instructions for ITFY E-Voting System

## Design Philosophy & Principles

### 1. Core Design Goals
- **Separation of Concerns**: Models should only handle schema definition, virtuals, indexes, and instance/static methods
- **No Business Logic**: Move all business logic to services layer
- **Strong Typing**: Leverage Mongoose's built-in type safety and validation
- **Performance First**: Strategic indexing and query optimization
- **Audit Trail**: Comprehensive tracking of all changes
- **Flexibility**: Easy to extend and maintain

### 2. New Dependencies to Add
```json
{
  "mongoose": "^8.0.0",           // Latest Mongoose with better TS support
  "mongoose-paginate-v2": "^1.8.0", // Built-in pagination
  "mongoose-autopopulate": "^1.1.0", // Automatic population
  "mongoose-delete": "^1.0.1",    // Soft delete plugin
  "mongoose-aggregate-paginate-v2": "^1.1.0", // Aggregate pagination
  "@typegoose/typegoose": "^12.0.0", // TypeScript support (optional)
  "validator": "^13.11.0"         // Enhanced validation
}
```

---

## Model-by-Model Redesign

### 1. **User Model** - Complete Overhaul

#### Current Issues:
- Password hashing in schema (should be in pre-save hook only)
- Mixed validation logic
- No proper indexing strategy
- Missing audit fields

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Add `profile` subdocument (bio, image, phone, location)
   - Add `security` subdocument (loginAttempts, lockUntil, twoFactorSecret)
   - Add `preferences` subdocument (notifications, theme, language)
   - Add `audit` subdocument (createdBy, updatedBy, deletedBy, deletedAt)
   - Add `status` enum: ['active', 'inactive', 'suspended', 'locked']
   
2. Indexes:
   - Compound: { email: 1, status: 1 }
   - Compound: { role: 1, status: 1, createdAt: -1 }
   - Text: { 'profile.name': 'text', email: 'text' }
   - Unique: { email: 1 }
   
3. Virtuals:
   - isLocked: Check if account is locked
   - isOnline: Check last activity timestamp
   - fullProfile: Combine user + role data
   
4. Instance Methods:
   - comparePassword(password): Async password verification
   - generateAuthToken(): Create JWT with embedded permissions
   - recordLogin(ip, location): Track login history
   - incrementLoginAttempts(): Handle failed logins
   - resetLoginAttempts(): Clear after successful login
   - lockAccount(): Lock after max failed attempts
   
5. Static Methods:
   - findByEmail(email): Standard lookup
   - findActiveUsers(filters): Get active users
   - searchUsers(query, options): Full-text search
   - getUserStats(): Aggregate statistics
   
6. Middleware:
   - Pre-save: Hash password only if modified
   - Pre-save: Validate role exists
   - Post-save: Clear sensitive data from response
   - Pre-remove: Check for dependencies (votes, events)
```

---

### 2. **Role Model** - Enhanced Permissions

#### Current Issues:
- Too simple, just name and level
- No granular permissions
- No permission inheritance

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: name, level
   - Add: `permissions` array of strings (e.g., 'users.create', 'votes.read')
   - Add: `inherits` reference to parent role (for hierarchy)
   - Add: `description` for clarity
   - Add: `isSystem` boolean (prevent deletion of core roles)
   - Add: `metadata` flexible object
   
2. Indexes:
   - Unique: { name: 1 }
   - Index: { level: 1 }
   - Index: { isSystem: 1 }
   
3. Virtuals:
   - allPermissions: Computed with inheritance
   - hierarchy: Full role hierarchy path
   
4. Instance Methods:
   - hasPermission(permission): Check if role has specific permission
   - getAllPermissions(): Get all permissions including inherited
   - canAccess(resource, action): Check resource-level access
   
5. Static Methods:
   - findByLevel(level): Get role by level
   - getHierarchy(): Get complete role hierarchy tree
   - validatePermission(permission): Ensure permission format is valid
```

---

### 3. **Event Model** - Comprehensive Event Management

#### Current Issues:
- Location structure too rigid
- Missing critical fields
- No event state management
- Poor query performance

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: name, description, startDate, endDate
   - Enhance: location (make more flexible with online/hybrid support)
   - Add: `type` enum: ['physical', 'online', 'hybrid']
   - Add: `status` enum: ['draft', 'published', 'active', 'paused', 'completed', 'cancelled']
   - Add: `visibility` enum: ['public', 'private', 'unlisted']
   - Add: `settings` subdocument:
     * votingSettings: { allowAnonymous, requirePayment, maxVotesPerUser }
     * registration: { required, deadline, capacity, waitlist }
     * results: { showLive, showAfterEvent, publishDate }
   - Add: `metrics` subdocument:
     * totalVotes, uniqueVoters, revenue, registrations
   - Add: `media` subdocument:
     * coverImage, gallery[], videos[]
   - Add: `seo` subdocument:
     * title, description, keywords[], ogImage
   
2. Indexes:
   - Compound: { status: 1, startDate: -1 }
   - Compound: { visibility: 1, status: 1 }
   - Text: { name: 'text', description: 'text' }
   - Geospatial: { 'location.coordinates': '2dsphere' }
   
3. Virtuals:
   - isActive: Check if currently active
   - isUpcoming: Check if starts in future
   - isPast: Check if already ended
   - daysUntilStart: Calculate days remaining
   - duration: Calculate event duration
   - registrationOpen: Check if registration is open
   
4. Instance Methods:
   - publish(): Change status to published
   - start(): Activate event
   - pause(): Temporarily pause
   - complete(): Mark as completed
   - cancel(reason): Cancel with reason
   - updateMetrics(): Recalculate metrics
   
5. Static Methods:
   - findActive(): Get currently active events
   - findUpcoming(days): Get upcoming events
   - findByLocation(coords, radius): Geospatial search
   - searchEvents(query, filters): Advanced search
   - getEventStats(eventId): Detailed statistics
```

---

### 4. **Category Model** - Voting Categories

#### Current Issues:
- Too basic, missing critical features
- No voting rules configuration
- Poor relationship management

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: name, description, icon, event
   - Add: `votingRules` subdocument:
     * minVotes, maxVotes, allowMultiple, requirePayment
     * votingStartDate, votingEndDate
   - Add: `display` subdocument:
     * order, color, badge, featuredCandidate
   - Add: `status` enum: ['draft', 'active', 'voting_open', 'voting_closed', 'completed']
   - Add: `metrics` subdocument:
     * totalVotes, totalCandidates, totalRevenue
   - Add: `settings` subdocument:
     * showResults, allowTie, tieBreakingMethod
   
2. Indexes:
   - Compound: { event: 1, status: 1, 'display.order': 1 }
   - Compound: { event: 1, 'votingRules.votingStartDate': 1 }
   - Text: { name: 'text', description: 'text' }
   
3. Virtuals:
   - isVotingOpen: Check if voting is currently allowed
   - winner: Get current leading candidate
   - topCandidates: Get top 3 candidates
   
4. Instance Methods:
   - openVoting(): Enable voting
   - closeVoting(): Disable voting
   - determineWinner(): Calculate winner based on rules
   - validateVote(candidateId, votes): Check if vote is valid
   
5. Static Methods:
   - findByEvent(eventId): Get all categories for event
   - findVotingOpen(): Get categories with open voting
   - getCategoryStats(categoryId): Detailed statistics
```

---

### 5. **Candidate Model** - Candidate Profiles

#### Current Issues:
- Password hashing shouldn't be in model
- Too many loose fields
- No media management
- Poor validation

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: name, email, bio, event, categories
   - Add: `profile` subdocument:
     * title, company, website, socialLinks{}
     * education[], experience[], achievements[]
   - Add: `media` subdocument:
     * photo, gallery[], videos[], documents[]
   - Add: `credentials` subdocument:
     * cId, passwordHash (separate from schema)
     * emailVerified, profileCompleted
   - Add: `voting` subdocument:
     * totalVotes, ranking, lastVoteAt
   - Add: `status` enum: ['draft', 'pending_approval', 'approved', 'rejected', 'active', 'disqualified']
   - Add: `metadata` subdocument:
     * nominatedBy, approvedBy, rejectedBy, rejectionReason
   
2. Indexes:
   - Compound: { event: 1, status: 1, categories: 1 }
   - Compound: { event: 1, 'voting.totalVotes': -1 }
   - Unique: { email: 1, event: 1 }
   - Unique: { 'credentials.cId': 1 }
   - Text: { name: 'text', 'profile.bio': 'text' }
   
3. Virtuals:
   - isApproved: Check approval status
   - canReceiveVotes: Check if eligible for voting
   - voteCount: Get current vote count
   
4. Instance Methods:
   - approve(approvedBy): Approve candidate
   - reject(rejectedBy, reason): Reject with reason
   - activate(): Make active for voting
   - disqualify(reason): Disqualify from voting
   - comparePassword(password): Verify login
   
5. Static Methods:
   - findByEvent(eventId, filters): Get candidates for event
   - findByCategory(categoryId): Get candidates in category
   - getLeaderboard(eventId, categoryId): Get ranked candidates
   - searchCandidates(query, filters): Advanced search
```

---

### 6. **VoteBundle Model** - Vote Packages

#### Current Issues:
- Too simple pricing structure
- No temporal validity
- Missing discount logic

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: name, description, votes, price, currency
   - Add: `pricing` subdocument:
     * basePrice, discountPrice, discountPercentage
     * validFrom, validUntil
     * minimumPurchase, maximumPurchase
   - Add: `features` array of objects:
     * { name, description, included: boolean }
   - Add: `availability` subdocument:
     * totalAvailable, sold, remaining
     * limitPerUser, limitPerTransaction
   - Add: `applicability` subdocument:
     * events[], categories[], specificCandidates[]
     * excludeEvents[], excludeCategories[]
   - Add: `display` subdocument:
     * order, badge, highlighted, recommendedFor
   - Add: `status` enum: ['draft', 'active', 'limited', 'sold_out', 'expired', 'archived']
   
2. Indexes:
   - Compound: { status: 1, 'pricing.validFrom': 1, 'pricing.validUntil': 1 }
   - Compound: { 'applicability.events': 1, status: 1 }
   - Index: { popular: -1, price: 1 }
   
3. Virtuals:
   - isAvailable: Check if currently available
   - effectivePrice: Calculate actual price with discounts
   - remainingPercentage: Calculate remaining stock
   - isExpired: Check if validity period has passed
   
4. Instance Methods:
   - calculatePrice(quantity, appliedCoupon): Get final price
   - checkAvailability(quantity): Verify stock
   - reserve(quantity): Temporarily reserve stock
   - purchase(quantity): Finalize purchase
   - refund(quantity): Return stock
   
5. Static Methods:
   - findAvailable(filters): Get available bundles
   - findForEvent(eventId): Get bundles for event
   - getBundlesByPrice(minPrice, maxPrice): Price range query
   - getPopularBundles(limit): Get most purchased
```

---

### 7. **Payment Model** - Transaction Management

#### Current Issues:
- Loose structure
- No proper state management
- Missing fraud detection fields
- No reconciliation support

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: reference, voter, voteBundles, event, candidate
   - Add: `transaction` subdocument:
     * provider: 'paystack' | 'stripe' | 'manual'
     * transactionId, accessCode, authorizationUrl
     * gatewayResponse, channel, fees
   - Add: `amounts` subdocument:
     * subtotal, discount, couponDiscount, tax, fees, total
     * currency, exchangeRate (if multi-currency)
   - Add: `status` enum: ['initialized', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded']
   - Add: `verification` subdocument:
     * verified, verifiedAt, verificationAttempts
     * webhookReceived, webhookVerified
     * manualVerification, verifiedBy
   - Add: `fraud` subdocument:
     * riskScore, riskFactors[], blocked, blockReason
     * ipAddress, deviceFingerprint, location
   - Add: `reconciliation` subdocument:
     * reconciled, reconciledAt, reconciledBy
     * discrepancyFound, discrepancyReason, resolved
   - Add: `refund` subdocument:
     * refunded, refundedAt, refundAmount, refundReason
     * refundTransactionId, refundedBy
   
2. Indexes:
   - Unique: { reference: 1 }
   - Compound: { 'voter.email': 1, event: 1, status: 1 }
   - Compound: { status: 1, createdAt: -1 }
   - Index: { 'transaction.transactionId': 1 }
   - Index: { 'fraud.ipAddress': 1 }
   
3. Virtuals:
   - isPaid: Check if successfully paid
   - isPending: Check if awaiting payment
   - canRefund: Check if refundable
   - netAmount: Calculate after fees and discounts
   
4. Instance Methods:
   - verify(): Verify with payment gateway
   - complete(): Mark as completed
   - fail(reason): Mark as failed
   - refund(amount, reason): Process refund
   - assessFraud(): Calculate fraud risk
   - reconcile(): Mark as reconciled
   
5. Static Methods:
   - findByReference(reference): Get by unique reference
   - findByVoter(email): Get all voter payments
   - findPending(): Get payments awaiting verification
   - findUnreconciled(): Get unreconciled payments
   - getPaymentStats(filters): Aggregate statistics
   - detectFraud(threshold): Find suspicious payments
```

---

### 8. **Vote Model** - Vote Records

#### Current Issues:
- Too simple structure
- No validation context
- Missing verification fields

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: candidate, voter, event, category, voteBundles
   - Add: `verification` subdocument:
     * paymentVerified, paymentId
     * eligibilityChecked, eligibilityValid
     * duplicateChecked, isDuplicate
   - Add: `source` subdocument:
     * ipAddress, userAgent, device, location
     * referrer, platform (web, mobile, api)
   - Add: `weight` subdocument:
     * baseWeight: 1 (default)
     * multiplier (from bundle)
     * finalWeight (calculated)
   - Add: `status` enum: ['pending', 'valid', 'invalid', 'disputed', 'cancelled']
   - Add: `audit` subdocument:
     * verifiedBy, verifiedAt
     * invalidatedBy, invalidatedAt, invalidReason
     * disputedBy, disputedAt, disputeReason, disputeResolved
   - Add: `metadata` flexible object for additional data
   
2. Indexes:
   - Compound: { event: 1, category: 1, candidate: 1 }
   - Compound: { 'voter.email': 1, event: 1, category: 1 }
   - Compound: { status: 1, votedAt: -1 }
   - Index: { 'source.ipAddress': 1, event: 1 }
   - Index: { 'verification.paymentId': 1 }
   
3. Virtuals:
   - isValid: Check if vote counts
   - effectiveWeight: Calculate final vote weight
   - age: Calculate time since vote
   
4. Instance Methods:
   - validate(): Run all validations
   - invalidate(reason, by): Mark as invalid
   - dispute(reason, by): Mark as disputed
   - resolveDispute(resolution, by): Resolve dispute
   - cancel(reason, by): Cancel vote
   
5. Static Methods:
   - findByCandidate(candidateId, filters): Get candidate votes
   - countValidVotes(candidateId): Count valid votes only
   - findDuplicates(voter, event, category): Detect duplicates
   - findByPayment(paymentId): Get votes from payment
   - getVotingStats(filters): Aggregate statistics
   - detectAnomalies(threshold): Find suspicious patterns
```

---

### 9. **Coupon Model** - Discount System

#### Current Issues:
- Basic validation
- No usage tracking
- Missing advanced rules

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Keep: name, code, discount, discountType, expiryDate
   - Add: `rules` subdocument:
     * minimumPurchaseAmount, maximumDiscountAmount
     * applicableEvents[], applicableCategories[], applicableBundles[]
     * excludeEvents[], excludeCategories[], excludeBundles[]
     * usageLimit (global), usageLimitPerUser
     * validFrom, validUntil, validDays[], validHours[]
   - Add: `targeting` subdocument:
     * userSegments[], roles[], emailDomains[]
     * firstTimeUsers, returningUsers
     * geographicRestrictions { countries[], cities[] }
   - Add: `usage` subdocument:
     * totalUsed, uniqueUsers, totalDiscountGiven
     * lastUsedAt, firstUsedAt
   - Add: `status` enum: ['draft', 'active', 'paused', 'expired', 'exhausted', 'archived']
   - Add: `stackable` boolean (can combine with other coupons)
   - Add: `priority` number (for stacking order)
   
2. Indexes:
   - Unique: { code: 1 }
   - Compound: { status: 1, validFrom: 1, validUntil: 1 }
   - Compound: { 'rules.applicableEvents': 1, status: 1 }
   - Index: { code: 1, status: 1 }
   
3. Virtuals:
   - isActive: Check if currently valid
   - isExpired: Check expiration
   - isExhausted: Check usage limit
   - remainingUses: Calculate remaining uses
   
4. Instance Methods:
   - validate(context): Check all conditions
   - canApply(user, order): Check eligibility
   - calculateDiscount(amount): Get discount value
   - recordUsage(user, order): Track usage
   - deactivate(): Disable coupon
   
5. Static Methods:
   - findByCode(code): Get by coupon code
   - findAvailable(filters): Get applicable coupons
   - getBestCoupon(order): Find best coupon for order
   - getCouponStats(couponId): Usage statistics
```

---

### 10. **Analytics Model** - Metrics & Insights

#### Current Issues:
- Monolithic structure
- No time-series optimization
- Missing aggregation helpers

#### New Design:
```javascript
// Key Changes:
1. Schema Structure:
   - Split into multiple collections:
     * AnalyticsSnapshot (hourly/daily snapshots)
     * AnalyticsMetric (individual metrics)
     * AnalyticsEvent (tracked events)
   
   AnalyticsSnapshot:
   - `timestamp` Date (indexed)
   - `period` enum: ['hour', 'day', 'week', 'month']
   - `scope` subdocument:
     * type: 'global' | 'event' | 'category' | 'candidate'
     * entityId (if specific)
   - `metrics` subdocument:
     * votes: { total, unique, weighted }
     * revenue: { total, average, currency }
     * engagement: { views, clicks, shares }
     * performance: { responseTime, errorRate }
   - `computed` subdocument:
     * growthRate, trend, forecast
   - `metadata` flexible object
   
2. Indexes:
   - Compound: { timestamp: -1, 'scope.type': 1, 'scope.entityId': 1 }
   - Compound: { period: 1, timestamp: -1 }
   - TTL: { timestamp: 1 }, expireAfterSeconds: (configurable)
   
3. Virtuals:
   - periodLabel: Human readable period
   - comparison: Compare with previous period
   
4. Instance Methods:
   - calculateGrowth(): Growth vs previous period
   - detectAnomaly(): Identify unusual patterns
   - generateForecast(): Predict future values
   
5. Static Methods:
   - createSnapshot(period, scope): Generate snapshot
   - getTimeSeries(start, end, filters): Time-series data
   - aggregateMetrics(period, filters): Aggregate across periods
   - getTopPerformers(metric, limit): Leaderboard
   - detectAnomalies(threshold): Find outliers
```

---

## Implementation Strategy

### Phase 1: Core Models (Week 1)
1. User, Role, Event, Category
2. Set up base classes and plugins
3. Implement soft delete
4. Add pagination support

### Phase 2: Transactional Models (Week 2)
1. Payment, Vote, VoteBundle, Coupon
2. Add transaction support
3. Implement state machines
4. Add fraud detection

### Phase 3: Support Models (Week 3)
1. Analytics, Activity, Notification
2. Implement time-series optimization
3. Add aggregation pipelines
4. Set up TTL indexes

### Phase 4: Integration & Testing (Week 4)
1. Model integration tests
2. Performance testing
3. Migration scripts
4. Documentation

---

## Migration Considerations

### Data Migration Strategy
1. **Create Migration Scripts**:
   - Write scripts to transform old schema to new
   - Handle missing fields with sensible defaults
   - Preserve all existing data

2. **Versioning**:
   - Add `schemaVersion` field to all models
   - Support both old and new schemas temporarily
   - Gradual migration with rollback capability

3. **Zero-Downtime Migration**:
   - Deploy new models alongside old
   - Dual-write during transition
   - Switch reads after migration complete
   - Remove old models after validation

4. **Validation**:
   - Compare old vs new data counts
   - Verify relationships integrity
   - Test critical queries on new schema
   - Validate computed fields

---

## Quality Checklist

For each model, ensure:
- [ ] All indexes are strategic and documented
- [ ] Virtuals are used for computed properties
- [ ] Instance methods handle single-document operations
- [ ] Static methods handle queries and aggregations
- [ ] Pre/post middleware is properly implemented
- [ ] Soft delete is configured if needed
- [ ] Pagination is supported
- [ ] Text search is enabled where appropriate
- [ ] All enums are comprehensive
- [ ] Validation is thorough but not restrictive
- [ ] Timestamps are automatic
- [ ] Audit fields track changes
- [ ] Schema is flexible for future changes
- [ ] Documentation is comprehensive

---

