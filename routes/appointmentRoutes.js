const express = require('express');
const router = express.Router();
const { getAvailableSlots, createAppointment, getMyBarberAppointments } = require('../controllers/appointmentController');
const { protect } = require('../middleWares/authMiddleware');

router.get('/availability/:barberId', getAvailableSlots);
router.get('/my-appointments',protect,getMyBarberAppointments)
router.post('/', protect, createAppointment);

module.exports = router;