#!/usr/bin/env node
/**
 * Configuration Manager
 * 
 * Centralizes all application configuration with validation and type checking
 */

import path from 'path';
import fs from 'fs';

class ConfigManager {
    constructor() {
        this.config = {};
        this.required = [
            'NODE_ENV',
            'PORT',
            'MONGODB_URI',
            'JWT_SECRET'
        ];
        this.load();
    }

    /**
     * Load and validate configuration
     */
    load() {
        // Load environment variables
        this.config = {
            // Application settings
            app: {
                name: process.env.APP_NAME || 'E-Voting Application',
                version: process.env.APP_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                port: parseInt(process.env.PORT) || 3000,
                timezone: process.env.TIMEZONE || 'UTC',
                debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
            },

            // Database configuration
            database: {
                uri: process.env.MONGODB_URI,
                options: {
                    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
                    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
                    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
                    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
                    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
                    retryWrites: process.env.DB_RETRY_WRITES !== 'false'
                }
            },

            // JWT configuration
            jwt: {
                secret: process.env.JWT_SECRET,
                expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
                algorithm: process.env.JWT_ALGORITHM || 'HS256',
                issuer: process.env.JWT_ISSUER || 'e-voting-app'
            },

            // Security configuration
            security: {
                cors: {
                    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
                    credentials: process.env.CORS_CREDENTIALS === 'true'
                },
                rateLimit: {
                    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
                    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
                    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5
                },
                bcrypt: {
                    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
                },
                sessionSecret: process.env.SESSION_SECRET || this._generateSecret(),
                encryption: {
                    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
                    key: process.env.ENCRYPTION_KEY || this._generateSecret(32)
                }
            },

            // Email configuration
            email: {
                enabled: process.env.EMAIL_ENABLED === 'true',
                provider: process.env.EMAIL_PROVIDER || 'smtp',
                smtp: {
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASSWORD
                    }
                },
                from: {
                    name: process.env.EMAIL_FROM_NAME || 'E-Voting App',
                    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@evoting.app'
                },
                templates: {
                    path: process.env.EMAIL_TEMPLATES_PATH || path.join(process.cwd(), 'app/templates/email')
                }
            },

            // File storage configuration
            storage: {
                provider: process.env.STORAGE_PROVIDER || 'local',
                local: {
                    uploadDir: process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
                    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
                    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
                        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                        'application/pdf', 'text/plain', 'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ]
                },
                s3: {
                    bucket: process.env.AWS_S3_BUCKET,
                    region: process.env.AWS_REGION || 'us-east-1',
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            },

            // Cache configuration
            cache: {
                provider: process.env.CACHE_PROVIDER || 'memory',
                memory: {
                    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
                    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600000 // 1 hour
                },
                redis: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT) || 6379,
                    password: process.env.REDIS_PASSWORD,
                    db: parseInt(process.env.REDIS_DB) || 0,
                    keyPrefix: process.env.REDIS_KEY_PREFIX || 'evoting:'
                }
            },

            // Payment configuration
            payment: {
                enabled: process.env.PAYMENT_ENABLED === 'true',
                serviceUrl: process.env.PAYMENT_SERVICE_URL,
                apiKey: process.env.PAYMENT_API_KEY,
                currency: process.env.PAYMENT_CURRENCY || 'USD',
                sandbox: process.env.PAYMENT_SANDBOX === 'true'
            },

            // Logging configuration
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: process.env.LOG_FORMAT || 'combined',
                file: {
                    enabled: process.env.LOG_TO_FILE === 'true',
                    directory: process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs'),
                    maxSize: process.env.LOG_MAX_SIZE || '20m',
                    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14,
                    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
                },
                console: {
                    enabled: process.env.LOG_TO_CONSOLE !== 'false',
                    colorize: process.env.LOG_COLORIZE !== 'false'
                }
            },

            // Monitoring configuration
            monitoring: {
                enabled: process.env.MONITORING_ENABLED === 'true',
                healthCheck: {
                    path: process.env.HEALTH_CHECK_PATH || '/health',
                    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
                },
                metrics: {
                    enabled: process.env.METRICS_ENABLED === 'true',
                    path: process.env.METRICS_PATH || '/metrics'
                }
            },

            // Development configuration
            development: {
                hotReload: process.env.HOT_RELOAD === 'true',
                verbose: process.env.VERBOSE === 'true',
                mockData: process.env.MOCK_DATA === 'true'
            }
        };

        this.validate();
    }

    /**
     * Validate required configuration
     */
    validate() {
        const missing = [];
        const invalid = [];

        // Check required environment variables
        for (const key of this.required) {
            if (!process.env[key]) {
                missing.push(key);
            }
        }

        // Validate specific configurations
        if (this.config.database.uri && !this.config.database.uri.startsWith('mongodb')) {
            invalid.push('MONGODB_URI must be a valid MongoDB connection string');
        }

        if (this.config.jwt.secret && this.config.jwt.secret.length < 32) {
            invalid.push('JWT_SECRET must be at least 32 characters long');
        }

        if (this.config.app.port < 1 || this.config.app.port > 65535) {
            invalid.push('PORT must be between 1 and 65535');
        }

        if (this.config.email.enabled && !this.config.email.smtp.host) {
            invalid.push('SMTP_HOST is required when email is enabled');
        }

        // Report validation errors
        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:', missing.join(', '));
            if (this.config.app.environment === 'production') {
                process.exit(1);
            }
        }

        if (invalid.length > 0) {
            console.error('❌ Invalid configuration:');
            invalid.forEach(error => console.error(`   ${error}`));
            if (this.config.app.environment === 'production') {
                process.exit(1);
            }
        }

        if (missing.length === 0 && invalid.length === 0) {
            console.log('✅ Configuration validated successfully');
        }
    }

    /**
     * Get configuration value by path
     * @param {String} path - Dot notation path (e.g., 'database.uri')
     * @param {Any} defaultValue - Default value if not found
     * @returns {Any} Configuration value
     */
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }

        return value;
    }

    /**
     * Set configuration value by path
     * @param {String} path - Dot notation path
     * @param {Any} value - Value to set
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;

        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[lastKey] = value;
    }

    /**
     * Check if running in production
     * @returns {Boolean} True if in production
     */
    isProduction() {
        return this.config.app.environment === 'production';
    }

    /**
     * Check if running in development
     * @returns {Boolean} True if in development
     */
    isDevelopment() {
        return this.config.app.environment === 'development';
    }

    /**
     * Check if running in test
     * @returns {Boolean} True if in test
     */
    isTest() {
        return this.config.app.environment === 'test';
    }

    /**
     * Generate a random secret
     * @param {Number} length - Length of secret
     * @returns {String} Random secret
     * @private
     */
    _generateSecret(length = 64) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Create example .env file
     */
    createExampleEnv() {
        const exampleEnv = `# Application Configuration
NODE_ENV=development
PORT=3000
APP_NAME=E-Voting Application
APP_VERSION=1.0.0

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/evoting

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-minimum-32-characters
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret-here

# Email Configuration
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-email-password
EMAIL_FROM_NAME=E-Voting App
EMAIL_FROM_ADDRESS=noreply@evoting.app

# File Storage Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# Cache Configuration
CACHE_PROVIDER=memory
CACHE_MAX_SIZE=1000
CACHE_DEFAULT_TTL=3600000

# Payment Configuration
PAYMENT_ENABLED=true
PAYMENT_SERVICE_URL=http://localhost:4000
PAYMENT_API_KEY=your-payment-api-key

# Logging Configuration
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_TO_CONSOLE=true

# Monitoring Configuration
MONITORING_ENABLED=true
HEALTH_CHECK_PATH=/health
METRICS_ENABLED=true

# Development Configuration
HOT_RELOAD=true
VERBOSE=false
MOCK_DATA=false
`;

        const envPath = path.join(process.cwd(), '.env.example');
        fs.writeFileSync(envPath, exampleEnv);
        console.log('✅ Created .env.example file');
    }

    /**
     * Get all configuration as object
     * @returns {Object} Complete configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Print configuration summary
     */
    printSummary() {
        console.log('\n📋 Configuration Summary:');
        console.log(`   Environment: ${this.config.app.environment}`);
        console.log(`   Port: ${this.config.app.port}`);
        console.log(`   Database: ${this.config.database.uri ? '✅ Configured' : '❌ Not configured'}`);
        console.log(`   JWT: ${this.config.jwt.secret ? '✅ Configured' : '❌ Not configured'}`);
        console.log(`   Email: ${this.config.email.enabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Payment: ${this.config.payment.enabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Monitoring: ${this.config.monitoring.enabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log('');
    }
}

// Create singleton instance
const config = new ConfigManager();

export default config;
