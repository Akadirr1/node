/**
 * Password validation utility
 */

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and errors
 */
const validatePassword = (password) => {
    const errors = [];

    // Check minimum length
    if (password.length < 8) {
        errors.push('Şifre en az 8 karakter olmalıdır.');
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
        errors.push('Şifre en az 1 büyük harf içermelidir.');
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
        errors.push('Şifre en az 1 sayı içermelidir.');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

/**
 * Validates password confirmation
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {object} - Validation result
 */
const validatePasswordConfirmation = (password, confirmPassword) => {
    return {
        isValid: password === confirmPassword,
        error: password !== confirmPassword ? 'Şifreler eşleşmiyor.' : null
    };
};

module.exports = {
    validatePassword,
    validatePasswordConfirmation
};

