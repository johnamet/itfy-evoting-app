#!/usr/bin/env node
/**
 * Security Middleware
 * 
 * Provides security-related middleware functions
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';

class SecurityMiddleware {
    /**
     * Configure CORS middleware
     * @param {Object} options - CORS configuration options
     * @returns {Function} CORS middleware
     */
    static cors(options = {}) {
        const defaultOptions = {
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['X-Total-Count', 'X-Page-Count']
        };

        return cors({ ...defaultOptions, ...options });
    }

    /**
     * Configure Helmet security middleware
     * @param {Object} options - Helmet configuration options
     * @returns {Function} Helmet middleware
     */
    static helmet(options = {}) {
        const defaultOptions = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: false
        };

        return helmet({ ...defaultOptions, ...options });
    }

    /**
     * Rate limiting middleware
     * @param {Object} options - Rate limit options
     * @returns {Function} Rate limit middleware
     */
    static rateLimit(options = {}) {
        const defaultOptions = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per windowMs
            message: {
                success: false,
                error: 'Too many requests, please try again later',
                timestamp: new Date().toISOString()
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfter: Math.round(options.windowMs / 1000) || 900,
                    timestamp: new Date().toISOString()
                });
            }
        };

        return rateLimit({ ...defaultOptions, ...options });
    }

    /**
     * Strict rate limiting for authentication endpoints
     * @returns {Function} Rate limit middleware
     */
    static authRateLimit() {
        return this.rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            skipSuccessfulRequests: true,
            message: {
                success: false,
                error: 'Too many authentication attempts, please try again later',
                timestamp: new Date().toISOString()
            }
        });
    }

    /**
     * Input sanitization middleware
     * @returns {Function} Sanitization middleware
     */
    static sanitizeInput() {
        return (req, res, next) => {
            // Sanitize request body
            if (req.body && typeof req.body === 'object') {
                req.body = this._sanitizeObject(req.body);
            }

            // Sanitize query parameters
            if (req.query && typeof req.query === 'object') {
                req.query = this._sanitizeObject(req.query);
            }

            next();
        };
    }

    /**
     * Recursively sanitize object properties
     * @param {Object} obj - Object to sanitize
     * @returns {Object} Sanitized object
     * @private
     */
    static _sanitizeObject(obj) {
        const sanitized = {};

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Remove potentially dangerous characters
                sanitized[key] = value
                    .replace(/<script[^>]*>.*?<\/script>/gi, '')
                    .replace(/<[^>]*>/g, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .trim();
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                sanitized[key] = this._sanitizeObject(value);
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => 
                    typeof item === 'object' && item !== null ? this._sanitizeObject(item) : item
                );
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Security headers middleware
     * @returns {Function} Security headers middleware
     */
    static securityHeaders() {
        return (req, res, next) => {
            // Remove server information
            res.removeHeader('X-Powered-By');
            
            // Add security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
            res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
            
            next();
        };
    }

    /**
     * Request ID middleware for tracing
     * @returns {Function} Request ID middleware
     */
    static requestId() {
        return (req, res, next) => {
            const requestId = req.headers['x-request-id'] || 
                             `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            req.requestId = requestId;
            res.setHeader('X-Request-ID', requestId);
            
            next();
        };
    }

    /**
     * Content length limiting middleware
     * @param {Number} maxSize - Maximum content length in bytes
     * @returns {Function} Content length middleware
     */
    static contentLengthLimit(maxSize = 10 * 1024 * 1024) { // 10MB default
        return (req, res, next) => {
            const contentLength = parseInt(req.headers['content-length'] || '0');
            
            if (contentLength > maxSize) {
                return res.status(413).json({
                    success: false,
                    error: 'Request entity too large',
                    maxSize: `${Math.round(maxSize / 1024 / 1024)}MB`,
                    timestamp: new Date().toISOString()
                });
            }
            
            next();
        };
    }
}

export default SecurityMiddleware;
