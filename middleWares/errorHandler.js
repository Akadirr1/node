const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error using logger
    logger.error('Error:', err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Geçersiz ID formatı';
        error = { message, statusCode: 400 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Bu bilgi zaten kullanımda';
        error = { message, statusCode: 400 };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, statusCode: 400 };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Geçersiz token';
        error = { message, statusCode: 401 };
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token süresi dolmuş';
        error = { message, statusCode: 401 };
    }

    // Rate limit error
    if (err.status === 429) {
        const message = 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin';
        error = { message, statusCode: 429 };
    }

    // Default error
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Sunucu hatası';

    // Don't expose internal errors in production
    const response = {
        success: false,
        message: message
    };

    // Only include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.error = err;
    }

    res.status(statusCode).json(response);
};

// 404 handler
const notFound = (req, res, next) => {
    const error = new Error(`Endpoint bulunamadı - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    notFound,
    asyncHandler
};
