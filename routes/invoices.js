const express = require('express');
const router = express.Router();
const { getDayInvoices } = require('../controllers/invoiceController');

router.get('/', getDayInvoices);

module.exports = router;