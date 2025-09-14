#!/usr/bin/env node
/**
 * Redis Configuration
 * 
 * Centralized Redis configuration for the application.
 * Handles environment-specific settings and connection parameters.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const redisConfig = {
    // Connection settings
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    
    // Database assignments for different cache types
    databases: {
        main: parseInt(process.env.REDIS_DB_MAIN) || 0,
        session: parseInt(process.env.REDIS_DB_SESSION) || 1,
        user: parseInt(process.env.REDIS_DB_USER) || 2,
        event: parseInt(process.env.REDIS_DB_EVENT) || 3,
        queue: parseInt(process.env.REDIS_DB_QUEUE) || 4
    },
    
    // Connection options
    connection: {
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
        lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
        enableReadyCheck: true,
        maxLoadingTimeout: 5000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4, // 4 (IPv4) or 6 (IPv6)
        keepAlive: true
    },
    
    // Key prefixes for different environments
    keyPrefixes: {
        development: 'itfy:dev:',
        test: 'itfy:test:',
        staging: 'itfy:staging:',
        production: 'itfy:prod:'
    },
    
    // TTL settings (in seconds)
    ttl: {
        short: parseInt(process.env.REDIS_TTL_SHORT) || 300,     // 5 minutes
        medium: parseInt(process.env.REDIS_TTL_MEDIUM) || 1800,  // 30 minutes
        long: parseInt(process.env.REDIS_TTL_LONG) || 3600,      // 1 hour
        veryLong: parseInt(process.env.REDIS_TTL_VERY_LONG) || 86400 // 24 hours
    },
    
    // Environment-specific configurations
    environments: {
        development: {
            host: 'localhost',
            port: 6379,
            enableLogging: true,
            enableStats: true
        },
        test: {
            host: 'localhost',
            port: 6379,
            enableLogging: false,
            enableStats: false
        },
        staging: {
            host: process.env.REDIS_HOST || 'redis-staging',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            enableLogging: true,
            enableStats: true,
            tls: process.env.REDIS_TLS === 'true' ? {} : null
        },
        production: {
            host: process.env.REDIS_HOST || 'redis-production',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            enableLogging: false,
            enableStats: true,
            tls: process.env.REDIS_TLS === 'true' ? {
                checkServerIdentity: false,
                rejectUnauthorized: false
            } : null
        }
    },
    
    // Cluster configuration (if using Redis Cluster)
    cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        nodes: process.env.REDIS_CLUSTER_NODES ? 
            process.env.REDIS_CLUSTER_NODES.split(',').map(node => {
                const [host, port] = node.split(':');
                return { host, port: parseInt(port) || 6379 };
            }) : [],
        options: {
            enableOfflineQueue: false,
            redisOptions: {
                password: process.env.REDIS_PASSWORD
            }
        }
    },
    
    // Sentinel configuration (if using Redis Sentinel)
    sentinel: {
        enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
        sentinels: process.env.REDIS_SENTINELS ? 
            process.env.REDIS_SENTINELS.split(',').map(sentinel => {
                const [host, port] = sentinel.split(':');
                return { host, port: parseInt(port) || 26379 };
            }) : [],
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster',
        sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
        password: process.env.REDIS_PASSWORD
    }
};

/**
 * Get Redis configuration for current environment
 * @returns {Object} Redis configuration object
 */
export function getRedisConfig() {
    const env = process.env.NODE_ENV || 'development';
    const envConfig = redisConfig.environments[env] || redisConfig.environments.development;
    
    let baseConfig = {
        ...redisConfig.connection,
        host: envConfig.host,
        port: envConfig.port,
        password: envConfig.password,
        keyPrefix: redisConfig.keyPrefixes[env] || redisConfig.keyPrefixes.development
    };
    
    // Add TLS configuration if available
    if (envConfig.tls) {
        baseConfig.tls = envConfig.tls;
    }
    
    // Handle cluster configuration
    if (redisConfig.cluster.enabled) {
        return {
            type: 'cluster',
            nodes: redisConfig.cluster.nodes,
            options: {
                ...redisConfig.cluster.options,
                ...baseConfig
            }
        };
    }
    
    // Handle sentinel configuration
    if (redisConfig.sentinel.enabled) {
        return {
            type: 'sentinel',
            sentinels: redisConfig.sentinel.sentinels,
            name: redisConfig.sentinel.name,
            sentinelPassword: redisConfig.sentinel.sentinelPassword,
            ...baseConfig
        };
    }
    
    return {
        type: 'standalone',
        ...baseConfig
    };
}

/**
 * Get database number for specific cache type
 * @param {string} cacheType - Type of cache (main, session, user, event)
 * @returns {number} Database number
 */
export function getDatabaseNumber(cacheType) {
    return redisConfig.databases[cacheType] || redisConfig.databases.main;
}

/**
 * Get TTL value for specific duration
 * @param {string} duration - Duration type (short, medium, long, veryLong)
 * @returns {number} TTL in seconds
 */
export function getTTL(duration) {
    return redisConfig.ttl[duration] || redisConfig.ttl.medium;
}

/**
 * Get key prefix for current environment
 * @returns {string} Key prefix
 */
export function getKeyPrefix() {
    const env = process.env.NODE_ENV || 'development';
    return redisConfig.keyPrefixes[env] || redisConfig.keyPrefixes.development;
}

/**
 * Validate Redis configuration
 * @returns {Object} Validation result
 */
export function validateRedisConfig() {
    const config = getRedisConfig();
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!config.host) {
        errors.push('Redis host is required');
    }
    
    if (!config.port || isNaN(config.port)) {
        errors.push('Redis port must be a valid number');
    }
    
    // Check environment-specific requirements
    const env = process.env.NODE_ENV;
    if (env === 'production' && !config.password) {
        warnings.push('Redis password is recommended for production environment');
    }
    
    if (config.type === 'cluster' && (!redisConfig.cluster.nodes || redisConfig.cluster.nodes.length === 0)) {
        errors.push('Cluster nodes are required when cluster mode is enabled');
    }
    
    if (config.type === 'sentinel' && (!redisConfig.sentinel.sentinels || redisConfig.sentinel.sentinels.length === 0)) {
        errors.push('Sentinel nodes are required when sentinel mode is enabled');
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        config
    };
}

export default redisConfig;
