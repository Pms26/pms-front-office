const express = require('express');
const router = express.Router();
const { processCheckOut, getStatement } = require('../controllers/checkoutController');

router.get('/:bookingId/statement', getStatement);
router.post('/:bookingId', processCheckOut);

module.exports = router;
