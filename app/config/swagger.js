#!/usr/bin/env node
/**
 * Swagger Configuration
 * 
 * OpenAPI 3.0 configuration for the ITFY E-Voting System API
 */

import swaggerJSDoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ITFY E-Voting System API',
            version: '1.0.0',
            description: 'Comprehensive API documentation for the ITFY E-Voting Platform backend system',
            contact: {
                name: 'John Ametepe Agboku',
                email: 'support@itfy.com'
            },
            license: {
                name: 'ISC',
                url: 'https://opensource.org/licenses/ISC'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Development server'
            },
            {
                url: 'https://api.itfy.com/api/v1',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from login endpoint'
                }
            },
            schemas: {
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        message: {
                            type: 'string',
                            example: 'Operation completed successfully'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-08-05T10:30:00.000Z'
                        },
                        data: {
                            type: 'object',
                            description: 'Response data (varies by endpoint)'
                        }
                    },
                    required: ['success', 'message', 'timestamp']
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            example: 'Operation failed'
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-08-05T10:30:00.000Z'
                        },
                        details: {
                            type: 'object',
                            description: 'Additional error details (optional)'
                        }
                    },
                    required: ['success', 'error', 'timestamp']
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        name: {
                            type: 'string',
                            example: 'John Doe'
                        },
                        email: {
                            type: 'string',
                            example: 'john.doe@example.com'
                        },
                        role: {
                            type: 'string',
                            enum: ['user', 'admin', 'super_admin'],
                            example: 'user'
                        }
                    }
                },
                Event: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        title: {
                            type: 'string',
                            example: 'Annual Meeting'
                        },
                        startDate: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-09-01T10:00:00Z'
                        }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ],
        tags: [
            {
                name: 'Authentication',
                description: 'Handles user registration and login functionalities'
            },
            {
                name: 'Events',
                description: 'Manages voting events and related operations'
            },
            {
                name: 'Candidates',
                description: 'Handles candidate management for events'
            },
            {
                name: 'Voting',
                description: 'Manages voting operations and result processing'
            },
            {
                name: 'Payments',
                description: 'Facilitates payment transactions and verifications'
            }
        ]
    },
    apis: ['./app/routes/*.js', './app/controllers/*.js'],
};

const specs = swaggerJSDoc(options);

export default specs;
