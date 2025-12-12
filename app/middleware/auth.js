/**
 * Authentication & Authorization Middleware
 * 
 * Comprehensive middleware system for ITFY E-Voting platform with:
 * - JWT token verification with blacklist checking
 * - Role-based access control (RBAC)
 * - Level-based permissions
 * - Rate limiting per user/IP
 * - Session management
 * - Multi-device support
 * - Candidate-specific authentication
 * 
 * @module middlewares/auth
 * @version 2.0.0
 */

import jwt from 'jsonwebtoken';
import config from '../config/ConfigManager.js';
import AuthHelpers from '../utils/authHelpers.js';
import { userRepository } from '../repositories/index.js';
import { candidateRepository } from '../repositories/index.js';

// ========================================
// CORE AUTHENTICATION MIDDLEWARE
// ========================================

/**
 * Verify JWT token and attach user to request
 * @middleware
 */
export const authenticate = async (req, res, next) => {
    try {
        // Extract token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        let decoded;
        try {
            decoded = AuthHelpers.verifyToken(token);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: error.message
            });
        }

        // Check if token is blacklisted
        const isBlacklisted = await AuthHelpers.isTokenBlacklisted(token);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                error: 'Token revoked',
                message: 'This token has been invalidated'
            });
        }

        // Check if all user tokens are blacklisted (password change, security breach)
        const allTokensBlacklisted = await AuthHelpers.areUserTokensBlacklisted(
            decoded.sub,
            decoded.iat
        );
        
        if (allTokensBlacklisted) {
            return res.status(401).json({
                success: false,
                error: 'Token revoked',
                message: 'Please login again'
            });
        }

        // Determine if this is a user or candidate token
        const isCandidate = !!decoded.cId || !!decoded.candidateId;

        // Fetch user/candidate from database
        let entity;
        if (isCandidate) {
            entity = await candidateRepository.findById(decoded.sub);
            
            if (!entity) {
                return res.status(401).json({
                    success: false,
                    error: 'Candidate not found',
                    message: 'The candidate associated with this token no longer exists'
                });
            }

            // Check if candidate is approved
            if (entity.status !== 'approved') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'Candidate account not approved'
                });
            }

            // Attach candidate to request
            req.candidate = entity;
            req.candidateId = entity._id.toString();
            req.eventId = entity.eventId?.toString();
            req.userType = 'candidate';
        } else {
            entity = await userRepository.findById(decoded.sub);
            
            if (!entity) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found',
                    message: 'The user associated with this token no longer exists'
                });
            }

            // Check if user is active
            if (!entity.active || entity.status === 'banned' || entity.status === 'suspended') {
                return res.status(403).json({
                    success: false,
                    error: 'Account disabled',
                    message: `Your account is ${entity.status || 'inactive'}`
                });
            }

            // Attach user to request
            req.user = entity;
            req.userId = entity._id.toString();
            req.userLevel = entity.level || 1;
            req.userRole = entity.role || 'voter';
            req.userType = 'user';
        }

        // Attach token info
        req.token = token;
        req.tokenPayload = decoded;

        next();
    } catch (error) {
        console.error('[Auth Middleware] Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
            message: 'An error occurred during authentication'
        });
    }
};

/**
 * Optional authentication - attach user if token exists, but don't require it
 * @middleware
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without user
        return next();
    }

    // Token provided, try to authenticate
    return authenticate(req, res, next);
};

// ========================================
// ROLE-BASED ACCESS CONTROL
// ========================================

/**
 * Require specific user role(s)
 * @param {...string} allowedRoles - Roles that can access this endpoint
 * @middleware
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please login to access this resource'
            });
        }

        const userRole = req.userRole || req.user.role;

        // Super-admin has access to everything
        if (userRole === 'super-admin') {
            return next();
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
                message: `This endpoint requires one of: ${allowedRoles.join(', ')}`,
                requiredRoles: allowedRoles,
                userRole
            });
        }

        next();
    };
};

/**
 * Require minimum user level (1-4)
 * @param {number} minLevel - Minimum required level
 * @middleware
 */
export const requireLevel = (minLevel) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please login to access this resource'
            });
        }

        const userLevel = req.userLevel || req.user.level || 1;

        if (userLevel < minLevel) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `This endpoint requires level ${minLevel} or higher`,
                requiredLevel: minLevel,
                userLevel
            });
        }

        next();
    };
};

/**
 * Require admin access (level 3+)
 * @middleware
 */
export const requireAdmin = requireLevel(3);

/**
 * Require super-admin access (level 4)
 * @middleware
 */
export const requireSuperAdmin = requireLevel(4);

/**
 * Require organizer access (level 2+)
 * @middleware
 */
export const requireOrganizer = requireLevel(2);

// ========================================
// EMAIL VERIFICATION CHECK
// ========================================

/**
 * Require email verification
 * @middleware
 */
export const requireVerifiedEmail = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (!req.user.emailVerified) {
        return res.status(403).json({
            success: false,
            error: 'Email verification required',
            message: 'Please verify your email address to access this resource'
        });
    }

    next();
};

// ========================================
// CANDIDATE-SPECIFIC MIDDLEWARE
// ========================================

/**
 * Require candidate authentication
 * @middleware
 */
export const requireCandidate = (req, res, next) => {
    if (!req.candidate) {
        return res.status(401).json({
            success: false,
            error: 'Candidate authentication required',
            message: 'This endpoint is only accessible to candidates'
        });
    }

    next();
};

/**
 * Require candidate to be approved
 * @middleware
 */
export const requireApprovedCandidate = (req, res, next) => {
    if (!req.candidate) {
        return res.status(401).json({
            success: false,
            error: 'Candidate authentication required'
        });
    }

    if (req.candidate.status !== 'approved') {
        return res.status(403).json({
            success: false,
            error: 'Candidate not approved',
            message: 'Your candidate profile must be approved to access this resource',
            candidateStatus: req.candidate.status
        });
    }

    next();
};

/**
 * Check if candidate belongs to specific event
 * @middleware
 */
export const requireCandidateEvent = (req, res, next) => {
    if (!req.candidate) {
        return res.status(401).json({
            success: false,
            error: 'Candidate authentication required'
        });
    }

    const eventId = req.params.eventId || req.body.eventId || req.query.eventId;

    if (!eventId) {
        return res.status(400).json({
            success: false,
            error: 'Event ID required'
        });
    }

    if (req.candidate.eventId?.toString() !== eventId.toString()) {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'You are not a candidate in this event'
        });
    }

    next();
};

// ========================================
// OWNERSHIP & PERMISSION CHECKS
// ========================================

/**
 * Check if user owns the resource or is admin
 * @param {string} resourceIdField - Field name in req.params containing resource ID
 * @param {string} ownerField - Field name in resource containing owner ID
 * @middleware
 */
export const requireOwnershipOrAdmin = (resourceIdField = 'id', ownerField = 'createdBy') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const userId = req.userId || req.user._id.toString();
        const userLevel = req.userLevel || req.user.level || 1;

        // Admin bypass
        if (userLevel >= 3) {
            return next();
        }

        // Check ownership
        const resourceId = req.params[resourceIdField];
        
        if (!resourceId) {
            return res.status(400).json({
                success: false,
                error: 'Resource ID required'
            });
        }

        // The actual ownership check needs to be done in the controller
        // This middleware just sets up the context
        req.requiresOwnershipCheck = {
            resourceId,
            ownerField,
            userId
        };

        next();
    };
};

/**
 * Check if user can modify resource (owner or higher level admin)
 * @middleware
 */
export const canModifyResource = (resourceType) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const userLevel = req.userLevel || req.user.level || 1;

        // Level requirements for different resource types
        const levelRequirements = {
            'event': 2,      // Organizer
            'candidate': 2,  // Organizer
            'user': 3,       // Admin
            'payment': 3,    // Admin
            'settings': 4    // Super Admin
        };

        const requiredLevel = levelRequirements[resourceType] || 2;

        if (userLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `Modifying ${resourceType} requires level ${requiredLevel} or higher`,
                userLevel,
                requiredLevel
            });
        }

        next();
    };
};

// ========================================
// FEATURE FLAGS & PERMISSIONS
// ========================================

/**
 * Check if feature is enabled for user
 * @param {string} featureName - Feature name to check
 * @middleware
 */
export const requireFeature = (featureName) => {
    return async (req, res, next) => {
        // Get feature flags from settings or user permissions
        const features = req.user?.features || {};

        if (!features[featureName]) {
            return res.status(403).json({
                success: false,
                error: 'Feature not available',
                message: `The ${featureName} feature is not enabled for your account`
            });
        }

        next();
    };
};

/**
 * Check specific permission
 * @param {string} permission - Permission name
 * @middleware
 */
export const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const permissions = req.user.permissions || getDefaultPermissions(req.userRole);

        // Super-admin has all permissions
        if (permissions.includes('*')) {
            return next();
        }

        if (!permissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                message: `This action requires the '${permission}' permission`,
                requiredPermission: permission,
                userPermissions: permissions
            });
        }

        next();
    };
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get default permissions based on role
 * @private
 */
function getDefaultPermissions(role) {
    const permissions = {
        'voter': ['vote', 'view_events', 'view_results'],
        'organizer': ['vote', 'view_events', 'view_results', 'create_event', 'manage_candidates'],
        'admin': ['vote', 'view_events', 'view_results', 'create_event', 'manage_candidates', 'manage_users', 'view_analytics'],
        'super-admin': ['*']
    };

    return permissions[role] || permissions['voter'];
}

/**
 * Extract user info for logging
 */
export const extractUserInfo = (req) => {
    if (req.candidate) {
        return {
            type: 'candidate',
            id: req.candidateId,
            email: req.candidate.email,
            name: req.candidate.name,
            eventId: req.eventId
        };
    }

    if (req.user) {
        return {
            type: 'user',
            id: req.userId,
            email: req.user.email,
            name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
            role: req.userRole,
            level: req.userLevel
        };
    }

    return null;
};

// ========================================
// COMBINED MIDDLEWARE CHAINS
// ========================================

/**
 * Authenticated user with verified email
 */
export const authenticatedVerified = [authenticate, requireVerifiedEmail];

/**
 * Admin access chain
 */
export const adminAccess = [authenticate, requireAdmin];

/**
 * Super-admin access chain
 */
export const superAdminAccess = [authenticate, requireSuperAdmin];

/**
 * Organizer access chain
 */
export const organizerAccess = [authenticate, requireOrganizer];

/**
 * Approved candidate access chain
 */
export const approvedCandidateAccess = [authenticate, requireCandidate, requireApprovedCandidate];

/**
 * Event organizer check
 */
export const eventOrganizerAccess = [authenticate, requireOrganizer, canModifyResource('event')];

// ========================================
// EXPORT ALL MIDDLEWARE
// ========================================

export default {
    // Core authentication
    authenticate,
    optionalAuth,
    
    // Role-based
    requireRole,
    requireLevel,
    requireAdmin,
    requireSuperAdmin,
    requireOrganizer,
    
    // Email verification
    requireVerifiedEmail,
    
    // Candidate-specific
    requireCandidate,
    requireApprovedCandidate,
    requireCandidateEvent,
    
    // Ownership & permissions
    requireOwnershipOrAdmin,
    canModifyResource,
    requireFeature,
    requirePermission,
    
    // Utility
    extractUserInfo,
    
    // Combined chains
    authenticatedVerified,
    adminAccess,
    superAdminAccess,
    organizerAccess,
    approvedCandidateAccess,
    eventOrganizerAccess
};