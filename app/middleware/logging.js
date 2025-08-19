#!/usr/bin/env node
/**
 * Logging Middleware
 * 
 * Provides comprehensive logging functionality for the application
 */

import fs from 'fs';
import path from 'path';

class LoggingMiddleware {
    static logDirectory = path.join(process.cwd(), 'logs');
    
    /**
     * Initialize logging directory
     */
    static initializeLogging() {
        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    /**
     * Request logging middleware
     * @param {Object} options - Logging options
     * @returns {Function} Request logging middleware
     */
    static requestLogger(options = {}) {
        const {
            logToFile = true,
            logToConsole = true,
            skipHealthChecks = true,
            sensitiveFields = ['password', 'token', 'authorization']
        } = options;

        return (req, res, next) => {
            const startTime = Date.now();
            const timestamp = new Date().toISOString();
            
            // Skip health check endpoints if configured
            if (skipHealthChecks && (req.path === '/health' || req.path === '/status')) {
                return next();
            }

            // Log request
            const requestLog = {
                timestamp,
                requestId: req.requestId,
                method: req.method,
                url: req.originalUrl,
                userAgent: req.headers['user-agent'],
                ip: req.ip || req.connection.remoteAddress,
                userId: req.user?.id || null,
                body: this._sanitizeLogData(req.body, sensitiveFields),
                query: req.query,
                headers: this._sanitizeLogData(req.headers, sensitiveFields)
            };

            if (logToConsole) {
                console.log(`[REQUEST] ${req.method} ${req.originalUrl} - ${req.ip}`);
            }

            // Override res.json to capture response
            const originalJson = res.json;
            res.json = function(data) {
                const endTime = Date.now();
                const duration = endTime - startTime;

                const responseLog = {
                    ...requestLog,
                    responseTime: duration,
                    statusCode: res.statusCode,
                    success: data?.success || res.statusCode < 400,
                    error: data?.error || null
                };

                if (logToConsole) {
                    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
                    const resetColor = '\x1b[0m';
                    console.log(`[RESPONSE] ${statusColor}${res.statusCode}${resetColor} ${req.method} ${req.originalUrl} - ${duration}ms`);
                }

                if (logToFile) {
                    LoggingMiddleware._writeToLogFile('requests', responseLog);
                }

                return originalJson.call(this, data);
            };

            next();
        };
    }

    /**
     * Error logging middleware
     * @returns {Function} Error logging middleware
     */
    static errorLogger() {
        return (error, req, res, next) => {
            const timestamp = new Date().toISOString();
            
            const errorLog = {
                timestamp,
                requestId: req.requestId,
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                request: {
                    method: req.method,
                    url: req.originalUrl,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    userId: req.user?.id || null
                }
            };

            console.error(`[ERROR] ${error.message}`, errorLog);
            this._writeToLogFile('errors', errorLog);

            next(error);
        };
    }

    /**
     * Performance monitoring middleware
     * @returns {Function} Performance monitoring middleware
     */
    static performanceMonitor() {
        return (req, res, next) => {
            const startTime = process.hrtime();
            const startMemory = process.memoryUsage();

            res.on('finish', () => {
                const [seconds, nanoseconds] = process.hrtime(startTime);
                const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
                const endMemory = process.memoryUsage();

                if (duration > 1000) { // Log slow requests (>1s)
                    const performanceLog = {
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId,
                        method: req.method,
                        url: req.originalUrl,
                        duration: Math.round(duration),
                        statusCode: res.statusCode,
                        memoryDelta: {
                            rss: endMemory.rss - startMemory.rss,
                            heapUsed: endMemory.heapUsed - startMemory.heapUsed
                        }
                    };

                    console.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} - ${Math.round(duration)}ms`);
                    this._writeToLogFile('performance', performanceLog);
                }
            });

            next();
        };
    }

    /**
     * Security event logger
     * @param {String} event - Security event type
     * @param {Object} details - Event details
     * @param {Object} req - Request object
     */
    static logSecurityEvent(event, details, req) {
        const securityLog = {
            timestamp: new Date().toISOString(),
            event,
            details,
            request: {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                url: req.originalUrl,
                method: req.method,
                userId: req.user?.id || null
            }
        };

        console.warn(`[SECURITY] ${event}`, securityLog);
        this._writeToLogFile('security', securityLog);
    }

    /**
     * Write log data to file
     * @param {String} logType - Type of log (requests, errors, etc.)
     * @param {Object} data - Log data
     * @private
     */
    static _writeToLogFile(logType, data) {
        try {
            this.initializeLogging();
            
            const date = new Date().toISOString().split('T')[0];
            const filename = `${logType}-${date}.log`;
            const filepath = path.join(this.logDirectory, filename);
            
            const logEntry = JSON.stringify(data) + '\n';
            
            fs.appendFileSync(filepath, logEntry, 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Sanitize sensitive data from logs
     * @param {Object} data - Data to sanitize
     * @param {Array} sensitiveFields - Fields to remove/mask
     * @returns {Object} Sanitized data
     * @private
     */
    static _sanitizeLogData(data, sensitiveFields) {
        if (!data || typeof data !== 'object') return data;

        const sanitized = { ...data };
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Get log files for a specific date range
     * @param {String} logType - Type of log
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Log entries
     */
    static getLogsByDateRange(logType, startDate, endDate) {
        const logs = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];
            const filename = `${logType}-${dateStr}.log`;
            const filepath = path.join(this.logDirectory, filename);

            if (fs.existsSync(filepath)) {
                const content = fs.readFileSync(filepath, 'utf8');
                const lines = content.trim().split('\n').filter(line => line);
                
                lines.forEach(line => {
                    try {
                        logs.push(JSON.parse(line));
                    } catch (error) {
                        console.error('Failed to parse log line:', error);
                    }
                });
            }
        }

        return logs;
    }

    /**
     * Clean up old log files
     * @param {Number} retentionDays - Number of days to retain logs
     */
    static cleanupOldLogs(retentionDays = 30) {
        try {
            this.initializeLogging();
            
            const files = fs.readdirSync(this.logDirectory);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            files.forEach(file => {
                const match = file.match(/(\w+)-(\d{4}-\d{2}-\d{2})\.log$/);
                if (match) {
                    const fileDate = new Date(match[2]);
                    if (fileDate < cutoffDate) {
                        const filepath = path.join(this.logDirectory, file);
                        fs.unlinkSync(filepath);
                        console.log(`Deleted old log file: ${file}`);
                    }
                }
            });
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }
}

export default LoggingMiddleware;
