#!/usr/bin/env node
/**
 * Validation Middleware
 * 
 * Provides request validation middleware using Joi schemas
 */

import Joi from 'joi';

class ValidationMiddleware {
    /**
     * Create validation middleware for request body
     * @param {Object} schema - Joi validation schema
     * @returns {Function} Express middleware function
     */
    static validateBody(schema) {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.body, {
                abortEarly: false,
                stripUnknown: true
            });

            if (error) {
                const validationErrors = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }));

                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: validationErrors,
                    timestamp: new Date().toISOString()
                });
            }

            req.body = value;
            next();
        };
    }

    /**
     * Create validation middleware for request parameters
     * @param {Object} schema - Joi validation schema
     * @returns {Function} Express middleware function
     */
    static validateParams(schema) {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.params, {
                abortEarly: false
            });

            if (error) {
                const validationErrors = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }));

                return res.status(400).json({
                    success: false,
                    error: 'Parameter validation failed',
                    details: validationErrors,
                    timestamp: new Date().toISOString()
                });
            }

            req.params = value;
            next();
        };
    }

    /**
     * Create validation middleware for query parameters
     * @param {Object} schema - Joi validation schema
     * @returns {Function} Express middleware function
     */
    static validateQuery(schema) {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.query, {
                abortEarly: false,
                stripUnknown: true
            });

            if (error) {
                const validationErrors = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }));

                return res.status(400).json({
                    success: false,
                    error: 'Query validation failed',
                    details: validationErrors,
                    timestamp: new Date().toISOString()
                });
            }

            req.query = value;
            next();
        };
    }

    /**
     * Common validation schemas
     */
    static get schemas() {
        return {
            // MongoDB ObjectId validation
            objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
            
            // Pagination parameters
            pagination: Joi.object({
                page: Joi.number().integer().min(1).default(1),
                limit: Joi.number().integer().min(1).max(100).default(10),
                sort: Joi.string().default('createdAt'),
                order: Joi.string().valid('asc', 'desc').default('desc')
            }),

            // Common field types
            email: Joi.string().email().required(),
            password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
            phone: Joi.string().pattern(/^[\+]?[(]?[\+]?\d{3}[)]?[-\s\.]?\d{3}[-\s\.]?\d{4,6}$/),
            url: Joi.string().uri(),
            
            // User-related schemas
            createUser: Joi.object({
                name: Joi.string().min(2).max(100).required(),
                email: Joi.string().email().required(),
                password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
                phone: Joi.string().pattern(/^[\+]?[(]?[\+]?\d{3}[)]?[-\s\.]?\d{3}[-\s\.]?\d{4,6}$/).optional(),
                role: Joi.string().valid('user', 'admin', 'superuser').default('user')
            }),

            updateUser: Joi.object({
                name: Joi.string().min(2).max(100).optional(),
                email: Joi.string().email().optional(),
                phone: Joi.string().pattern(/^[\+]?[(]?[\+]?\d{3}[)]?[-\s\.]?\d{3}[-\s\.]?\d{4,6}$/).optional(),
                role: Joi.string().valid('user', 'admin', 'superuser').optional()
            }),

            // Event-related schemas
            createEvent: Joi.object({
                name: Joi.string().min(3).max(200).required(),
                description: Joi.string().min(10).max(1000).required(),
                startDate: Joi.date().iso().required(),
                endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
                isActive: Joi.boolean().default(true),
                maxParticipants: Joi.number().integer().min(1).optional(),
                tags: Joi.array().items(Joi.string()).optional()
            }),

            // Category-related schemas
            createCategory: Joi.object({
                name: Joi.string().min(2).max(100).required(),
                description: Joi.string().max(500).optional(),
                eventId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
                isActive: Joi.boolean().default(true)
            }),

            // Candidate-related schemas
            createCandidate: Joi.object({
                name: Joi.string().min(2).max(100).required(),
                description: Joi.string().max(1000).optional(),
                eventId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
                categoryId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
                imageUrl: Joi.string().uri().optional(),
                isActive: Joi.boolean().default(true)
            }),

            // Voting-related schemas
            castVote: Joi.object({
                eventId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
                candidateId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
                categoryId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
            })
        };
    }
}

export default ValidationMiddleware;
