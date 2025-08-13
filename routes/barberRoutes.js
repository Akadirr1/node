const express = require('express');
const router = express.Router();
const { protect } = require('../middleWares/authMiddleware');

const { getBarberProfile, updateBarberProfile ,getBarbers,updateMyServices, getMyServices } = require('../controllers/barberController');

router.get('/getBarbers',getBarbers);
router.get('/:id', protect, getBarberProfile);
//router.get('/')
router.put('/:id', updateBarberProfile);
router.put('/me/services',protect,updateMyServices)
router.get('/me/services',protect,getMyServices)
module.exports = router;