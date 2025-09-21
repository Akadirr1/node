const express = require('express');
const router = express.Router();
const { createService, getAllServices } = require('../controllers/serviceController');
const { protect, adminOnly } = require('../middleWares/authMiddleware');
const {
    serviceNameValidation,
    durationValidation,
    handleValidationErrors,
    sanitizeInput
} = require('../middleWares/validationMiddleware');

// Admin only routes
router.post('/', 
    protect, 
    adminOnly, 
    sanitizeInput,
    [serviceNameValidation, durationValidation], 
    handleValidationErrors, 
    createService
);
router.get('/', getAllServices); // Hizmetleri listelemek için

module.exports = router;