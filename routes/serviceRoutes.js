const express = require('express');
const router = express.Router();
const { createService, getAllServices } = require('../controllers/serviceController');

// Not: Gerçek bir uygulamada createService rotası admin yetkisi ile korunmalıdır.
router.post('/', createService);
router.get('/', getAllServices); // Hizmetleri listelemek için

module.exports = router;