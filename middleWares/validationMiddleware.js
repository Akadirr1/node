const { body, validationResult } = require('express-validator');

// Phone number validation
const phoneValidation = body('phoneNumber')
    .isLength({ min: 10, max: 15 })
    .withMessage('Telefon numarası 10-15 karakter arasında olmalıdır')
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Geçersiz telefon numarası formatı')
    .customSanitizer(value => {
        // Remove all non-numeric characters except +
        return value.replace(/[^0-9+]/g, '');
    });

// Name validation
const nameValidation = body(['name', 'surname'])
    .isLength({ min: 2, max: 50 })
    .withMessage('Ad ve soyad 2-50 karakter arasında olmalıdır')
    .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/)
    .withMessage('Ad ve soyad sadece harf içerebilir')
    .trim()
    .escape();

// Password validation
const passwordValidation = body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Şifre 6-128 karakter arasında olmalıdır')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Şifre en az bir küçük harf, bir büyük harf ve bir rakam içermelidir');

// New password validation (for password reset)
const newPasswordValidation = body('newPassword')
    .isLength({ min: 6, max: 128 })
    .withMessage('Şifre 6-128 karakter arasında olmalıdır');

// OTP validation
const otpValidation = body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP 6 haneli olmalıdır')
    .matches(/^[0-9]+$/)
    .withMessage('OTP sadece rakam içerebilir');

// Service name validation
const serviceNameValidation = body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Hizmet adı 2-100 karakter arasında olmalıdır')
    .trim()
    .escape();

// Duration validation
const durationValidation = body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Süre 15-480 dakika arasında olmalıdır');

// Price validation
const priceValidation = body('price')
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Fiyat 0-10000 arasında olmalıdır');

// Date validation
const dateValidation = body('startTime')
    .isISO8601()
    .withMessage('Geçersiz tarih formatı')
    .custom(value => {
        const date = new Date(value);
        const now = new Date();
        if (date < now) {
            throw new Error('Geçmiş tarih seçilemez');
        }
        return true;
    });

// Validation result handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Giriş verilerinde hata var',
            errors: errors.array()
        });
    }
    next();
};

// Sanitize request body
const sanitizeInput = (req, res, next) => {
    if (req.body) {
        // Sanitize all string fields
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.sanitize(req.body[key]);
            }
        });
    }
    next();
};

module.exports = {
    phoneValidation,
    nameValidation,
    passwordValidation,
    newPasswordValidation,
    otpValidation,
    serviceNameValidation,
    durationValidation,
    priceValidation,
    dateValidation,
    handleValidationErrors,
    sanitizeInput
};
