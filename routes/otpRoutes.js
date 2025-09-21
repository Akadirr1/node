// routes/otpRoutes.js
const express = require('express');
const router = express.Router();
const {
    sendRegistrationOTP,
    verifyRegistrationOTP,
    sendLoginOTP,
    verifyLoginOTP,
    sendPasswordResetOTP,
    verifyPasswordResetOTP
} = require('../controllers/otpController');
const {
    phoneValidation,
    nameValidation,
    passwordValidation,
    newPasswordValidation,
    otpValidation,
    handleValidationErrors,
    sanitizeInput
} = require('../middleWares/validationMiddleware');

// Registration with OTP
router.post('/send-registration-otp', 
    sanitizeInput,
    [phoneValidation, nameValidation], 
    handleValidationErrors, 
    sendRegistrationOTP
);
router.post('/verify-registration-otp', 
    sanitizeInput,
    [phoneValidation, otpValidation, passwordValidation], 
    handleValidationErrors, 
    verifyRegistrationOTP
);

// Login with OTP
router.post('/send-login-otp', 
    sanitizeInput,
    phoneValidation, 
    handleValidationErrors, 
    sendLoginOTP
);
router.post('/verify-login-otp', 
    sanitizeInput,
    [phoneValidation, otpValidation], 
    handleValidationErrors, 
    verifyLoginOTP
);

// Password reset with OTP
router.post('/send-password-reset-otp', 
    sanitizeInput,
    phoneValidation, 
    handleValidationErrors, 
    sendPasswordResetOTP
);
router.post('/verify-password-reset-otp', 
    sanitizeInput,
    [phoneValidation, otpValidation, newPasswordValidation], 
    handleValidationErrors, 
    verifyPasswordResetOTP
);

module.exports = router;