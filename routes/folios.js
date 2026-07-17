const express = require('express');
const router = express.Router();
const { getFolio, addItem, updateItemVisibility, bulkUpdateVisibility, deleteItem } = require('../controllers/folioController');

router.get('/:folioId', getFolio);
router.post('/:folioId/items', addItem);
router.patch('/:folioId/items/visibility', bulkUpdateVisibility);
router.patch('/items/:itemId/visibility', updateItemVisibility);
router.delete('/items/:itemId', deleteItem);

module.exports = router;
