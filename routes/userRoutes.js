const express = require('express');
const router = express.Router();
const { createBarber, getMe, logOut, getAppointments, searchCustomerByPhone, loginUser } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleWares/authMiddleware');

// Keep traditional login for backward compatibility (can be removed later)
router.post('/login/user', loginUser);

router.post('/register/barber', protect, adminOnly, createBarber);
router.get('/me', protect, getMe);
router.get('/myAppointments', protect, getAppointments);
router.post('/logout', logOut);
router.get('/search', protect, searchCustomerByPhone);

module.exports = router;