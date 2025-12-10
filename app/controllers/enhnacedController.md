# Controller Layer Instructions for ITFY E-Voting Backend

## Overview
Controllers handle HTTP request/response logic, input validation, authentication/authorization, and coordinate between routes and services. They are the entry point for all API endpoints.

## Base Controller Specification

### Core Responsibilities
1. **Request Handling**: Parse and validate incoming HTTP requests
2. **Response Formatting**: Standardize all API responses
3. **Error Handling**: Catch and format errors consistently
4. **Authentication**: Verify JWT tokens and extract user context
5. **Authorization**: Check user permissions and roles
6. **Input Validation**: Validate request parameters, query strings, and body
7. **Pagination**: Parse and validate pagination parameters
8. **File Upload Handling**: Process multipart form data
9. **Rate Limiting**: Track and enforce rate limits per endpoint
10. **Logging**: Log all requests and responses for debugging

### BaseController Features

#### Standard Response Methods
```javascript
// Success responses
sendSuccess(res, data, message, statusCode = 200)
sendCreated(res, data, message)
sendNoContent(res)

// Error responses
sendError(res, error, statusCode = 500)
sendBadRequest(res, message, errors = [])
sendUnauthorized(res, message)
sendForbidden(res, message)
sendNotFound(res, message)
sendConflict(res, message)
sendValidationError(res, errors)
```

#### Request Parsing Methods
```javascript
// Extract data from request
getRequestBody(req)
getRequestParams(req)
getRequestQuery(req)
getRequestHeaders(req)
getRequestUser(req) // From JWT middleware
getRequestIP(req)
getRequestUserAgent(req)

// Pagination
getPagination(req) // Returns { page, limit, skip }
getSortOptions(req) // Returns MongoDB sort object
getFilterOptions(req) // Returns MongoDB filter object
```

#### Validation Methods
```javascript
// Field validation
validateRequiredFields(data, fields)
validateEmail(email)
validatePassword(password)
validateMongoId(id)
validateDateRange(startDate, endDate)
validateFileUpload(file, options)

// Type validation
isValidInteger(value)
isValidBoolean(value)
isValidDate(value)
isValidEnum(value, allowedValues)
```

#### Authorization Methods
```javascript
// Role checking
requireRole(req, roles) // roles can be string or array
requireLevel(req, minLevel)
requireOwnership(req, resourceOwnerId)
requireEventAccess(req, eventId)

// Permission checking
hasPermission(req, permission)
canModifyResource(req, resource)
```

#### File Upload Methods
```javascript
handleFileUpload(req, res, uploadMiddleware)
validateUploadedFile(file, options)
cleanupFailedUpload(filePath)
```

#### Async Handler Wrapper
```javascript
asyncHandler(fn) // Wraps async functions to catch errors
```

---

## Controller Structure

### 1. **AuthController**
Handles authentication and authorization operations.

**Endpoints:**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout
- `POST /auth/verify-email` - Verify email with token
- `POST /auth/resend-verification` - Resend verification email
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token
- `POST /auth/change-password` - Change password (authenticated)
- `GET /auth/me` - Get current user profile
- `POST /auth/candidate/register` - Candidate registration
- `POST /auth/candidate/login` - Candidate login
- `POST /auth/candidate/verify-email` - Verify candidate email

**Key Validations:**
- Email format validation
- Password strength validation (min 8 chars, uppercase, lowercase, number)
- Token verification for email/password reset
- Rate limiting on login attempts (max 5 per 15 minutes)
- CSRF token validation for state-changing operations

**Special Handling:**
- Set HTTP-only cookies for refresh tokens
- Clear cookies on logout
- Return user object without sensitive fields (no password)
- Track login attempts and lock accounts after 5 failures
- Log all authentication events for audit

---

### 2. **UserController**
Manages user profiles and account operations.

**Endpoints:**
- `GET /users` - List all users (admin only)
- `GET /users/:id` - Get user by ID
- `GET /users/search` - Search users by name/email
- `PATCH /users/:id` - Update user profile
- `PATCH /users/:id/photo` - Update profile photo
- `PATCH /users/:id/password` - Update password
- `PATCH /users/:id/role` - Update user role (admin only)
- `PATCH /users/:id/status` - Update user status (admin only)
- `DELETE /users/:id` - Delete user (admin only)
- `GET /users/:id/stats` - Get user statistics
- `GET /users/:id/votes` - Get user's voting history
- `GET /users/:id/events` - Get user's created events
- `POST /users/bulk-update` - Bulk update users (admin only)

**Authorization Rules:**
- Users can read own profile
- Users can update own profile (limited fields)
- Admins can read/update all users
- Only super-admins can delete users
- Role/level changes require admin privileges

**Validations:**
- Valid MongoDB ObjectId for user ID
- Email uniqueness when updating
- Phone number format validation
- Date of birth must be in past
- Photo upload: max 5MB, image formats only

---

### 3. **EventController**
Handles event lifecycle management.

**Endpoints:**
- `POST /events` - Create event (organizer+)
- `GET /events` - List events with filters
- `GET /events/:id` - Get event details
- `GET /events/active` - Get active events
- `GET /events/upcoming` - Get upcoming events
- `PATCH /events/:id` - Update event
- `PATCH /events/:id/status` - Update event status
- `PATCH /events/:id/banner` - Update event banner
- `POST /events/:id/publish` - Publish event
- `POST /events/:id/activate` - Activate event for voting
- `POST /events/:id/close` - Close event
- `POST /events/:id/archive` - Archive event
- `POST /events/:id/cancel` - Cancel event
- `DELETE /events/:id` - Delete event (draft only)
- `GET /events/:id/stats` - Get event statistics
- `GET /events/:id/results` - Get event results
- `POST /events/:id/calculate-results` - Recalculate results

**Authorization Rules:**
- Level 2+ (organizers) can create events
- Event creator can update/manage their events
- Admins can manage all events
- Public users can view published/active events only

**Validations:**
- Event name: 3-200 characters
- Start date must be in future for new events
- End date must be after start date
- Minimum duration: 1 hour (configurable)
- Category must exist
- Banner upload: max 5MB, image formats only

**Business Rules:**
- Cannot update active/closed events' dates
- Cannot activate event without minimum candidates (default: 2)
- Cannot delete events that have votes
- Status transitions must follow workflow: draft → published → active → closed → archived

---

### 4. **CandidateController**
Manages candidate profiles and approvals.

**Endpoints:**
- `POST /candidates` - Create candidate
- `GET /candidates` - List candidates with filters
- `GET /candidates/:id` - Get candidate details
- `GET /candidates/event/:eventId` - Get candidates for event
- `GET /candidates/pending` - Get pending approvals (admin)
- `PATCH /candidates/:id` - Update candidate
- `PATCH /candidates/:id/photo` - Update candidate photo
- `POST /candidates/:id/approve` - Approve candidate (admin)
- `POST /candidates/:id/reject` - Reject candidate (admin)
- `POST /candidates/:id/suspend` - Suspend candidate (admin)
- `DELETE /candidates/:id` - Delete candidate (pending only)
- `GET /candidates/:id/stats` - Get candidate statistics
- `GET /candidates/event/:eventId/rankings` - Get candidate rankings
- `POST /candidates/bulk-approve` - Bulk approve candidates (admin)

**Authorization Rules:**
- Event organizers can create candidates for their events
- Admins can approve/reject/suspend candidates
- Candidates can update own profile (limited fields)
- Public users can view approved candidates only

**Validations:**
- Candidate name: 3-100 characters
- Email format and uniqueness per event
- Manifesto: max 2000 characters
- Category must exist and belong to event
- Photo upload: max 5MB, image formats only
- Documents: PDF only, max 10MB

**Business Rules:**
- Cannot approve candidate if event is closed/archived
- Cannot have duplicate emails in same event
- Email verification required after approval
- Suspended candidates cannot receive votes

---

### 5. **VotingController**
Handles vote casting and voting analytics.

**Endpoints:**
- `POST /votes` - Cast a vote
- `GET /votes` - List votes (admin only)
- `GET /votes/:id` - Get vote details
- `GET /votes/user/:userId` - Get user's votes
- `GET /votes/event/:eventId` - Get event votes
- `GET /votes/event/:eventId/stats` - Get voting statistics
- `GET /votes/event/:eventId/analytics` - Get voting analytics
- `POST /votes/check` - Check if user has voted
- `POST /votes/:id/verify` - Verify vote authenticity
- `DELETE /votes/:id` - Delete vote (admin only, rare)
- `POST /vote-bundles` - Create vote bundle
- `POST /vote-bundles/verify` - Verify vote bundle code
- `GET /vote-bundles/:id` - Get bundle details

**Authorization Rules:**
- Authenticated users can cast votes
- Users can view own votes
- Admins can view all votes
- Event organizers can view votes for their events

**Validations:**
- Event must be active
- Current time must be within voting period
- Candidate must be approved
- User cannot vote twice (unless settings allow)
- Vote bundle code must be valid and unused

**Business Rules:**
- Cannot vote in draft/closed events
- Cannot vote for suspended candidates
- Cannot vote for candidates in different events
- IP address and user agent are logged
- Duplicate vote prevention based on settings

**Rate Limiting:**
- Max 10 votes per minute per user
- Max 100 votes per hour per IP

---

### 6. **PaymentController**
Handles payment processing and verification.

**Endpoints:**
- `POST /payments/initialize` - Initialize payment
- `POST /payments/verify` - Verify payment
- `POST /payments/webhook` - Paystack webhook handler
- `GET /payments` - List payments (admin)
- `GET /payments/:id` - Get payment details
- `GET /payments/user/:userId` - Get user payments
- `GET /payments/event/:eventId` - Get event payments
- `GET /payments/reference/:reference` - Get payment by reference
- `POST /payments/:id/refund` - Refund payment (admin)
- `GET /payments/stats` - Get payment statistics (admin)

**Authorization Rules:**
- Authenticated users can initialize payments
- Users can view own payments
- Admins can view all payments and issue refunds
- Webhook endpoint is public but signature-verified

**Validations:**
- Amount must be positive number
- Email format validation
- Event must exist and accept payments
- Coupon code validation if provided
- Webhook signature verification

**Business Rules:**
- Generate unique payment reference
- Apply coupon discounts before charging
- Cannot refund non-successful payments
- Payment status tracked: pending → successful/failed
- Send email receipt on successful payment

**Security:**
- Verify Paystack webhook signatures
- Never expose secret keys in responses
- Log all payment attempts
- Idempotency for webhook retries

---

### 7. **CouponController**
Manages coupons and discount codes.

**Endpoints:**
- `POST /coupons` - Create coupon (admin)
- `GET /coupons` - List coupons
- `GET /coupons/:id` - Get coupon details
- `POST /coupons/validate` - Validate coupon code
- `PATCH /coupons/:id` - Update coupon (admin)
- `POST /coupons/:id/deactivate` - Deactivate coupon (admin)
- `DELETE /coupons/:id` - Delete coupon (admin)
- `GET /coupons/:id/stats` - Get coupon statistics
- `GET /coupons/usage/:userId` - Get user's coupon usage
- `GET /coupons/event/:eventId` - Get event coupons

**Authorization Rules:**
- Admins and event organizers can create coupons
- Public users can validate coupons
- Only admins can delete coupons

**Validations:**
- Coupon code: 4-20 characters, alphanumeric
- Discount type: percentage or fixed
- Percentage: 0-100
- Fixed amount: must be positive
- Expiry date: must be in future
- Max usage: must be positive integer
- Min purchase amount: must be positive

**Business Rules:**
- Coupon codes are case-insensitive
- Cannot delete coupons that have been used
- Expired coupons cannot be used
- Usage count incremented on successful payment
- Can restrict coupons to specific events

---

### 8. **NotificationController**
Manages user notifications.

**Endpoints:**
- `GET /notifications` - Get user notifications
- `GET /notifications/unread` - Get unread notifications
- `GET /notifications/unread/count` - Get unread count
- `PATCH /notifications/:id/read` - Mark notification as read
- `POST /notifications/read-all` - Mark all as read
- `DELETE /notifications/:id` - Delete notification
- `DELETE /notifications/read` - Delete all read notifications
- `POST /notifications/send` - Send notification (admin)
- `POST /notifications/broadcast` - Broadcast to multiple users (admin)
- `GET /notifications/stats` - Get notification statistics (admin)

**Authorization Rules:**
- Users can only access own notifications
- Admins can send notifications to any user
- System can create notifications programmatically

**Validations:**
- Notification type: system, event, vote, payment, candidate, message
- Priority: low, normal, high, urgent
- Title: max 200 characters
- Message: max 1000 characters

**Features:**
- Real-time push via WebSockets when available
- Email fallback for urgent notifications
- Auto-delete read notifications after 30 days (configurable)
- Notification preferences per user

---

### 9. **AnalyticsController**
Provides analytics and reporting.

**Endpoints:**
- `GET /analytics/platform` - Platform overview (admin)
- `GET /analytics/events/:eventId` - Event analytics
- `GET /analytics/users/:userId` - User activity analytics
- `GET /analytics/revenue` - Revenue analytics (admin)
- `GET /analytics/voting-trends` - Voting trends
- `POST /analytics/reports/generate` - Generate custom report (admin)
- `GET /analytics/system-health` - System health metrics (admin)
- `GET /analytics/export` - Export analytics data (admin)

**Authorization Rules:**
- Admins can access all analytics
- Event organizers can access analytics for their events
- Users can access own activity analytics

**Validations:**
- Date ranges must be valid
- Report type must be supported
- Export format: json, csv, pdf

**Features:**
- Support multiple time periods: hour, day, week, month, year
- Aggregate data for performance
- Cache frequently requested analytics
- Rate limiting on expensive queries

---

### 10. **SettingsController**
Manages platform configuration.

**Endpoints:**
- `GET /settings` - Get all settings (admin)
- `GET /settings/public` - Get public settings
- `GET /settings/category/:category` - Get settings by category
- `GET /settings/:key` - Get specific setting
- `POST /settings` - Create/update setting (admin)
- `PUT /settings/bulk` - Update multiple settings (admin)
- `DELETE /settings/:key` - Delete setting (admin)
- `POST /settings/:key/reset` - Reset to default (admin)
- `POST /settings/import` - Import settings (admin)
- `GET /settings/export` - Export settings (admin)

**Authorization Rules:**
- Only admins can modify settings
- Public settings accessible to all
- Some settings require super-admin

**Validations:**
- Key format: alphanumeric with dots/underscores
- Category: system, email, payment, voting, security, notification, events, uploads
- Data type: string, number, boolean, json, array
- Value validation based on data type

**Features:**
- Settings versioning for rollback
- Audit trail for all changes
- Hot-reload settings without restart
- Settings validation before save

---

## BaseController Code

Now I'll provide the complete BaseController implementation:

```javascript
/**
 * BaseController
 * 
 * Foundation for all controllers with:
 * - Standardized response formatting
 * - Request parsing utilities
 * - Input validation helpers
 * - Error handling
 * - Authentication/authorization helpers
 * - Pagination support
 * - File upload handling
 * 
 * @module controllers/BaseController
 * @version 2.0.0
 */

import config from '../config/ConfigManager.js';
import { validationResult } from 'express-validator';

class BaseController {
    constructor() {
        this.controllerName = this.constructor.name;
    }

    // ================================
    // SUCCESS RESPONSE METHODS
    // ================================

    /**
     * Send success response
     * @param {Object} res - Express response object
     * @param {*} data - Response data
     * @param {string} [message='Success'] - Success message
     * @param {number} [statusCode=200] - HTTP status code
     */
    sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send created response (201)
     * @param {Object} res - Express response object
     * @param {*} data - Created resource data
     * @param {string} [message='Resource created successfully'] - Success message
     */
    sendCreated(res, data, message = 'Resource created successfully') {
        return this.sendSuccess(res, data, message, 201);
    }

    /**
     * Send no content response (204)
     * @param {Object} res - Express response object
     */
    sendNoContent(res) {
        return res.status(204).send();
    }

    /**
     * Send paginated response
     * @param {Object} res - Express response object
     * @param {Array} data - Data items
     * @param {Object} pagination - Pagination info
     * @param {string} [message='Success'] - Success message
     */
    sendPaginatedResponse(res, data, pagination, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data,
            pagination: {
                total: pagination.total,
                page: pagination.page,
                limit: pagination.limit,
                totalPages: Math.ceil(pagination.total / pagination.limit),
                hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
                hasPreviousPage: pagination.page > 1
            },
            timestamp: new Date().toISOString()
        });
    }

    // ================================
    // ERROR RESPONSE METHODS
    // ================================

    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {Error|string} error - Error object or message
     * @param {number} [statusCode=500] - HTTP status code
     */
    sendError(res, error, statusCode = 500) {
        const errorMessage = error instanceof Error ? error.message : error;
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Log error for debugging (don't expose stack in production)
        if (config.get('env') !== 'production') {
            console.error(`[${this.controllerName}] Error:`, errorStack || errorMessage);
        }

        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            ...(config.get('env') === 'development' && errorStack && { stack: errorStack }),
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send bad request response (400)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     * @param {Array} [errors=[]] - Validation errors
     */
    sendBadRequest(res, message, errors = []) {
        return res.status(400).json({
            success: false,
            error: message,
            ...(errors.length > 0 && { errors }),
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send unauthorized response (401)
     * @param {Object} res - Express response object
     * @param {string} [message='Unauthorized'] - Error message
     */
    sendUnauthorized(res, message = 'Unauthorized - Authentication required') {
        return res.status(401).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send forbidden response (403)
     * @param {Object} res - Express response object
     * @param {string} [message='Forbidden'] - Error message
     */
    sendForbidden(res, message = 'Forbidden - Insufficient permissions') {
        return res.status(403).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send not found response (404)
     * @param {Object} res - Express response object
     * @param {string} [message='Resource not found'] - Error message
     */
    sendNotFound(res, message = 'Resource not found') {
        return res.status(404).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send conflict response (409)
     * @param {Object} res - Express response object
     * @param {string} message - Error message
     */
    sendConflict(res, message) {
        return res.status(409).json({
            success: false,
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send validation error response (422)
     * @param {Object} res - Express response object
     * @param {Array} errors - Validation errors
     */
    sendValidationError(res, errors) {
        return res.status(422).json({
            success: false,
            error: 'Validation failed',
            errors: errors.map(err => ({
                field: err.param || err.path,
                message: err.msg || err.message,
                value: err.value
            })),
            timestamp: new Date().toISOString()
        });
    }

    // ================================
    // REQUEST PARSING METHODS
    // ================================

    /**
     * Get request body
     * @param {Object} req - Express request object
     * @returns {Object}
     */
    getRequestBody(req) {
        return req.body || {};
    }

    /**
     * Get request params
     * @param {Object} req - Express request object
     * @returns {Object}
     */
    getRequestParams(req) {
        return req.params || {};
    }

    /**
     * Get request query
     * @param {Object} req - Express request object
     * @returns {Object}
     */
    getRequestQuery(req) {
        return req.query || {};
    }

    /**
     * Get request headers
     * @param {Object} req - Express request object
     * @returns {Object}
     */
    getRequestHeaders(req) {
        return req.headers || {};
    }

    /**
     * Get authenticated user from request
     * @param {Object} req - Express request object
     * @returns {Object|null}
     */
    getRequestUser(req) {
        return req.user || null;
    }

    /**
     * Get user ID from request
     * @param {Object} req - Express request object
     * @returns {string|null}
     */
    getUserId(req) {
        return req.user?._id || req.user?.id || null;
    }

    /**
     * Get client IP address
     * @param {Object} req - Express request object
     * @returns {string}
     */
    getRequestIP(req) {
        return req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0] || 
               req.connection?.remoteAddress || 
               'unknown';
    }

    /**
     * Get user agent
     * @param {Object} req - Express request object
     * @returns {string}
     */
    getRequestUserAgent(req) {
        return req.headers['user-agent'] || 'unknown';
    }

    /**
     * Get request metadata
     * @param {Object} req - Express request object
     * @returns {Object}
     */
    getRequestMetadata(req) {
        return {
            ip: this.getRequestIP(req),
            userAgent: this.getRequestUserAgent(req),
            userId: this.getUserId(req),
            timestamp: new Date()
        };
    }

    // ================================
    // PAGINATION METHODS
    // ================================

    /**
     * Get pagination parameters from request
     * @param {Object} req - Express request object
     * @param {Object} [defaults={}] - Default values
     * @returns {Object} { page, limit, skip }
     */
    getPagination(req, defaults = {}) {
        const page = Math.max(1, parseInt(req.query.page) || defaults.page || 1);
        const limit = Math.min(
            100, 
            Math.max(1, parseInt(req.query.limit) || defaults.limit || 10)
        );
        const skip = (page - 1) * limit;

        return { page, limit, skip };
    }

    /**
     * Get sort options from request
     * @param {Object} req - Express request object
     * @param {Object} [defaultSort={}] - Default sort
     * @returns {Object} MongoDB sort object
     */
    getSortOptions(req, defaultSort = { createdAt: -1 }) {
        const sortBy = req.query.sortBy;
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        if (!sortBy) {
            return defaultSort;
        }

        return { [sortBy]: sortOrder };
    }

    /**
     * Get filter options from request
     * @param {Object} req - Express request object
     * @param {Array} [allowedFilters=[]] - Allowed filter fields
     * @returns {Object} MongoDB filter object
     */
    getFilterOptions(req, allowedFilters = []) {
        const filters = {};
        const query = this.getRequestQuery(req);

        for (const field of allowedFilters) {
            if (query[field] !== undefined) {
                filters[field] = query[field];
            }
        }

        return filters;
    }

    // ================================
    // VALIDATION METHODS
    // ================================

    /**
     * Check validation results from express-validator
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {boolean} True if valid, sends error response if invalid
     */
    checkValidation(req, res) {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            this.sendValidationError(res, errors.array());
            return false;
        }
        
        return true;
    }

    /**
     * Validate required fields
     * @param {Object} data - Data to validate
     * @param {Array<string>} fields - Required field names
     * @returns {Array} Array of missing fields
     */
    validateRequiredFields(data, fields) {
        const missing = [];
        
        for (const field of fields) {
            if (data[field] === undefined || data[field] === null || data[field] === '') {
                missing.push(field);
            }
        }

        return missing;
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean}
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate MongoDB ObjectId
     * @param {string} id - ID to validate
     * @returns {boolean}
     */
    validateMongoId(id) {
        return /^[0-9a-fA-F]{24}$/.test(id);
    }

    /**
     * Validate date range
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date
     * @returns {boolean}
     */
    validateDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return !isNaN(start.getTime()) && 
               !isNaN(end.getTime()) && 
               start < end;
    }

    /**
     * Validate file upload
     * @param {Object} file - Uploaded file object
     * @param {Object} options - Validation options
     * @returns {Object} { valid: boolean, error: string }
     */
    validateFileUpload(file, options = {}) {
        const {
            maxSize = 5 * 1024 * 1024, // 5MB default
            allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'],
            required = true
        } = options;

        if (!file) {
            return {
                valid: !required,
                error: required ? 'File is required' : null
            };
        }

        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File size must not exceed ${maxSize / (1024 * 1024)}MB`
            };
        }

        if (!allowedTypes.includes(file.mimetype)) {
            return {
                valid: false,
                error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Check if value is valid integer
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    isValidInteger(value) {
        return Number.isInteger(Number(value));
    }

    /**
     * Check if value is valid boolean
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    isValidBoolean(value) {
        return value === true || value === false || 
               value === 'true' || value === 'false';
    }

    /**
     * Check if value is valid date
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    isValidDate(value) {
        const date = new Date(value);
        return !isNaN(date.getTime());
    }

    /**
     * Check if value is in allowed enum values
     * @param {*} value - Value to check
     * @param {Array} allowedValues - Allowed values
     * @returns {boolean}
     */
    isValidEnum(value, allowedValues) {
        return allowedValues.includes(value);
    }

    // ================================
    // AUTHORIZATION METHODS
    // ================================

    /**
     * Check if user has required role
     * @param {Object} req - Express request object
     * @param {string|Array<string>} roles - Required role(s)
     * @returns {boolean}
     */
    requireRole(req, roles) {
        const user = this.getRequestUser(req);
        
        if (!user) {
            return false;
            }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        return allowedRoles.includes(user.role);
    }

    /**
     * Check if user has minimum level
     * @param {Object} req - Express request object
     * @param {number} minLevel - Minimum required level
     * @returns {boolean}
     */
    requireLevel(req, minLevel) {
        const user = this.getRequestUser(req);
        return user && user.level >= minLevel;
    }

    /**
     * Check if user is owner of resource
     * @param {Object} req - Express request object
     * @param {string} resourceOwnerId - Resource owner ID
     * @returns {boolean}
     */
    requireOwnership(req, resourceOwnerId) {
        const userId = this.getUserId(req);
        return userId && userId.toString() === resourceOwnerId.toString();
    }

    /**
     * Check if user is admin
     * @param {Object} req - Express request object
     * @returns {boolean}
     */
    isAdmin(req) {
        return this.requireRole(req, ['admin', 'super-admin']);
    }

    /**
     * Check if user is super admin
     * @param {Object} req - Express request object
     * @returns {boolean}
     */
    isSuperAdmin(req) {
        return this.requireRole(req, 'super-admin');
    }

    /**
     * Check if user can modify resource
     * @param {Object} req - Express request object
     * @param {string} resourceOwnerId - Resource owner ID
     * @returns {boolean}
     */
    canModifyResource(req, resourceOwnerId) {
        return this.isAdmin(req) || this.requireOwnership(req, resourceOwnerId);
    }

    // ================================
    // ASYNC HANDLER WRAPPER
    // ================================

    /**
     * Wrap async controller methods to catch errors
     * @param {Function} fn - Async controller method
     * @returns {Function} Wrapped function
     */
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Create bound async handler for class methods
     * @param {Function} fn - Async controller method
     * @returns {Function} Wrapped and bound function
     */
    bindAsyncHandler(fn) {
        return this.asyncHandler(fn.bind(this));
    }

    // ================================
    // FILE UPLOAD HELPERS
    // ================================

    /**
     * Handle file upload with validation
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} uploadMiddleware - Multer middleware
     * @param {Object} [options={}] - Validation options
     * @returns {Promise<boolean>}
     */
    async handleFileUpload(req, res, uploadMiddleware, options = {}) {
        return new Promise((resolve, reject) => {
            uploadMiddleware(req, res, (error) => {
                if (error) {
                    this.sendBadRequest(res, error.message);
                    return resolve(false);
                }

                if (req.file) {
                    const validation = this.validateFileUpload(req.file, options);
                    if (!validation.valid) {
                        this.sendBadRequest(res, validation.error);
                        return resolve(false);
                    }
                }

                resolve(true);
            });
        });
    }

    /**
     * Clean up uploaded file on error
     * @param {string} filePath - File path to delete
     */
    async cleanupFailedUpload(filePath) {
        try {
            const fs = await import('fs/promises');
            await fs.unlink(filePath);
        } catch (error) {
            console.error('Failed to cleanup file:', error);
        }
    }

    // ================================
    // UTILITY METHODS
    // ================================

    /**
     * Sanitize user object (remove sensitive fields)
     * @param {Object} user - User object
     * @returns {Object} Sanitized user
     */
    sanitizeUser(user) {
        if (!user) return null;

        const sanitized = user.toObject ? user.toObject() : { ...user };
        delete sanitized.password;
        delete sanitized.__v;
        delete sanitized.loginAttempts;
        delete sanitized.lockedUntil;

        return sanitized;
    }

    /**
     * Log controller action
     * @param {string} action - Action name
     * @param {Object} [metadata={}] - Additional metadata
     */
    log(action, metadata = {}) {
        console.log(`[${this.controllerName}] ${action}`, metadata);
    }
}

export default BaseController;
```

This BaseController provides a solid foundation for all controllers with consistent patterns for response handling, validation, authorization, and utility methods. All specific controllers will extend this base class.