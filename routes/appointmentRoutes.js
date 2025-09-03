const express = require('express');
const router = express.Router();
const { getAvailableSlots, createAppointment, getMyBarberAppointments, cancelAppointment, createAppointmentByBarber, updateAppointmentStatus } = require('../controllers/appointmentController');
const { protect } = require('../middleWares/authMiddleware');

router.get('/availability/:barberId', getAvailableSlots);
router.get('/my-appointments', protect, getMyBarberAppointments)
router.post('/', protect, createAppointment);
router.delete('/:id', protect, cancelAppointment);
router.post('/by-barber',protect,createAppointmentByBarber);
router.patch('/:id/status',protect,updateAppointmentStatus)
module.exports = router;