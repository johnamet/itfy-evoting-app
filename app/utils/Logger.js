import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/ConfigManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Centralized Logger Utility
 * Provides structured logging with levels, correlation IDs, and context enrichment
 */
class Logger {
    // Log levels (ascending severity)
    static LEVELS = {
        DEBUG: { name: 'DEBUG', value: 0, color: '\x1b[36m' },
        INFO: { name: 'INFO', value: 1, color: '\x1b[32m' },
        WARN: { name: 'WARN', value: 2, color: '\x1b[33m' },
        ERROR: { name: 'ERROR', value: 3, color: '\x1b[31m' },
        FATAL: { name: 'FATAL', value: 4, color: '\x1b[35m' }
    };

    static RESET_COLOR = '\x1b[0m';

    // Singleton instance
    static _instance = null;

    // Current correlation context (request tracking)
    static _correlationContext = new Map();

    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!Logger._instance) {
            Logger._instance = new Logger();
        }
        return Logger._instance;
    }

    constructor() {
        if (Logger._instance) {
            return Logger._instance;
        }

        this.logsDir = path.join(process.cwd(), 'logs');
        this.ensureLogsDirectory();
        this.currentLevel = this._getCurrentLogLevel();
        
        Logger._instance = this;
    }

    /**
     * Ensure logs directory exists
     */
    ensureLogsDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    /**
     * Get current log level from config
     */
    _getCurrentLogLevel() {
        const env = config.get('env');
        const levelName = config.get('logging.level') || (env === 'production' ? 'INFO' : 'DEBUG');
        return Logger.LEVELS[levelName] || Logger.LEVELS.INFO;
    }

    /**
     * Set correlation ID for current context
     * @param {string} correlationId - Request correlation ID
     */
    static setCorrelationId(correlationId) {
        const asyncId = this._getAsyncId();
        this._correlationContext.set(asyncId, correlationId);
    }

    /**
     * Get correlation ID for current context
     */
    static getCorrelationId() {
        const asyncId = this._getAsyncId();
        return this._correlationContext.get(asyncId) || null;
    }

    /**
     * Clear correlation ID for current context
     */
    static clearCorrelationId() {
        const asyncId = this._getAsyncId();
        this._correlationContext.delete(asyncId);
    }

    /**
     * Get async context ID (simplified - in production use AsyncLocalStorage)
     */
    static _getAsyncId() {
        return process.pid; // Simplified - should use async_hooks in production
    }

    /**
     * Generate correlation ID
     */
    static generateCorrelationId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create log entry with metadata
     */
    _createLogEntry(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        const correlationId = Logger.getCorrelationId();

        const logEntry = {
            timestamp,
            level: level.name,
            message,
            correlationId,
            ...context
        };

        // Add stack trace for errors
        if (level.value >= Logger.LEVELS.ERROR.value && context.error) {
            logEntry.stack = context.error.stack;
            logEntry.errorName = context.error.name;
            logEntry.errorMessage = context.error.message;
        }

        return logEntry;
    }

    /**
     * Format log entry for console output
     */
    _formatConsoleOutput(level, logEntry) {
        const { timestamp, message, correlationId, ...meta } = logEntry;
        const time = new Date(timestamp).toLocaleTimeString();
        
        let output = `${level.color}[${level.name}]${Logger.RESET_COLOR} ${time}`;
        
        if (correlationId) {
            output += ` [${correlationId}]`;
        }
        
        if (logEntry.service || logEntry.controller || logEntry.repository) {
            const component = logEntry.service || logEntry.controller || logEntry.repository;
            output += ` [${component}]`;
        }

        output += ` ${message}`;

        return output;
    }

    /**
     * Write log to file
     */
    async _writeToFile(level, logEntry) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const filename = `${level.name.toLowerCase()}-${date}.log`;
            const filepath = path.join(this.logsDir, filename);

            const logLine = JSON.stringify(logEntry) + '\n';
            
            await fs.promises.appendFile(filepath, logLine, 'utf8');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Check if level should be logged
     */
    _shouldLog(level) {
        return level.value >= this.currentLevel.value;
    }

    /**
     * Core logging method
     */
    _log(level, message, context = {}) {
        if (!this._shouldLog(level)) {
            return;
        }

        const logEntry = this._createLogEntry(level, message, context);
        const consoleOutput = this._formatConsoleOutput(level, logEntry);

        // Console output
        switch (level.name) {
            case 'DEBUG':
                console.debug(consoleOutput, context);
                break;
            case 'INFO':
                console.log(consoleOutput, context);
                break;
            case 'WARN':
                console.warn(consoleOutput, context);
                break;
            case 'ERROR':
            case 'FATAL':
                console.error(consoleOutput, context);
                if (logEntry.stack) {
                    console.error(logEntry.stack);
                }
                break;
        }

        // File output (async - don't await)
        this._writeToFile(level, logEntry).catch(err => {
            console.error('Logger file write error:', err);
        });
    }

    /**
     * Debug level logging
     */
    debug(message, context = {}) {
        this._log(Logger.LEVELS.DEBUG, message, context);
    }

    /**
     * Info level logging
     */
    info(message, context = {}) {
        this._log(Logger.LEVELS.INFO, message, context);
    }

    /**
     * Warn level logging
     */
    warn(message, context = {}) {
        this._log(Logger.LEVELS.WARN, message, context);
    }

    /**
     * Error level logging
     */
    error(message, context = {}) {
        this._log(Logger.LEVELS.ERROR, message, context);
    }

    /**
     * Fatal level logging
     */
    fatal(message, context = {}) {
        this._log(Logger.LEVELS.FATAL, message, context);
    }

    /**
     * Log with custom level (for backwards compatibility)
     */
    log(level, message, context = {}) {
        const levelObj = Logger.LEVELS[level?.toUpperCase()] || Logger.LEVELS.INFO;
        this._log(levelObj, message, context);
    }

    /**
     * Create child logger with context
     */
    child(context = {}) {
        return {
            debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
            info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
            warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
            error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
            fatal: (message, meta = {}) => this.fatal(message, { ...context, ...meta }),
            log: (level, message, meta = {}) => this.log(level, message, { ...context, ...meta })
        };
    }

    /**
     * Log performance metrics
     */
    performance(operation, duration, context = {}) {
        const level = duration > 1000 ? Logger.LEVELS.WARN : Logger.LEVELS.INFO;
        this._log(level, `Performance: ${operation} took ${duration}ms`, {
            ...context,
            operation,
            duration,
            performance: true
        });
    }

    /**
     * Log query execution
     */
    query(operation, collection, duration, context = {}) {
        const level = duration > 100 ? Logger.LEVELS.WARN : Logger.LEVELS.DEBUG;
        this._log(level, `Query: ${operation} on ${collection} (${duration}ms)`, {
            ...context,
            operation,
            collection,
            duration,
            query: true
        });
    }

    /**
     * Log security event
     */
    security(event, context = {}) {
        this._log(Logger.LEVELS.WARN, `Security: ${event}`, {
            ...context,
            security: true,
            event
        });
    }

    /**
     * Log HTTP request
     */
    request(method, path, statusCode, duration, context = {}) {
        const level = statusCode >= 400 ? Logger.LEVELS.ERROR : Logger.LEVELS.INFO;
        this._log(level, `${method} ${path} ${statusCode} (${duration}ms)`, {
            ...context,
            method,
            path,
            statusCode,
            duration,
            http: true
        });
    }

    /**
     * Start performance timer
     */
    startTimer() {
        return process.hrtime.bigint();
    }

    /**
     * End performance timer and return duration in ms
     */
    endTimer(startTime) {
        const endTime = process.hrtime.bigint();
        return Number(endTime - startTime) / 1000000; // Convert to ms
    }

    /**
     * Create timer wrapper for async operations
     */
    async timed(operation, fn, context = {}) {
        const startTime = this.startTimer();
        try {
            const result = await fn();
            const duration = this.endTimer(startTime);
            this.performance(operation, duration, context);
            return result;
        } catch (error) {
            const duration = this.endTimer(startTime);
            this.error(`${operation} failed after ${duration}ms`, {
                ...context,
                error,
                duration
            });
            throw error;
        }
    }

    /**
     * Read logs by date range
     */
    async getLogsByDateRange(startDate, endDate, level = null) {
        const logs = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];
            const levels = level ? [level.toLowerCase()] : ['debug', 'info', 'warn', 'error', 'fatal'];

            for (const lvl of levels) {
                const filename = `${lvl}-${dateStr}.log`;
                const filepath = path.join(this.logsDir, filename);

                if (fs.existsSync(filepath)) {
                    const content = await fs.promises.readFile(filepath, 'utf8');
                    const lines = content.trim().split('\n');
                    
                    for (const line of lines) {
                        try {
                            logs.push(JSON.parse(line));
                        } catch (error) {
                            console.error('Failed to parse log line:', error);
                        }
                    }
                }
            }
        }

        return logs;
    }

    /**
     * Clean up old logs
     */
    async cleanupOldLogs(retentionDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const files = await fs.promises.readdir(this.logsDir);
        let deletedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.log')) continue;

            const filepath = path.join(this.logsDir, file);
            const stats = await fs.promises.stat(filepath);

            if (stats.mtime < cutoffDate) {
                await fs.promises.unlink(filepath);
                deletedCount++;
            }
        }

        this.info(`Cleaned up ${deletedCount} old log files`, { retentionDays });
        return deletedCount;
    }
}

// Export singleton instance
const logger = Logger.getInstance();

export default logger;
export { Logger };
