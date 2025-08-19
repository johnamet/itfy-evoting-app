/**
 * API Documentation Generator
 * 
 * Generates comprehensive API documentation with examples
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from '../config/ConfigManager.js';

class ApiDocumentation {
    constructor() {
        this.swaggerOptions = {
            definition: {
                openapi: '3.0.0',
                info: {
                    title: config.get('app.name', 'E-Voting API'),
                    version: config.get('app.version', '1.0.0'),
                    description: 'Comprehensive API documentation for the E-Voting application',
                    contact: {
                        name: 'Development Team',
                        email: 'dev@evoting.app'
                    },
                    license: {
                        name: 'MIT',
                        url: 'https://opensource.org/licenses/MIT'
                    }
                },
                servers: [
                    {
                        url: `http://localhost:${config.get('app.port', 3000)}`,
                        description: 'Development server'
                    },
                    {
                        url: 'https://api.evoting.app',
                        description: 'Production server'
                    }
                ],
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            type: 'http',
                            scheme: 'bearer',
                            bearerFormat: 'JWT'
                        },
                        apiKey: {
                            type: 'apiKey',
                            in: 'header',
                            name: 'X-API-Key'
                        }
                    },
                    schemas: {
                        Error: {
                            type: 'object',
                            properties: {
                                success: {
                                    type: 'boolean',
                                    example: false
                                },
                                message: {
                                    type: 'string',
                                    example: 'An error occurred'
                                },
                                error: {
                                    type: 'object',
                                    properties: {
                                        code: {
                                            type: 'string',
                                            example: 'VALIDATION_ERROR'
                                        },
                                        details: {
                                            type: 'object'
                                        }
                                    }
                                },
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time'
                                },
                                requestId: {
                                    type: 'string',
                                    format: 'uuid'
                                }
                            }
                        },
                        Success: {
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
                                data: {
                                    type: 'object'
                                },
                                meta: {
                                    type: 'object',
                                    properties: {
                                        pagination: {
                                            $ref: '#/components/schemas/Pagination'
                                        },
                                        timestamp: {
                                            type: 'string',
                                            format: 'date-time'
                                        },
                                        requestId: {
                                            type: 'string',
                                            format: 'uuid'
                                        }
                                    }
                                }
                            }
                        },
                        Pagination: {
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
                                pages: {
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
                        User: {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    format: 'objectid',
                                    example: '507f1f77bcf86cd799439011'
                                },
                                username: {
                                    type: 'string',
                                    example: 'john_doe'
                                },
                                email: {
                                    type: 'string',
                                    format: 'email',
                                    example: 'john@example.com'
                                },
                                firstName: {
                                    type: 'string',
                                    example: 'John'
                                },
                                lastName: {
                                    type: 'string',
                                    example: 'Doe'
                                },
                                role: {
                                    type: 'string',
                                    enum: ['voter', 'admin', 'moderator'],
                                    example: 'voter'
                                },
                                status: {
                                    type: 'string',
                                    enum: ['active', 'inactive', 'pending'],
                                    example: 'active'
                                },
                                avatar: {
                                    type: 'string',
                                    example: '/uploads/avatars/user123.jpg'
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
                                    format: 'objectid'
                                },
                                title: {
                                    type: 'string',
                                    example: 'Student Council Elections 2024'
                                },
                                description: {
                                    type: 'string',
                                    example: 'Annual elections for student council positions'
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
                                categories: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/Category'
                                    }
                                },
                                settings: {
                                    type: 'object',
                                    properties: {
                                        allowMultipleVotes: {
                                            type: 'boolean'
                                        },
                                        requirePayment: {
                                            type: 'boolean'
                                        },
                                        paymentAmount: {
                                            type: 'number'
                                        }
                                    }
                                },
                                createdBy: {
                                    type: 'string',
                                    format: 'objectid'
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
                                    format: 'objectid'
                                },
                                name: {
                                    type: 'string',
                                    example: 'President'
                                },
                                description: {
                                    type: 'string',
                                    example: 'Student Council President position'
                                },
                                candidates: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/Candidate'
                                    }
                                },
                                maxVotes: {
                                    type: 'integer',
                                    example: 1
                                },
                                eventId: {
                                    type: 'string',
                                    format: 'objectid'
                                }
                            }
                        },
                        Candidate: {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                name: {
                                    type: 'string',
                                    example: 'Jane Smith'
                                },
                                description: {
                                    type: 'string',
                                    example: 'Experienced leader with vision for change'
                                },
                                image: {
                                    type: 'string',
                                    example: '/uploads/candidates/jane_smith.jpg'
                                },
                                voteCount: {
                                    type: 'integer',
                                    example: 42
                                },
                                categoryId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                eventId: {
                                    type: 'string',
                                    format: 'objectid'
                                }
                            }
                        },
                        Vote: {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                candidateId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                categoryId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                eventId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                voterId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time'
                                },
                                paymentId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                metadata: {
                                    type: 'object'
                                }
                            }
                        },
                        Payment: {
                            type: 'object',
                            properties: {
                                _id: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                amount: {
                                    type: 'number',
                                    example: 10.00
                                },
                                currency: {
                                    type: 'string',
                                    example: 'USD'
                                },
                                status: {
                                    type: 'string',
                                    enum: ['pending', 'completed', 'failed', 'refunded'],
                                    example: 'completed'
                                },
                                paymentMethod: {
                                    type: 'string',
                                    example: 'credit_card'
                                },
                                transactionId: {
                                    type: 'string',
                                    example: 'txn_1234567890'
                                },
                                userId: {
                                    type: 'string',
                                    format: 'objectid'
                                },
                                eventId: {
                                    type: 'string',
                                    format: 'objectid'
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
                        description: 'User authentication and authorization'
                    },
                    {
                        name: 'Users',
                        description: 'User management operations'
                    },
                    {
                        name: 'Events',
                        description: 'Voting event management'
                    },
                    {
                        name: 'Voting',
                        description: 'Vote casting and management'
                    },
                    {
                        name: 'Candidates',
                        description: 'Candidate management'
                    },
                    {
                        name: 'Categories',
                        description: 'Voting category management'
                    },
                    {
                        name: 'Payments',
                        description: 'Payment processing'
                    },
                    {
                        name: 'Analytics',
                        description: 'Analytics and reporting'
                    },
                    {
                        name: 'Health',
                        description: 'Health monitoring and status'
                    },
                    {
                        name: 'Admin',
                        description: 'Administrative operations'
                    }
                ]
            },
            apis: [
                './app/routes/*.js',
                './app/controllers/*.js'
            ]
        };

        this.specs = swaggerJsdoc(this.swaggerOptions);
    }

    /**
     * Get Swagger UI middleware
     * @returns {Array} Swagger UI middleware
     */
    getSwaggerMiddleware() {
        const customCss = `
            .swagger-ui .topbar { 
                background-color: #2c5aa0; 
            }
            .swagger-ui .info .title {
                color: #2c5aa0;
            }
            .swagger-ui .scheme-container {
                background: #f7f7f7;
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
            }
        `;

        const options = {
            customCss,
            customSiteTitle: 'E-Voting API Documentation',
            customfavIcon: '/favicon.ico',
            swaggerOptions: {
                persistAuthorization: true,
                displayRequestDuration: true,
                docExpansion: 'list',
                filter: true,
                tryItOutEnabled: true
            }
        };

        return [
            swaggerUi.serve,
            swaggerUi.setup(this.specs, options)
        ];
    }

    /**
     * Get OpenAPI specifications
     * @returns {Object} OpenAPI specs
     */
    getSpecs() {
        return this.specs;
    }

    /**
     * Generate API examples
     * @returns {Object} API usage examples
     */
    generateExamples() {
        return {
            authentication: {
                login: {
                    method: 'POST',
                    url: '/api/auth/login',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: {
                        email: 'user@example.com',
                        password: 'password123'
                    },
                    response: {
                        success: true,
                        message: 'Login successful',
                        data: {
                            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                            refreshToken: 'refresh_token_here',
                            user: {
                                _id: '507f1f77bcf86cd799439011',
                                username: 'john_doe',
                                email: 'user@example.com',
                                role: 'voter'
                            }
                        }
                    }
                },
                register: {
                    method: 'POST',
                    url: '/api/auth/register',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: {
                        username: 'new_user',
                        email: 'newuser@example.com',
                        password: 'password123',
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                }
            },
            voting: {
                castVote: {
                    method: 'POST',
                    url: '/api/voting/cast',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    },
                    body: {
                        candidateId: '507f1f77bcf86cd799439012',
                        categoryId: '507f1f77bcf86cd799439013',
                        eventId: '507f1f77bcf86cd799439014'
                    }
                },
                getResults: {
                    method: 'GET',
                    url: '/api/events/507f1f77bcf86cd799439014/results',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    }
                }
            },
            events: {
                list: {
                    method: 'GET',
                    url: '/api/events?page=1&limit=20&status=active',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    }
                },
                create: {
                    method: 'POST',
                    url: '/api/events',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    },
                    body: {
                        title: 'Student Council Elections 2024',
                        description: 'Annual elections for student council positions',
                        startDate: '2024-03-01T00:00:00Z',
                        endDate: '2024-03-07T23:59:59Z',
                        settings: {
                            allowMultipleVotes: false,
                            requirePayment: true,
                            paymentAmount: 10.00
                        }
                    }
                }
            },
            analytics: {
                dashboard: {
                    method: 'GET',
                    url: '/api/analytics/dashboard',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    }
                },
                eventStats: {
                    method: 'GET',
                    url: '/api/analytics/events/507f1f77bcf86cd799439014/stats',
                    headers: {
                        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    }
                }
            }
        };
    }

    /**
     * Generate Postman collection
     * @returns {Object} Postman collection
     */
    generatePostmanCollection() {
        const examples = this.generateExamples();
        
        return {
            info: {
                name: 'E-Voting API',
                description: 'Complete API collection for E-Voting application',
                version: config.get('app.version', '1.0.0'),
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            auth: {
                type: 'bearer',
                bearer: [
                    {
                        key: 'token',
                        value: '{{token}}',
                        type: 'string'
                    }
                ]
            },
            variable: [
                {
                    key: 'baseUrl',
                    value: `http://localhost:${config.get('app.port', 3000)}`,
                    type: 'string'
                },
                {
                    key: 'token',
                    value: '',
                    type: 'string'
                }
            ],
            item: this._convertExamplesToPostmanItems(examples)
        };
    }

    /**
     * Convert examples to Postman items
     * @param {Object} examples - API examples
     * @returns {Array} Postman items
     * @private
     */
    _convertExamplesToPostmanItems(examples) {
        const items = [];

        for (const [category, endpoints] of Object.entries(examples)) {
            const folder = {
                name: category.charAt(0).toUpperCase() + category.slice(1),
                item: []
            };

            for (const [name, example] of Object.entries(endpoints)) {
                const item = {
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    request: {
                        method: example.method,
                        header: Object.entries(example.headers || {}).map(([key, value]) => ({
                            key,
                            value
                        })),
                        url: {
                            raw: '{{baseUrl}}' + example.url,
                            host: ['{{baseUrl}}'],
                            path: example.url.split('/').filter(p => p)
                        }
                    }
                };

                if (example.body) {
                    item.request.body = {
                        mode: 'raw',
                        raw: JSON.stringify(example.body, null, 2),
                        options: {
                            raw: {
                                language: 'json'
                            }
                        }
                    };
                }

                folder.item.push(item);
            }

            items.push(folder);
        }

        return items;
    }
}

export default new ApiDocumentation();
