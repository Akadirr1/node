const express = require('express');
const router = express.Router();
const { createBarber, createUser ,loginUser, getMe, logOut,getAppointments,cancelAppointment} = require('../controllers/userController');
const { protect } = require('../middleWares/authMiddleware');
router.post('/register/barber', createBarber);
router.post('/register/user',createUser);
router.get('/me',protect,getMe);
router.get('/myAppointments',protect,getAppointments)
router.post('/login/user', loginUser);
router.post('/logout',logOut);
router.delete('/:id',protect,cancelAppointment);
module.exports = router;