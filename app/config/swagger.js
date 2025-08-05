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
                // Base Response Schemas
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
                PaginationInfo: {
                    type: 'object',
                    properties: {
                        page: {
                            type: 'integer',
                            example: 1
                        },
                        limit: {
                            type: 'integer',
                            example: 20
                        },
                        total: {
                            type: 'integer',
                            example: 100
                        },
                        totalPages: {
                            type: 'integer',
                            example: 5
                        },
                        hasNext: {
                            type: 'boolean',
                            example: true
                        },
                        hasPrev: {
                            type: 'boolean',
                            example: false
                        }
                    }
                },
                // Entity Schemas
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
                            format: 'email',
                            example: 'john.doe@example.com'
                        },
                        role: {
                            type: 'string',
                            enum: ['user', 'admin', 'super_admin'],
                            example: 'user'
                        },
                        level: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 4,
                            example: 1
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
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
                            example: 'Student Union Elections 2025'
                        },
                        description: {
                            type: 'string',
                            example: 'Annual student union elections'
                        },
                        startDate: {
                            type: 'string',
                            format: 'date-time'
                        },
                        endDate: {
                            type: 'string',
                            format: 'date-time'
                        },
                        status: {
                            type: 'string',
                            enum: ['draft', 'active', 'completed', 'cancelled'],
                            example: 'active'
                        },
                        votingFee: {
                            type: 'number',
                            example: 500
                        },
                        createdBy: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Category: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        name: {
                            type: 'string',
                            example: 'President'
                        },
                        description: {
                            type: 'string',
                            example: 'Presidential position'
                        },
                        eventId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        order: {
                            type: 'integer',
                            example: 1
                        },
                        maxVotes: {
                            type: 'integer',
                            example: 1
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Candidate: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        name: {
                            type: 'string',
                            example: 'Jane Smith'
                        },
                        description: {
                            type: 'string',
                            example: 'Experienced leader with vision for change'
                        },
                        eventId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        categoryId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        imageUrl: {
                            type: 'string',
                            example: 'https://example.com/candidate-image.jpg'
                        },
                        order: {
                            type: 'integer',
                            example: 1
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        voteCount: {
                            type: 'integer',
                            example: 150
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Payment: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        reference: {
                            type: 'string',
                            example: 'PAY_1234567890'
                        },
                        amount: {
                            type: 'number',
                            example: 500
                        },
                        currency: {
                            type: 'string',
                            example: 'NGN'
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'success', 'failed', 'cancelled'],
                            example: 'success'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com'
                        },
                        eventId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        categoryId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        userId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        gateway: {
                            type: 'string',
                            example: 'paystack'
                        },
                        gatewayResponse: {
                            type: 'object',
                            description: 'Payment gateway response data'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Vote: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        eventId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        categoryId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        candidateId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        userId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        paymentReference: {
                            type: 'string',
                            example: 'PAY_1234567890'
                        },
                        voteHash: {
                            type: 'string',
                            example: 'abc123def456...'
                        },
                        isVerified: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Form: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        title: {
                            type: 'string',
                            example: 'Voter Registration Form'
                        },
                        description: {
                            type: 'string',
                            example: 'Form for voter registration'
                        },
                        model: {
                            type: 'string',
                            example: 'User'
                        },
                        modelId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        fields: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    type: { type: 'string' },
                                    label: { type: 'string' },
                                    required: { type: 'boolean' },
                                    options: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                File: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        filename: {
                            type: 'string',
                            example: 'document.pdf'
                        },
                        originalName: {
                            type: 'string',
                            example: 'original_document.pdf'
                        },
                        mimeType: {
                            type: 'string',
                            example: 'application/pdf'
                        },
                        size: {
                            type: 'integer',
                            example: 1024000
                        },
                        path: {
                            type: 'string',
                            example: '/uploads/documents/document.pdf'
                        },
                        url: {
                            type: 'string',
                            example: 'https://example.com/files/document.pdf'
                        },
                        entityType: {
                            type: 'string',
                            example: 'candidate'
                        },
                        entityId: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        uploadedBy: {
                            type: 'string',
                            example: '64f8a1b2c3d4e5f6789012ab'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
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
                description: 'User authentication and authorization endpoints'
            },
            {
                name: 'Events',
                description: 'Event management operations'
            },
            {
                name: 'Categories',
                description: 'Category management operations'
            },
            {
                name: 'Candidates',
                description: 'Candidate management operations'
            },
            {
                name: 'Voting',
                description: 'Voting operations and results'
            },
            {
                name: 'Payments',
                description: 'Payment processing and verification'
            },
            {
                name: 'Forms',
                description: 'Dynamic form management'
            },
            {
                name: 'Files',
                description: 'File upload and management'
            },
            {
                name: 'Users',
                description: 'User management operations'
            },
            {
                name: 'Cache',
                description: 'Cache management operations'
            },
            {
                name: 'Activities',
                description: 'Activity logging and audit operations'
            }
        ]
    },
    apis: [
        './app/routes/*.js',
        './app/controllers/*.js'
    ]
};

const specs = swaggerJSDoc(options);

export default specs;
