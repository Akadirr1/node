const express = require('express');
const router = express.Router();
const { getAvailableSlots, createAppointment, getMyBarberAppointments, cancelAppointment } = require('../controllers/appointmentController');
const { protect } = require('../middleWares/authMiddleware');

router.get('/availability/:barberId', getAvailableSlots);
router.get('/my-appointments', protect, getMyBarberAppointments)
router.post('/', protect, createAppointment);
router.delete('/:id', protect, cancelAppointment);

module.exports = router;