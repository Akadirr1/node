const express = require('express');
const router = express.Router();
const { createBarber, createUser, loginUser, getMe, logOut, getAppointments, searchCustomerByPhone } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleWares/authMiddleware');
router.post('/register/barber', protect, adminOnly, createBarber);//buraya protect ekle herkes berber açamasın aq
router.post('/register/user', createUser);
router.get('/me', protect, getMe);
router.get('/myAppointments', protect, getAppointments)
router.post('/login/user', loginUser);
router.post('/logout', logOut);
router.get('/search', searchCustomerByPhone);
module.exports = router;