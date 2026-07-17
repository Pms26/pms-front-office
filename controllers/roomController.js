const Room = require('../models/Room');

exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).sort({ floor: 1, roomNumber: 1 });

    res.json({
      count: rooms.length,
      rooms: rooms.map(room => ({
        id: room._id,
        roomNumber: room.roomNumber,
        category: room.category,
        floor: room.floor,
        bedType: room.bedType,
        maxOccupancy: room.maxOccupancy,
        housekeepingStatus: room.housekeepingStatus,
        blockReason: room.blockReason
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    res.json({
      id: room._id,
      roomNumber: room.roomNumber,
      category: room.category,
      floor: room.floor,
      bedType: room.bedType,
      maxOccupancy: room.maxOccupancy,
      housekeepingStatus: room.housekeepingStatus,
      blockReason: room.blockReason
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { housekeepingStatus, blockReason } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    if (housekeepingStatus === 'bloquee') {
      if (!blockReason) {
        return res.status(400).json({ error: 'Motif de blocage obligatoire' });
      }
      const validReasons = ['day_use', 'probleme_technique', 'depart_tardif', 'travaux'];
      if (!validReasons.includes(blockReason)) {
        return res.status(400).json({ error: 'Motif de blocage invalide' });
      }
    }

    room.housekeepingStatus = housekeepingStatus;
    room.blockReason = housekeepingStatus === 'bloquee' ? blockReason : null;
    await room.save();

    res.json({
      message: 'Statut mis à jour',
      room: {
        id: room._id,
        roomNumber: room.roomNumber,
        housekeepingStatus: room.housekeepingStatus,
        blockReason: room.blockReason
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoomsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['sale', 'nettoyage_en_cours', 'propre', 'controlee', 'bloquee'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const rooms = await Room.find({ housekeepingStatus: status, isActive: true });

    res.json({
      status,
      count: rooms.length,
      rooms: rooms.map(room => ({
        id: room._id,
        roomNumber: room.roomNumber,
        category: room.category,
        floor: room.floor,
        blockReason: room.blockReason
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
