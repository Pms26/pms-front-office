const express = require('express');
const router = express.Router();
const { processCheckIn, getCheckInDetails, cancelCheckIn } = require('../controllers/checkinController');

router.get('/:bookingId', getCheckInDetails);
router.post('/:bookingId', processCheckIn);
router.delete('/:bookingId', cancelCheckIn);

module.exports = router;
