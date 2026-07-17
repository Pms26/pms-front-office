const { eq, and, asc } = require('drizzle-orm');
const db = require('../config/database');
const roomsTable = require('../schema/rooms');

exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.isActive, true))
      .orderBy(asc(roomsTable.floor), asc(roomsTable.roomNumber));

    res.json({
      count: rooms.length,
      rooms: rooms.map(room => ({
        id: room.id,
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
    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, req.params.roomId))
      .limit(1);

    if (!room) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    res.json({
      id: room.id,
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

    const [existing] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, roomId))
      .limit(1);

    if (!existing) {
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

    const [updated] = await db
      .update(roomsTable)
      .set({
        housekeepingStatus,
        blockReason: housekeepingStatus === 'bloquee' ? blockReason : null,
        updatedAt: new Date()
      })
      .where(eq(roomsTable.id, roomId))
      .returning();

    res.json({
      message: 'Statut mis à jour',
      room: {
        id: updated.id,
        roomNumber: updated.roomNumber,
        housekeepingStatus: updated.housekeepingStatus,
        blockReason: updated.blockReason
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

    const rooms = await db
      .select()
      .from(roomsTable)
      .where(and(eq(roomsTable.housekeepingStatus, status), eq(roomsTable.isActive, true)));

    res.json({
      status,
      count: rooms.length,
      rooms: rooms.map(room => ({
        id: room.id,
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
