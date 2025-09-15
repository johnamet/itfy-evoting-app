# ITFY E-Voting Backend Model Design Documentation

## Overview

This document provides a comprehensive overview of the backend model design for the ITFY E-Voting application. The system is built using Node.js with MongoDB as the database, utilizing Mongoose for object modeling.

## Architecture Principles

### 1. Base Model Pattern
All models extend from a `BaseModel` abstract class that provides:
- Common fields: `createdAt`, `updatedAt`, `_id`, `__v`
- Automatic timestamp management
- JSON serialization (excludes version key)
- Common CRUD operations with pagination
- Standardized schema patterns

### 2. Security-First Design
- Password hashing using bcrypt with salt rounds
- Role-based access control (RBAC)
- Activity tracking for audit trails
- Input validation and sanitization
- Secure payment processing with webhook verification

### 3. Performance Optimization
- Strategic database indexing
- Pre-computed analytics for dashboard performance
- Efficient relationship modeling
- Pagination support
- Text search capabilities

## Core Model Groups

### 1. User Management System

#### User Model
```javascript
- Authentication: email/password with bcrypt hashing
- Profile: name, bio, image, phone, location
- Security: password reset tokens, login tracking
- Status: active/inactive states
- Relationships: belongs to Role, creates Events/Categories/Forms
```

#### Role Model
```javascript
- Hierarchical role system with numeric levels
- Name-based role identification
- Used for authorization throughout the system
```

### 2. Event Management System

#### Event Model
```javascript
- Core Information: name, description, start/end dates
- Location: embedded object with coordinates, address details
- Rich Content: gallery, speakers, sponsors, timeline
- Relationships: contains Categories, hosts Candidates
- Form Integration: optional registration form
```

#### Category Model
```javascript
- Voting Categories: name, description, icon
- Voting Control: deadline, open/closed status
- Relationships: contains Candidates, receives Votes
```

#### Candidate Model
```javascript
- Profile: name, email, bio, title, location, photo
- Professional: skills, education, experience, achievements
- Nomination: nominated by field, unique candidate ID
- Status: pending/active/inactive states
- Relationships: belongs to Event and Categories
```

### 3. Voting System

#### Vote Model
```javascript
- Core: links Candidate, Category, Event
- Voter Info: optional voter details (email, name)
- Tracking: timestamp, IP address
- Bundle Integration: uses VoteBundle for payment
```

#### VoteBundle Model
```javascript
- Product Definition: name, description, features
- Pricing: price, currency, popularity flag
- Vote Allocation: number of votes included
- Applicability: specific events and categories
- Coupon Integration: applicable coupons
```

### 4. Payment System

#### Payment Model
```javascript
- Paystack Integration: reference, transaction data
- Voter Information: email, contact, IP, user agent
- Bundle Purchases: quantity, price, votes per bundle
- Pricing: original amount, discounts, final amount
- Status Tracking: pending → success/failed/expired
- Audit: complete transaction history
```

#### Coupon System
```javascript
Coupon Model:
- Code Management: unique codes, expiry dates
- Discount Types: percentage or fixed amount
- Usage Limits: max uses, current usage count
- Applicability: events, categories, bundles
- Validation: minimum order amounts

CouponUsage Model:
- Usage Tracking: when, where, how much saved
- Analytics: order amounts, discount effectiveness
- Audit Trail: complete usage history
```

### 5. Content Management

#### Form System
```javascript
Form Model:
- Dynamic Forms: configurable fields and validation
- Model Integration: links to Events for registration
- Submission Tracking: count, history, limits
- Data Storage: flexible field definitions

FormSubmission (Embedded):
- Submission Data: captured form responses
- Metadata: IP, user agent, timestamp
- Anonymous Support: optional user identification
```

#### File Management
```javascript
File Model:
- Metadata: filename, size, MIME type, paths
- Security: uploaded by tracking, unique file IDs
- Organization: tags and categorization
- Storage: both absolute and relative path tracking
```

### 6. Analytics & Monitoring

#### Activity Tracking
```javascript
Activity Model:
- Action Logging: create, update, delete, view operations
- Site Analytics: page visits, hourly data, user tracking
- Anonymous Tracking: visitor analytics without user data
- Audit Trail: complete system activity history
```

#### Analytics System
```javascript
Analytics Model:
- Pre-computed Metrics: dashboard performance optimization
- Time Periods: hourly, daily, weekly, monthly, yearly
- Multiple Types: voting, payments, users, geographic
- Flexible Data: JSON storage for various metric types
```

### 7. Communication System

#### Notification Model
```javascript
- Message System: title, message, type classification
- Priority Levels: low, normal, high, urgent
- Categories: vote, payment, user, event, security
- User Targeting: system-wide or user-specific
- Read Status: tracking and timestamps
```

#### Settings System
```javascript
- Configuration Management: system and model-specific settings
- Type Classification: general, security, payment, email
- Model Integration: instance-specific configurations
- Validation: embedded rules for setting values
- Visibility Control: editable and visible flags
```

### 8. Presentation Layer

#### Slide System
```javascript
- Homepage Carousel: title, subtitle, images
- Call-to-Action: button configuration
- Publication Control: active and published states
- Settings: flexible configuration options
```

## Key Relationships

### Primary Relationships
1. **User → Role**: Many-to-One (users have one role)
2. **Event → Category**: One-to-Many (events contain multiple categories)
3. **Category → Candidate**: Many-to-Many (candidates can be in multiple categories)
4. **Vote**: Links Candidate, Category, Event, and VoteBundle
5. **Payment**: Links Event, Candidate, VoteBundle, and optional Coupon

### Cross-Cutting Relationships
1. **Activity Tracking**: All models can generate activity records
2. **File Uploads**: Users upload files for various models
3. **Settings**: Can be applied to any model type or instance
4. **Notifications**: Can target specific users or be system-wide

## Database Optimization

### Indexing Strategy
```javascript
// Performance-critical indexes
User: email (unique), role
Candidate: event, email (unique), cId (unique)
Vote: candidate, event, category, voter.email
Payment: reference (unique), status, voter.email
Activity: user + timestamp, action + targetType
Category: event, isActive + isDeleted
```

### Text Search
```javascript
// Full-text search capabilities
Event: name + description
Category: name + description
Settings: key + name
```

### Compound Indexes
```javascript
// Multi-field optimization
Form: modelId + model (unique)
Analytics: type + period + startDate
Settings: type + modelType + key
```

## Security Considerations

### Data Protection
1. **Password Security**: bcrypt hashing with salt rounds
2. **Input Validation**: Mongoose validators and custom validation
3. **Access Control**: Role-based permissions with numeric levels
4. **Audit Trails**: Complete activity logging
5. **Payment Security**: Webhook signature verification

### Privacy Features
1. **Anonymous Voting**: Optional voter information
2. **Data Sanitization**: Automatic password exclusion from JSON
3. **IP Tracking**: For security and analytics
4. **Secure File Handling**: Metadata tracking and validation

## Scalability Features

### Performance Optimization
1. **Pre-computed Analytics**: Reduces real-time calculation overhead
2. **Strategic Indexing**: Optimizes common query patterns
3. **Pagination Support**: Handles large datasets efficiently
4. **Embedded Documents**: Reduces join operations

### Flexibility
1. **Dynamic Forms**: Configurable field types and validation
2. **Flexible Settings**: Model-specific and instance-specific configuration
3. **Multi-Event Support**: Single system handles multiple events
4. **Extensible Analytics**: JSON storage for evolving metrics

## API Integration Points

### External Services
1. **Paystack**: Payment processing and webhook handling
2. **Email Services**: Notification and communication
3. **File Storage**: Image and document management
4. **Analytics**: Performance monitoring and reporting

### Internal Services
1. **Authentication**: JWT-based session management
2. **Authorization**: Role-based access control
3. **Caching**: Performance optimization
4. **Background Jobs**: Email sending, analytics calculation

## Migration and Maintenance

### Schema Evolution
- Base model pattern ensures consistent updates
- Flexible JSON fields allow for new features
- Index management for performance optimization
- Validation updates for data integrity

### Data Integrity
- Foreign key relationships through ObjectId references
- Cascade operations for data consistency
- Soft deletes with isDeleted flags
- Activity logging for change tracking

## Usage Patterns

### Typical Workflows
1. **Event Creation**: User → Event → Categories → Candidates
2. **Voting Process**: Payment → VoteBundle → Votes → Analytics
3. **Content Management**: Forms → Submissions → Analytics
4. **System Administration**: Settings → Notifications → Activity Monitoring

### Query Patterns
1. **Dashboard Analytics**: Pre-computed metrics retrieval
2. **Real-time Voting**: Candidate vote counts and rankings
3. **Payment Processing**: Transaction status and validation
4. **User Management**: Authentication and authorization
5. **Content Delivery**: Events, categories, and candidate information

This model design provides a robust, scalable, and secure foundation for the ITFY E-Voting application, supporting complex voting scenarios while maintaining performance and data integrity.
