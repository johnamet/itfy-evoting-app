#!/usr/bin/env node
/**
 * Authentication Middleware
 * 
 * Handles user authentication and authorization for protected routes.
 * Implements JWT-based authentication with proper error handling.
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// JWT configuration from environment variables
const JWT_CONFIG = {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    issuer: process.env.JWT_ISSUER || 'itfy-evoting-app',
    audience: process.env.JWT_AUDIENCE || 'itfy-evoting-users',
    algorithms: ['HS256'],
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
};

/**
 * Verify JWT token and extract user information
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded user information or null if invalid
 */
const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_CONFIG.secret, {
            algorithms: JWT_CONFIG.algorithms,
            issuer: JWT_CONFIG.issuer,
            audience: JWT_CONFIG.audience
        });

        // Ensure required claims are present
        if (!decoded.sub && !decoded.userId && !decoded.id) {
            throw new Error('Token missing user identifier');
        }

        return {
            id: decoded.sub || decoded.userId || decoded.id,
            email: decoded.email,
            role: decoded.role || 'user',
            roleLevel: decoded.roleLevel || 0, // Default to lowest level
            ...decoded
        };
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return null;
    }
};

/**
 * Main authentication middleware
 * Requires valid JWT token for access
 */
export const authenticate = (req, res, next) => {
    try {
        // Development mode - allow header-based user ID for testing
        if (process.env.NODE_ENV === 'development') {
            const devUserId = req.headers['x-dev-user-id'];
            const devUserLevel = parseInt(req.headers['x-dev-user-level']) || 4; // Default to max level in dev
            if (devUserId) {
                req.user = { 
                    id: devUserId, 
                    role: 'admin', 
                    roleLevel: devUserLevel,
                    email: `${devUserId}@dev.local`
                };
                req.userId = devUserId;
                return next();
            }
        }

        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please provide a valid Bearer token'
            });
        }

        const token = authHeader.substring(7);
        const user = verifyToken(token);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                message: 'Please provide a valid authentication token'
            });
        }

        // Attach user information to request
        req.user = user;
        req.userId = user.id;
        
        next();

    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication error',
            message: 'An error occurred during authentication'
        });
    }
};

/**
 * Optional authentication middleware
 * Allows both authenticated and unauthenticated requests
 */
export const optionalAuth = (req, res, next) => {
    try {
        // Development mode - allow header-based user ID for testing
        if (process.env.NODE_ENV === 'development') {
            const devUserId = req.headers['x-dev-user-id'];
            if (devUserId) {
                req.user = { 
                    id: devUserId, 
                    role: 'admin', 
                    roleLevel: 1000, // Highest level for admin in dev mode
                    email: `${devUserId}@dev.local`
                };
                req.userId = devUserId;
            }
        }

        // Try to extract and verify token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = verifyToken(token);
            
            if (user) {
                req.user = user;
                req.userId = user.id;
            }
        }
        
        // Continue regardless of authentication status
        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next(); // Continue even if there's an error
    }
};

/**
 * Level-based authorization middleware factory
 * @param {number} requiredLevel - Minimum required level (1-4)
 * @param {string} operation - Operation type ('create', 'read', 'update', 'delete')
 */
export const requireLevel = (requiredLevel, operation = 'read') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please authenticate to access this resource'
            });
        }

        const userLevel = req.user.roleLevel || 1; // Default to level 1 (read only)
        
        // Check if user level meets the required level
        if (userLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `This action requires level ${requiredLevel} permissions or higher. Your level: ${userLevel}`
            });
        }

        // Check if the user can perform the specific operation based on their level
        const canPerform = checkOperationPermission(userLevel, operation);
        if (!canPerform) {
            return res.status(403).json({
                success: false,
                error: 'Operation not allowed',
                message: `Your permission level (${userLevel}) does not allow '${operation}' operations`
            });
        }

        next();
    };
};

/**
 * Role-based authorization middleware factory (for backward compatibility)
 * @param {Array} requiredRoles - Array of required roles
 */
export const authorize = (requiredRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please authenticate to access this resource'
            });
        }

        if (requiredRoles.length === 0) {
            return next(); // No specific roles required
        }

        const userRole = req.user.role || 'user';
        const userLevel = req.user.roleLevel || 1;
        
        // Check if user has required role or sufficient level
        const hasRequiredRole = requiredRoles.includes(userRole) || 
                               userRole === 'admin' ||
                               userLevel >= 4; // Level 4 has all permissions
        
        if (!hasRequiredRole) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Check if a user level can perform a specific operation
 * @param {number} userLevel - User's permission level (1-4)
 * @param {string} operation - Operation type ('create', 'read', 'update', 'delete')
 * @returns {boolean} Whether the operation is allowed
 */
const checkOperationPermission = (userLevel, operation) => {
    // Level 1: Read only
    if (userLevel === 1) {
        return operation === 'read';
    }
    
    // Level 2: Read and Update
    if (userLevel === 2) {
        return ['read', 'update'].includes(operation);
    }
    
    // Level 3: Create, Read, Update
    if (userLevel === 3) {
        return ['create', 'read', 'update'].includes(operation);
    }
    
    // Level 4: Create, Read, Update, Delete (all operations)
    if (userLevel >= 4) {
        return true;
    }
    
    return false;
};

/**
 * Operation-specific middleware factories
 */
export const requireCreate = (minLevel = 3) => requireLevel(minLevel, 'create');
export const requireRead = (minLevel = 1) => requireLevel(minLevel, 'read');
export const requireUpdate = (minLevel = 2) => requireLevel(minLevel, 'update');
export const requireDelete = (minLevel = 4) => requireLevel(minLevel, 'delete');

/**
 * Permission-based authorization middleware factory (updated for level-based system)
 * @param {Array} requiredOperations - Array of required operations ('create', 'read', 'update', 'delete')
 * @param {number} minLevel - Minimum level required
 */
export const requireOperations = (requiredOperations = [], minLevel = 1) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please authenticate to access this resource'
            });
        }

        const userLevel = req.user.roleLevel || 1;
        
        // Check minimum level requirement
        if (userLevel < minLevel) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient level',
                message: `This action requires level ${minLevel} or higher. Your level: ${userLevel}`
            });
        }

        // Check if user can perform all required operations
        const canPerformAll = requiredOperations.every(operation => 
            checkOperationPermission(userLevel, operation)
        );
        
        if (!canPerformAll) {
            const disallowedOps = requiredOperations.filter(op => 
                !checkOperationPermission(userLevel, op)
            );
            
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `Your level (${userLevel}) does not allow: ${disallowedOps.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Middleware to verify JWT tokens with custom options
 * @param {Object} options - Configuration options
 * @param {string} [options.secret] - JWT secret (defaults to environment variable)
 * @param {string} [options.issuer] - Expected issuer
 * @param {string} [options.audience] - Expected audience
 * @param {string[]} [options.algorithms] - Allowed algorithms (default: ['HS256'])
 * @returns {Function} Express middleware function
 */
export const verifyJwtToken = (options = {}) => {
    const config = {
        secret: options.secret || JWT_CONFIG.secret,
        issuer: options.issuer || JWT_CONFIG.issuer,
        audience: options.audience || JWT_CONFIG.audience,
        algorithms: options.algorithms || JWT_CONFIG.algorithms,
    };

    return (req, res, next) => {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Expect 'Bearer <token>'

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'No token provided',
            });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, config.secret, {
                algorithms: config.algorithms,
                issuer: config.issuer,
                audience: config.audience,
            });

            // Additional custom validation
            if (!decoded.sub && !decoded.userId && !decoded.id) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    message: 'Token missing user identifier',
                });
            }

            // Attach decoded payload to request for downstream use
            req.user = {
                id: decoded.sub || decoded.userId || decoded.id,
                email: decoded.email,
                role: decoded.role || 'user',
                roleLevel: decoded.roleLevel || 1, // Default to level 1 (read only)
                permissions: decoded.permissions || [],
                ...decoded
            };
            req.userId = req.user.id;

            next();
        } catch (error) {
            // Handle specific JWT errors
            if (error instanceof jwt.TokenExpiredError) {
                return res.status(401).json({
                    success: false,
                    error: 'Token expired',
                    message: `Token expired at ${error.expiredAt}`,
                });
            }
            if (error instanceof jwt.JsonWebTokenError) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token',
                    message: error.message,
                });
            }
            if (error instanceof jwt.NotBeforeError) {
                return res.status(401).json({
                    success: false,
                    error: 'Token not yet valid',
                    message: error.message,
                });
            }

            // Handle unexpected errors
            console.error('JWT verification error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: 'An error occurred during token verification',
            });
        }
    };
};

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @param {Object} options - Token options
 * @returns {string} JWT token
 */
export const generateToken = (user, options = {}) => {
    const payload = {
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
        roleLevel: user.roleLevel || user.level || 1, // Include role level
        permissions: user.permissions || [],
        iss: JWT_CONFIG.issuer,
        aud: JWT_CONFIG.audience,
        iat: Math.floor(Date.now() / 1000),
    };

    const tokenOptions = {
        algorithm: 'HS256',
        expiresIn: options.expiresIn || JWT_CONFIG.expiresIn,
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
    };

    return jwt.sign(payload, JWT_CONFIG.secret, tokenOptions);
};

/**
 * Generate refresh token
 * @param {Object} user - User object
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (user) => {
    const payload = {
        sub: user.id,
        type: 'refresh',
        iss: JWT_CONFIG.issuer,
        aud: JWT_CONFIG.audience,
    };

    return jwt.sign(payload, JWT_CONFIG.secret, {
        algorithm: 'HS256',
        expiresIn: '7d', // Refresh tokens last longer
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience,
    });
};

/**
 * Decode token without verification (for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null
 */
export const decodeToken = (token) => {
    try {
        return jwt.decode(token, { complete: true });
    } catch (error) {
        return null;
    }
};

// Export JWT configuration for use in other modules
export { JWT_CONFIG };

export default {
    authenticate,
    optionalAuth,
    authorize,
    requireLevel,
    requireCreate,
    requireRead,
    requireUpdate,
    requireDelete,
    requireOperations,
    verifyJwtToken,
    generateToken,
    generateRefreshToken,
    decodeToken,
    JWT_CONFIG
};
