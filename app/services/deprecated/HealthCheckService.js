/**
 * Health Check Service
 * 
 * Provides comprehensive health monitoring for the application
 */

import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/ConfigManager.js';

class HealthCheckService {
    constructor() {
        this.checks = new Map();
        this.lastResults = new Map();
        this.registerDefaultChecks();
    }

    /**
     * Register default health checks
     */
    registerDefaultChecks() {
        this.registerCheck('database', this.checkDatabase.bind(this));
        this.registerCheck('memory', this.checkMemory.bind(this));
        this.registerCheck('storage', this.checkStorage.bind(this));
        this.registerCheck('external_services', this.checkExternalServices.bind(this));
    }

    /**
     * Register a health check
     * @param {String} name - Check name
     * @param {Function} checkFunction - Function that returns Promise<{status: string, details?: object}>
     */
    registerCheck(name, checkFunction) {
        this.checks.set(name, checkFunction);
    }

    /**
     * Run all health checks
     * @returns {Promise<Object>} Health status report
     */
    async runAllChecks() {
        const results = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: config.get('app.version'),
            environment: config.get('app.environment'),
            checks: {}
        };

        const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
            try {
                const startTime = Date.now();
                const result = await Promise.race([
                    checkFn(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Health check timeout')), 
                        config.get('monitoring.healthCheck.timeout', 5000))
                    )
                ]);
                
                const duration = Date.now() - startTime;
                
                return {
                    name,
                    result: {
                        status: result.status || 'healthy',
                        duration: `${duration}ms`,
                        details: result.details || {},
                        timestamp: new Date().toISOString()
                    }
                };
            } catch (error) {
                return {
                    name,
                    result: {
                        status: 'unhealthy',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }
                };
            }
        });

        const checkResults = await Promise.all(checkPromises);
        
        // Aggregate results
        let hasUnhealthy = false;
        let hasWarning = false;

        for (const { name, result } of checkResults) {
            results.checks[name] = result;
            this.lastResults.set(name, result);

            if (result.status === 'unhealthy') {
                hasUnhealthy = true;
            } else if (result.status === 'warning') {
                hasWarning = true;
            }
        }

        // Set overall status
        if (hasUnhealthy) {
            results.status = 'unhealthy';
        } else if (hasWarning) {
            results.status = 'warning';
        }

        return results;
    }

    /**
     * Get quick health status
     * @returns {Promise<Object>} Quick health status
     */
    async getQuickStatus() {
        try {
            // Just check database connectivity
            const dbStatus = await this.checkDatabase();
            
            return {
                status: dbStatus.status,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                message: dbStatus.status === 'healthy' ? 'Service is operational' : 'Service experiencing issues'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                message: 'Service is down',
                error: error.message
            };
        }
    }

    /**
     * Check database connectivity
     * @returns {Promise<Object>} Database health status
     */
    async checkDatabase() {
        try {
            const startTime = Date.now();
            
            // Check connection state
            const connectionState = mongoose.connection.readyState;
            const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
            
            if (connectionState !== 1) {
                return {
                    status: 'unhealthy',
                    details: {
                        state: stateNames[connectionState] || 'unknown',
                        message: 'Database not connected'
                    }
                };
            }

            // Test actual database operation
            await mongoose.connection.db.admin().ping();
            const responseTime = Date.now() - startTime;

            // Get database stats
            const stats = await mongoose.connection.db.stats();
            
            return {
                status: responseTime > 1000 ? 'warning' : 'healthy',
                details: {
                    state: 'connected',
                    responseTime: `${responseTime}ms`,
                    collections: stats.collections,
                    dataSize: this.formatBytes(stats.dataSize),
                    indexSize: this.formatBytes(stats.indexSize),
                    storageSize: this.formatBytes(stats.storageSize)
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error.message,
                    message: 'Database connectivity failed'
                }
            };
        }
    }

    /**
     * Check memory usage
     * @returns {Promise<Object>} Memory health status
     */
    async checkMemory() {
        const memUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const freeMemory = require('os').freemem();
        
        const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        const systemMemoryUsedPercent = ((totalMemory - freeMemory) / totalMemory) * 100;

        let status = 'healthy';
        const warnings = [];

        if (heapUsedPercent > 85) {
            status = 'warning';
            warnings.push('High heap usage');
        }

        if (systemMemoryUsedPercent > 90) {
            status = systemMemoryUsedPercent > 95 ? 'unhealthy' : 'warning';
            warnings.push('High system memory usage');
        }

        return {
            status,
            details: {
                heap: {
                    used: this.formatBytes(memUsage.heapUsed),
                    total: this.formatBytes(memUsage.heapTotal),
                    percentage: `${heapUsedPercent.toFixed(1)}%`
                },
                system: {
                    total: this.formatBytes(totalMemory),
                    free: this.formatBytes(freeMemory),
                    used: this.formatBytes(totalMemory - freeMemory),
                    percentage: `${systemMemoryUsedPercent.toFixed(1)}%`
                },
                rss: this.formatBytes(memUsage.rss),
                external: this.formatBytes(memUsage.external),
                warnings: warnings.length > 0 ? warnings : undefined
            }
        };
    }

    /**
     * Check storage health
     * @returns {Promise<Object>} Storage health status
     */
    async checkStorage() {
        try {
            const uploadDir = config.get('storage.local.uploadDir');
            
            // Check if upload directory exists and is writable
            try {
                await fs.access(uploadDir, fs.constants.F_OK | fs.constants.W_OK);
            } catch {
                return {
                    status: 'unhealthy',
                    details: {
                        message: 'Upload directory not accessible',
                        path: uploadDir
                    }
                };
            }

            // Check disk space
            const stats = await fs.stat(uploadDir);
            const testFile = path.join(uploadDir, '.health-check');
            
            try {
                await fs.writeFile(testFile, 'health check');
                await fs.unlink(testFile);
            } catch (error) {
                return {
                    status: 'unhealthy',
                    details: {
                        message: 'Cannot write to upload directory',
                        path: uploadDir,
                        error: error.message
                    }
                };
            }

            return {
                status: 'healthy',
                details: {
                    uploadDir: uploadDir,
                    accessible: true,
                    writable: true
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error.message,
                    message: 'Storage check failed'
                }
            };
        }
    }

    /**
     * Check external services
     * @returns {Promise<Object>} External services health status
     */
    async checkExternalServices() {
        const services = {};
        let overallStatus = 'healthy';

        // Check payment service if enabled
        if (config.get('payment.enabled')) {
            try {
                const paymentUrl = config.get('payment.serviceUrl');
                const response = await fetch(`${paymentUrl}/health`, {
                    method: 'GET',
                    timeout: 3000
                });
                
                services.payment = {
                    status: response.ok ? 'healthy' : 'unhealthy',
                    responseTime: response.headers.get('x-response-time') || 'unknown',
                    url: paymentUrl
                };
                
                if (!response.ok) {
                    overallStatus = 'warning';
                }
            } catch (error) {
                services.payment = {
                    status: 'unhealthy',
                    error: error.message,
                    url: config.get('payment.serviceUrl')
                };
                overallStatus = 'warning';
            }
        }

        // Check email service if enabled
        if (config.get('email.enabled')) {
            services.email = {
                status: 'healthy', // Basic config check
                provider: config.get('email.provider'),
                host: config.get('email.smtp.host')
            };
        }

        return {
            status: overallStatus,
            details: {
                services,
                count: Object.keys(services).length
            }
        };
    }

    /**
     * Get last check results
     * @param {String} checkName - Optional specific check name
     * @returns {Object} Last results
     */
    getLastResults(checkName = null) {
        if (checkName) {
            return this.lastResults.get(checkName) || null;
        }
        
        return Object.fromEntries(this.lastResults);
    }

    /**
     * Format bytes to human readable format
     * @param {Number} bytes - Bytes to format
     * @returns {String} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get system information
     * @returns {Object} System information
     */
    getSystemInfo() {
        const os = require('os');
        
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            uptime: {
                system: os.uptime(),
                process: process.uptime()
            },
            loadAverage: os.loadavg(),
            cpus: os.cpus().length,
            hostname: os.hostname(),
            network: this.getNetworkInterfaces()
        };
    }

    /**
     * Get network interfaces information
     * @returns {Object} Network interfaces
     * @private
     */
    getNetworkInterfaces() {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        const result = {};

        for (const [name, addresses] of Object.entries(interfaces)) {
            result[name] = addresses
                .filter(addr => !addr.internal)
                .map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    mac: addr.mac
                }));
        }

        return result;
    }
}

export default new HealthCheckService();
