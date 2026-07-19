const { eq, and, inArray, sql } = require('drizzle-orm');
const db = require('../config/database');
const bookingsTable = require('../schema/bookings');
const roomsTable = require('../schema/rooms');
const customersTable = require('../schema/customers');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');

exports.processCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db
      .select({
        id: bookingsTable.id,
        bookingRef: bookingsTable.bookingRef,
        status: bookingsTable.status,
        roomId: bookingsTable.roomId,
        customerId: bookingsTable.customerId,
        checkInDate: bookingsTable.checkInDate,
        checkOutDate: bookingsTable.checkOutDate,
        optionExpiryDate: bookingsTable.optionExpiryDate,
        roomRate: bookingsTable.roomRate,
        billToPartnerId: bookingsTable.billToPartnerId,
        billToLabel: bookingsTable.billToLabel,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'confirmed' && booking.status !== 'voucher') {
      return res.status(400).json({ error: `Check-in impossible. Statut actuel: ${booking.status}` });
    }

    if (booking.status === 'option' && (!booking.optionExpiryDate || new Date(booking.optionExpiryDate) < new Date())) {
      return res.status(400).json({ error: 'Option expirée. Réservation non confirmée.' });
    }

    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, booking.roomId))
      .limit(1);

    if (!room) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    if (room.housekeepingStatus !== 'controlee' && room.housekeepingStatus !== 'propre') {
      return res.status(400).json({ error: `Chambre non prête. Statut: ${room.housekeepingStatus}` });
    }

    const today = new Date().toISOString().slice(0, 10);

    await db
      .update(bookingsTable)
      .set({ status: 'checked_in', actualCheckIn: today, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    await db
      .update(roomsTable)
      .set({ housekeepingStatus: 'sale', updatedAt: new Date() })
      .where(eq(roomsTable.id, booking.roomId));

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, booking.customerId))
      .limit(1);

    const [folioA] = await db
      .insert(foliosTable)
      .values({
        bookingId,
        folioType: 'A',
        label: `Folio Client - ${customer ? `${customer.firstName} ${customer.lastName}` : ''}`,
        status: 'open'
      })
      .returning();

    let folioB = null;
    if (booking.billToPartnerId) {
      [folioB] = await db
      .insert(foliosTable)
      .values({
        bookingId,
        folioType: 'B',
        label: `Folio Prise en charge - ${booking.billToLabel || booking.billToPartnerId}`,
        status: 'open'
    })
    .returning();
}

    res.json({
      message: 'Check-in effectué avec succès',
      booking: {
        id: booking.id,
        status: 'checked_in',
        actualCheckIn: today,
        room: room.roomNumber
      },
      folios: {
        folioA: { id: folioA.id, type: 'A' },
        folioB: folioB ? { id: folioB.id, type: 'B' } : null
      }
    });
 } catch (err) {
  console.error('ERREUR CHECK-IN:', err.stack);
  res.status(500).json({ error: err.message });
}
};

exports.getCheckInDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, booking.customerId))
      .limit(1);

    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, booking.roomId))
      .limit(1);

    res.json({
      booking: {
        id: booking.id,
        ref: booking.bookingRef,
        status: booking.status,
        customer,
        room,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        adults: booking.adults,
        children: booking.children,
        boardType: booking.boardType,
        roomRate: booking.roomRate,
        totalAmount: booking.totalAmount,
        deposit: booking.deposit,
        specialRequests: booking.specialRequests,
        marketSegment: booking.marketSegment
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ error: 'Annulation impossible. Statut actuel: ' + booking.status });
    }

    const bookingFolios = await db
      .select({ id: foliosTable.id })
      .from(foliosTable)
      .where(eq(foliosTable.bookingId, bookingId));

    const folioIds = bookingFolios.map(f => f.id);

    if (folioIds.length > 0) {
      const [result] = await db
        .select({ count: sql`count(*)::int` })
        .from(folioItemsTable)
        .where(inArray(folioItemsTable.folioId, folioIds));

      if (result.count > 0) {
        return res.status(400).json({ error: 'Impossible d\'annuler. Des prestations ont été enregistrées sur le folio.' });
      }
    }

    await db
      .update(bookingsTable)
      .set({ status: 'confirmed', actualCheckIn: null, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    await db
      .update(roomsTable)
      .set({ housekeepingStatus: 'propre', updatedAt: new Date() })
      .where(eq(roomsTable.id, booking.roomId));

    if (folioIds.length > 0) {
      await db.delete(foliosTable).where(eq(foliosTable.bookingId, bookingId));
    }

    res.json({ message: 'Check-in annulé avec succès', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
