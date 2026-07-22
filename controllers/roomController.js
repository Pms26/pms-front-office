const { eq, and, asc } = require('drizzle-orm');
const { updateRoomStatusByNumero } = require('../src/services/housekeepingClient');
const db = require('../config/database');
const roomsTable = require('../schema/rooms');
const { resolveRoomLookup } = require('../utils/roomIdentifier');

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
    const lookup = resolveRoomLookup(roomId);

    if (!lookup) {
      return res.status(400).json({ error: 'Identifiant de chambre invalide' });
    }

    const column = lookup.column === 'id' ? roomsTable.id : roomsTable.roomNumber;
    const condition = lookup.column === 'id' ? eq(column, lookup.value) : eq(column, lookup.value);

    const [existing] = await db
      .select()
      .from(roomsTable)
      .where(condition)
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

    const authToken = req.headers.authorization || req.headers.Authorization;
    const payload = await updateRoomStatusByNumero(
      existing.roomNumber,
      housekeepingStatus,
      housekeepingStatus === 'bloquee' ? blockReason : null,
      authToken
    );

    const room = {
      id: existing.id || payload._id || payload.id || null,
      roomNumber: existing.roomNumber || payload.numero || payload.roomNumber || null,
      housekeepingStatus: payload.statut || payload.housekeepingStatus || housekeepingStatus,
      blockReason: payload.motifBlocage || payload.blockReason || (housekeepingStatus === 'bloquee' ? blockReason : null)
    };

    return res.json({ message: 'Statut mis à jour', room });
  } catch (err) {
    const status = err?.status || 502;
    const message = err instanceof Error ? err.message : 'Erreur interne du serveur';
    return res.status(status).json({ error: message });
  }
};

exports.updateStatusByNumero = async (req, res) => {
  try {
    const { numero } = req.params;
    const { housekeepingStatus, blockReason } = req.body;

    const [existing] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.roomNumber, numero))
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

    const authToken = req.headers.authorization || req.headers.Authorization;
    const payload = await updateRoomStatusByNumero(
      numero,
      housekeepingStatus,
      housekeepingStatus === 'bloquee' ? blockReason : null,
      authToken
    );

    const room = {
      id: existing.id || payload._id || payload.id || null,
      roomNumber: existing.roomNumber || payload.numero || payload.roomNumber || null,
      housekeepingStatus: payload.statut || payload.housekeepingStatus || housekeepingStatus,
      blockReason: payload.motifBlocage || payload.blockReason || (housekeepingStatus === 'bloquee' ? blockReason : null)
    };

    return res.json({ message: 'Statut mis à jour', room });
  } catch (err) {
    const status = err?.status || 502;
    const message = err instanceof Error ? err.message : 'Erreur interne du serveur';
    return res.status(status).json({ error: message });
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
