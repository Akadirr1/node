const express = require('express');
const router = express.Router();
const { protect } = require('../middleWares/authMiddleware');

const { getBarberProfile, updateBarberProfile ,getBarbers} = require('../controllers/barberController');

router.get('/getBarbers',getBarbers);
router.get('/:id', protect, getBarberProfile);

router.put('/:id', updateBarberProfile);

module.exports = router;