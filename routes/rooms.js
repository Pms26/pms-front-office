const express = require('express');
const router = express.Router();
const { getAllRooms, getRoomById, updateRoomStatus, getRoomsByStatus } = require('../controllers/roomController');

router.get('/', getAllRooms);
router.get('/status/:status', getRoomsByStatus);
router.get('/:roomId', getRoomById);
router.patch('/:roomId/status', updateRoomStatus);

module.exports = router;
