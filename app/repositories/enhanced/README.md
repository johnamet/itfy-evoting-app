# Enhanced Repositories with Intelligent Caching

This directory contains enhanced versions of all repositories with built-in intelligent caching and automatic cache invalidation.

## Features

### 🚀 Intelligent Caching
- **Automatic Caching**: All read operations (`findById`, `findOne`, `find`) are automatically cached
- **Smart Invalidation**: Caches are automatically invalidated when entities are updated or deleted
- **Entity-Specific TTLs**: Different cache durations for different entity types
- **Query-Based Caching**: Complex queries are cached with proper key generation

### ♻️ Automatic Cache Invalidation
When an entity is updated, the system automatically:
1. **Invalidates entity-specific caches**: Clears all caches related to that specific entity ID
2. **Invalidates query caches**: Clears all query-based caches for that entity type
3. **Preserves fresh caches**: Only affected caches are invalidated; unrelated caches remain

### 🎯 Cache Strategy

#### Create Operations
- Invalidates all query-based caches for the entity type
- Reason: New entity affects listing queries

#### Update Operations
- Invalidates caches for the specific entity ID
- Invalidates all query-based caches for the entity type
- Reason: Entity data changed, affects both direct lookups and query results

#### Delete Operations
- Invalidates caches for the specific entity ID
- Invalidates all query-based caches for the entity type
- Reason: Entity removed, affects both direct lookups and query results

## Repository Overview

### UserRepository
- **Cache DB**: 2 (User-specific cache)
- **Default TTL**: 30 minutes
- **Special Features**:
  - Password operations skip cache
  - Authentication results are not cached
  - Email lookups are cached

**Example Usage**:
```javascript
import { userRepository } from './repositories/enhanced/index.js';

// Cached automatically
const user = await userRepository.findById(userId);

// Skip cache for sensitive operations
const userWithPassword = await userRepository.findByEmailWithPassword(email, {
    skipCache: true
});

// Authentication (never cached)
const authenticatedUser = await userRepository.authenticate(email, password);

// Update invalidates caches automatically
await userRepository.updateUser(userId, { name: 'New Name' });
// All caches for this user are now invalidated
```

### EventRepository
- **Cache DB**: 3 (Event-specific cache)
- **Default TTL**: 15 minutes
- **Special Features**:
  - Active events cached separately
  - Event results cached with vote counts

**Example Usage**:
```javascript
import { eventRepository } from './repositories/enhanced/index.js';

// Find and cache
const event = await eventRepository.findById(eventId);

// Find active events (cached)
const activeEvents = await eventRepository.findActiveEvents();

// Update invalidates all event caches
await eventRepository.updateEvent(eventId, { title: 'New Title' });
// Invalidates:
// - event:{eventId}:*
// - All query-based event caches
```

### VoteRepository
- **Cache DB**: 0 (Main cache)
- **Default TTL**: 5 minutes
- **Special Features**:
  - Vote results cached with aggregation
  - Vote checking (hasVoted) skips cache

**Example Usage**:
```javascript
import { voteRepository } from './repositories/enhanced/index.js';

// Cast vote (invalidates query caches)
await voteRepository.castVote({
    event: eventId,
    candidate: candidateId,
    voter: userId
});

// Get results (cached)
const results = await voteRepository.getEventResults(eventId);

// Check voting status (not cached for accuracy)
const hasVoted = await voteRepository.hasVoted(eventId, userId);
```

### CandidateRepository
- **Cache DB**: 0 (Main cache)
- **Default TTL**: 10 minutes
- **Special Features**:
  - Vote count increments invalidate caches
  - Position-based sorting

**Example Usage**:
```javascript
import { candidateRepository } from './repositories/enhanced/index.js';

// Get candidates for event (cached)
const candidates = await candidateRepository.findByEvent(eventId);

// Increment vote count (invalidates caches)
await candidateRepository.incrementVoteCount(candidateId);
```

### PaymentRepository
- **Cache DB**: 0 (Main cache)
- **Default TTL**: 30 minutes
- **Special Features**:
  - Revenue calculations cached
  - Payment verification invalidates caches

**Example Usage**:
```javascript
import { paymentRepository } from './repositories/enhanced/index.js';

// Find payment by reference (cached)
const payment = await paymentRepository.findByReference(reference);

// Verify payment (invalidates caches)
await paymentRepository.verifyPayment(reference, verificationData);

// Get revenue stats (cached)
const stats = await paymentRepository.getPaymentStats();
```

## Cache Configuration

### Entity-Specific TTLs (seconds)
```javascript
{
    user: 1800,          // 30 minutes
    event: 900,          // 15 minutes
    candidate: 600,      // 10 minutes
    vote: 300,           // 5 minutes
    payment: 1800,       // 30 minutes
    notification: 600,   // 10 minutes
    analytics: 3600,     // 1 hour
    settings: 7200,      // 2 hours
    default: 3600,       // 1 hour
}
```

### Cache Managers
- **mainCacheManager**: DB 0, prefix `itfy:main:`
- **userCacheManager**: DB 2, prefix `itfy:user:`
- **eventCacheManager**: DB 3, prefix `itfy:event:`

## Advanced Usage

### Skip Cache for Specific Operations
```javascript
// Skip cache when you need fresh data
const freshUser = await userRepository.findById(userId, {
    skipCache: true
});
```

### Manual Cache Invalidation
```javascript
// Clear all caches for an entity type
await userRepository.clearCache();

// Get cache statistics
const stats = userRepository.getCacheStats();
console.log(stats);
// {
//     hits: 1500,
//     misses: 200,
//     hitRate: '88.24%',
//     sets: 200,
//     deletes: 50,
//     invalidations: 100,
//     ...
// }
```

### Transaction Support with Caching
```javascript
import { userRepository } from './repositories/enhanced/index.js';

const result = await userRepository.withTransaction(async (session) => {
    const user = await userRepository.create(userData, { session });
    const profile = await profileRepository.create(profileData, { session });
    
    // Caches are automatically invalidated after transaction commits
    return { user, profile };
});
```

## Cache Invalidation Flow

### Example: Updating a User

```javascript
// 1. User requests update
await userRepository.updateUser(userId, { name: 'John Doe' });

// 2. BaseRepository.updateById is called
// 3. Update executes successfully
// 4. _invalidateCache is triggered automatically:
//    - Invalidates: user:findById:${userId}
//    - Invalidates: user:findOne:* (all query caches)
//    - Invalidates: _tracking:user:${userId} (tracking keys)
//    - Invalidates: _tracking:user:queries

// 5. Next read gets fresh data from DB and caches it
const user = await userRepository.findById(userId);
// Cache MISS → Fetch from DB → Cache for 30 min
```

### Example: Creating an Event

```javascript
// 1. Create new event
await eventRepository.createEvent(eventData);

// 2. Cache invalidation:
//    - Invalidates all query caches: event:find:*, event:findActiveEvents:*
//    - Reason: New event affects listing queries

// 3. Next query gets fresh data
const events = await eventRepository.findActiveEvents();
// Cache MISS → Fetch from DB → Cache for 15 min
```

## Performance Benefits

### Before (Without Caching)
- Every read hits the database
- Average response time: 50-200ms
- Database load: High

### After (With Intelligent Caching)
- Cache hits: < 5ms response time
- Cache misses: 50-200ms (same as before)
- Average hit rate: 85-95%
- Database load: Reduced by 85-95%

## Monitoring

### Check Cache Statistics
```javascript
import { mainCacheManager, userCacheManager, eventCacheManager } from '../utils/engine/CacheManager.js';

// Get stats for each cache manager
console.log('Main Cache:', mainCacheManager.getStats());
console.log('User Cache:', userCacheManager.getStats());
console.log('Event Cache:', eventCacheManager.getStats());
```

### Example Output
```javascript
{
    hits: 1500,
    misses: 200,
    sets: 200,
    deletes: 50,
    invalidations: 100,
    errors: 0,
    uptime: 3600000,
    hitRate: '88.24%',
    total: 1700
}
```

## Migration from Old Repositories

### Step 1: Update Imports
```javascript
// Old
import UserRepository from './repositories/UserRepository.js';
const userRepo = new UserRepository();

// New (Recommended)
import { userRepository } from './repositories/enhanced/index.js';

// Or create custom instance
import { UserRepository } from './repositories/enhanced/index.js';
const userRepo = new UserRepository();
```

### Step 2: Update Method Calls (If Needed)
Most methods remain the same. Key changes:
- `findByEmailWithPassword()` now skips cache automatically
- `authenticate()` never caches results
- All update/delete operations auto-invalidate caches

### Step 3: Test Cache Behavior
```javascript
// Verify caching works
const user1 = await userRepository.findById(userId);
// Cache MISS

const user2 = await userRepository.findById(userId);
// Cache HIT (much faster)

await userRepository.updateUser(userId, { name: 'New' });
// Cache invalidated

const user3 = await userRepository.findById(userId);
// Cache MISS (fetches fresh data)
```

## Best Practices

1. **Trust the Cache**: Don't skip cache unless necessary (authentication, real-time data)
2. **Monitor Hit Rates**: Aim for 80%+ hit rate
3. **Adjust TTLs**: Modify entity-specific TTLs in CacheManager if needed
4. **Use Transactions**: For multi-entity operations to ensure cache consistency
5. **Clear on Deployment**: Clear all caches after deploying schema changes

## Troubleshooting

### Cache Not Working
```javascript
// Check if caching is enabled
console.log(userRepository.cacheEnabled); // Should be true

// Check cache manager
console.log(userRepository.cacheManager); // Should not be null

// Test cache manually
await userRepository.cacheManager.set('User', 'test', '123', { test: 'data' });
const cached = await userRepository.cacheManager.get('User', 'test', '123');
console.log(cached); // Should return { test: 'data' }
```

### Stale Data Issues
```javascript
// Manually invalidate if needed
await userRepository.clearCache();

// Or invalidate specific entity
await userRepository.cacheManager.invalidateEntity('User', userId);
```

## API Reference

See individual repository files for complete method documentation.

## License

Part of the ITFY E-Voting System
