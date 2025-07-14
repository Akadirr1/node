const express = require('express');
const router = express.Router();
const { getAvailableSlots, createAppointment } = require('../controllers/appointmentController');
const { protect } = require('../middleWares/authMiddleware');

router.get('/availability/:barberId', getAvailableSlots);

router.post('/', protect, createAppointment);

module.exports = router;