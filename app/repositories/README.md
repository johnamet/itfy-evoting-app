# Repository Layer Documentation

## Overview

The repository layer provides a data access abstraction layer for the e-voting application. It follows the Repository Pattern to encapsulate database operations and provide a clean, testable interface for data access.

## Architecture

### BaseRepository

The `BaseRepository` class serves as an abstract base class that provides common CRUD operations:

- **Create**: `create()`, `createMany()`
- **Read**: `findById()`, `findOne()`, `find()`, `findWithPagination()`
- **Update**: `updateById()`, `updateOne()`, `updateMany()`
- **Delete**: `deleteById()`, `deleteOne()`, `deleteMany()`
- **Utilities**: `countDocuments()`, `exists()`, `aggregate()`, `distinct()`
- **Transactions**: `withTransaction()`, `startSession()`
- **Advanced**: `bulkWrite()`, `textSearch()`, `getStats()`

### Repository Classes

#### UserRepository
Handles user-specific operations:
```javascript
import { UserRepository } from './repositories/index.js';

const userRepo = new UserRepository();

// Authentication
const user = await userRepo.authenticate(email, password);

// User management
const profile = await userRepo.getProfile(userId);
await userRepo.updateProfile(userId, profileData);
await userRepo.updatePassword(userId, newPassword, currentPassword);

// Search and filtering
const users = await userRepo.findByRole(roleId);
const activeUsers = await userRepo.findActive();
const searchResults = await userRepo.search('john');
```

#### VoteRepository
Manages voting operations:
```javascript
import { VoteRepository } from './repositories/index.js';

const voteRepo = new VoteRepository();

// Voting
await voteRepo.castVote({
    user: userId,
    event: eventId,
    candidate: candidateId,
    category: categoryId
});

// Vote analysis
const results = await voteRepo.getElectionResults(eventId);
const counts = await voteRepo.getVoteCountsByCategory(eventId);
const stats = await voteRepo.getVotingStats(eventId);
```

#### EventRepository
Handles event lifecycle:
```javascript
import { EventRepository } from './repositories/index.js';

const eventRepo = new EventRepository();

// Event management
const event = await eventRepo.createEvent(eventData);
await eventRepo.startEvent(eventId);
await eventRepo.endEvent(eventId);
await eventRepo.cancelEvent(eventId, reason);

// Event queries
const activeEvents = await eventRepo.findActiveEvents();
const upcomingEvents = await eventRepo.findUpcomingEvents();
const votableEvents = await eventRepo.getVotableEvents(userId);
```

#### CandidateRepository
Manages candidates:
```javascript
import { CandidateRepository } from './repositories/index.js';

const candidateRepo = new CandidateRepository();

// Candidate management
const candidate = await candidateRepo.createCandidate(candidateData);
const candidates = await candidateRepo.findByEvent(eventId);
const topCandidates = await candidateRepo.getTopCandidates(eventId, 10);

// Statistics
const candidateStats = await candidateRepo.getCandidateWithStats(candidateId);
```

#### CouponRepository
Handles coupon operations:
```javascript
import { CouponRepository } from './repositories/index.js';

const couponRepo = new CouponRepository();

// Coupon validation and application
const validation = await couponRepo.validateCoupon(code, userId);
const result = await couponRepo.applyCoupon(code, userId, orderAmount);

// Coupon management
const uniqueCode = await couponRepo.generateUniqueCode();
const coupons = await couponRepo.bulkCreateCoupons(couponDataArray);
```

## Usage Examples

### Basic CRUD Operations

```javascript
import { UserRepository } from './repositories/index.js';

const userRepo = new UserRepository();

// Create
const newUser = await userRepo.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'securepassword',
    role: roleId
});

// Read
const user = await userRepo.findById(userId);
const users = await userRepo.find({ role: roleId });

// Update
const updatedUser = await userRepo.updateById(userId, { name: 'John Smith' });

// Delete
await userRepo.deleteById(userId);
```

### Pagination

```javascript
const paginatedUsers = await userRepo.findWithPagination(
    { isActive: true }, // criteria
    1, // page
    10, // limit
    { populate: 'role', sort: { createdAt: -1 } } // options
);

console.log(paginatedUsers);
// {
//   docs: [...],
//   total: 150,
//   page: 1,
//   limit: 10,
//   pages: 15,
//   hasNext: true,
//   hasPrev: false
// }
```

### Transactions

```javascript
await userRepo.withTransaction(async (session) => {
    const user = await userRepo.create(userData, { session });
    const profile = await profileRepo.create({ user: user._id }, { session });
    return { user, profile };
});
```

### Aggregation

```javascript
const userStats = await userRepo.aggregate([
    {
        $group: {
            _id: '$role',
            count: { $sum: 1 },
            averageAge: { $avg: '$age' }
        }
    }
]);
```

## Error Handling

All repository methods include comprehensive error handling:

```javascript
try {
    const user = await userRepo.create(userData);
} catch (error) {
    if (error.name === 'ValidationError') {
        console.log('Validation errors:', error.details);
    } else if (error.name === 'DuplicateError') {
        console.log('Duplicate field:', error.field);
    } else if (error.name === 'CastError') {
        console.log('Invalid format for field:', error.path);
    } else {
        console.log('General error:', error.message);
    }
}
```

## Advanced Features

### Text Search

```javascript
// Requires text index on the model
const searchResults = await userRepo.textSearch('john developer');
```

### Bulk Operations

```javascript
const operations = [
    { insertOne: { document: userData1 } },
    { updateOne: { filter: { _id: userId }, update: { name: 'New Name' } } },
    { deleteOne: { filter: { _id: userId2 } } }
];

const result = await userRepo.bulkWrite(operations);
```

### Statistics

```javascript
const stats = await userRepo.getStats();
// {
//   total: 1000,
//   recentCount: 50,
//   modelName: 'User'
// }
```

## Best Practices

1. **Always use repositories instead of direct model access**
2. **Handle errors appropriately using try-catch blocks**
3. **Use transactions for operations that affect multiple collections**
4. **Leverage pagination for large datasets**
5. **Use aggregation for complex queries and reporting**
6. **Populate related documents when needed**
7. **Validate data before creating/updating**

## Testing

Repository classes are designed to be easily testable:

```javascript
import { UserRepository } from '../repositories/index.js';
import sinon from 'sinon';

describe('UserRepository', () => {
    let userRepo;
    let mockModel;

    beforeEach(() => {
        mockModel = {
            create: sinon.stub(),
            findById: sinon.stub(),
            findOne: sinon.stub()
        };
        userRepo = new UserRepository();
        userRepo.model = mockModel;
    });

    it('should create a user', async () => {
        const userData = { name: 'Test User', email: 'test@example.com' };
        mockModel.create.resolves(userData);

        const result = await userRepo.create(userData);
        
        expect(result).to.equal(userData);
        expect(mockModel.create.calledWith(userData)).to.be.true;
    });
});
```

## Performance Considerations

1. **Use indexes** on frequently queried fields
2. **Limit returned fields** using `select` option
3. **Use pagination** for large result sets
4. **Optimize aggregation pipelines**
5. **Use connection pooling** for production
6. **Monitor query performance** with MongoDB profiler

## Environment Setup

Ensure your MongoDB connection is properly configured in your application:

```javascript
import mongoose from 'mongoose';

// Connect to MongoDB
await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
```

## Contributing

When adding new repositories:

1. Extend `BaseRepository`
2. Add model-specific methods
3. Include proper error handling
4. Add JSDoc documentation
5. Update the index.js exports
6. Write comprehensive tests
