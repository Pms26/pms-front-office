const express = require('express');
const router = express.Router();
const { getDayPayments } = require('../controllers/paymentController');

router.get('/', getDayPayments);

module.exports = router;