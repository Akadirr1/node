const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which transports the logger must use
const transports = [
    // Console transport
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
            winston.format.colorize({ all: true }),
            winston.format.printf(
                (info) => `${info.timestamp} ${info.level}: ${info.message}`
            )
        ),
    }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
    // Create logs directory if it doesn't exist
    const fs = require('fs');
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    transports.push(
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
        })
    );
}

// Create the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
    levels,
    transports,
});

// Security event logger
const securityLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.colorize(),
                winston.format.printf(
                    (info) => `🔒 SECURITY ${info.timestamp} ${info.level}: ${info.message}`
                )
            ),
        }),
    ],
});

// Add security log file in production
if (process.env.NODE_ENV === 'production') {
    securityLogger.add(
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/security.log'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
        })
    );
}

// Log security events
const logSecurityEvent = (event, details = {}) => {
    securityLogger.info({
        event,
        details,
        timestamp: new Date().toISOString(),
        ip: details.ip || 'unknown',
        userAgent: details.userAgent || 'unknown',
        userId: details.userId || 'anonymous'
    });
};

// Log authentication events
const logAuthEvent = (event, userId, ip, userAgent, success = true) => {
    logSecurityEvent('auth', {
        event,
        userId,
        ip,
        userAgent,
        success
    });
};

// Log authorization events
const logAuthzEvent = (event, userId, resource, ip, userAgent, success = true) => {
    logSecurityEvent('authorization', {
        event,
        userId,
        resource,
        ip,
        userAgent,
        success
    });
};

// Log rate limiting events
const logRateLimitEvent = (ip, endpoint, userAgent) => {
    logSecurityEvent('rate_limit', {
        ip,
        endpoint,
        userAgent
    });
};

// Log suspicious activity
const logSuspiciousActivity = (activity, details = {}) => {
    logSecurityEvent('suspicious_activity', {
        activity,
        ...details
    });
};

// Express middleware for request logging
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id || 'anonymous'
        };

        if (res.statusCode >= 400) {
            logger.warn('HTTP Request', logData);
        } else {
            logger.http('HTTP Request', logData);
        }
    });

    next();
};

module.exports = {
    logger,
    securityLogger,
    logSecurityEvent,
    logAuthEvent,
    logAuthzEvent,
    logRateLimitEvent,
    logSuspiciousActivity,
    requestLogger
};

