const { eq, and, inArray, sql } = require('drizzle-orm');
const db = require('../config/database');
const bookingsTable = require('../schema/bookings');
const roomsTable = require('../schema/rooms');
const customersTable = require('../schema/customers');
const marketSegmentsTable = require('../schema/marketSegments');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');
const housekeepingClient = require('../src/services/housekeepingClient');
const tarificationClient = require('../src/services/tarificationClient');

exports.processCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const [booking] = await db
      .select({
        id: bookingsTable.id,
        bookingRef: bookingsTable.bookingRef,
        status: bookingsTable.status,
        locked: bookingsTable.locked,
        roomId: bookingsTable.roomId,
        customerId: bookingsTable.customerId,
        checkInDate: bookingsTable.checkInDate,
        checkOutDate: bookingsTable.checkOutDate,
        optionExpiryDate: bookingsTable.optionExpiryDate,
        roomRate: bookingsTable.roomRate,
        boardType: bookingsTable.boardType,
        billToPartnerId: bookingsTable.billToPartnerId,
        billToLabel: bookingsTable.billToLabel,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.locked) {
      return res.status(400).json({ error: 'Check-in impossible. Dossier verrouillé après check-out.' });
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

    // Vérification synchrone de la source d'autorité réelle (housekeeping) afin d'éviter
    // de baser le check-in sur un statut local obsolète. En cas d'échec réseau ou de timeout,
    // le check-in est refusé par prudence (fail-closed) pour préserver l'intégrité métier.
    let freshRoomStatus;
    try {
      freshRoomStatus = await housekeepingClient.getRoomStatusByNumero(room.roomNumber, req.headers.authorization);
    } catch (err) {
      return res.status(503).json({
        error: `Impossible de vérifier le statut de la chambre côté housekeeping: ${err.message}`,
      });
    }

    if (freshRoomStatus.statut !== 'controlee' && freshRoomStatus.statut !== 'propre') {
      return res.status(400).json({ error: `Chambre non prête. Statut: ${freshRoomStatus.statut}` });
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      await housekeepingClient.updateRoomStatusByNumero(room.roomNumber, 'sale', null, req.headers.authorization);
    } catch (err) {
      return res.status(502).json({ error: `Impossible de synchroniser le statut de la chambre: ${err.message}` });
    }

    if (booking.billToPartnerId) {
      try {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const nights = Math.max(1, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));

        const seasonId = await tarificationClient.resolveSeasonId(booking.checkInDate, req.headers.authorization);
        if (seasonId) {
          const result = await tarificationClient.calculateRate({
            partnerId: booking.billToPartnerId,
            category: room.category,
            seasonId,
            regime: booking.boardType || 'BB',
            nights,
          }, req.headers.authorization);

          const prixNet = result?.details?.prixParNuitFinalTTC;
          if (prixNet && result.details.source === 'tarif_partenaire') {
            const newRate = parseFloat(prixNet);
            const currentRate = parseFloat(booking.roomRate || 0);
            if (newRate !== currentRate) {
              await db
                .update(bookingsTable)
                .set({ roomRate: String(newRate), updatedAt: new Date() })
                .where(eq(bookingsTable.id, bookingId));
              booking.roomRate = String(newRate);
            }
          }
        }
      } catch (err) {
        console.warn('[TARIFICATION] Échec calcul tarif partenaire, fallback tarif public:', err.message);
      }
    }

    await db
      .update(bookingsTable)
      .set({ status: 'checked_in', actualCheckIn: today, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

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

    const [folioB] = await db
      .insert(foliosTable)
      .values({
        bookingId,
        folioType: 'B',
        label: booking.billToPartnerId
          ? `Folio Prise en charge - ${booking.billToLabel || booking.billToPartnerId}`
          : 'Folio Prise en charge - Aucun tiers payeur',
        status: 'open'
      })
      .returning();

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
        folioB: { id: folioB.id, type: 'B' }
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

    let marketSegmentLabel = null;
    if (booking.marketSegmentId) {
      const [segment] = await db
        .select()
        .from(marketSegmentsTable)
        .where(eq(marketSegmentsTable.id, booking.marketSegmentId))
        .limit(1);
      marketSegmentLabel = segment ? segment.label : null;
    }

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
        marketSegmentId: booking.marketSegmentId,
        marketSegmentLabel
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProforma = async (req, res) => {
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
        adults: bookingsTable.adults,
        children: bookingsTable.children,
        boardType: bookingsTable.boardType,
        roomRate: bookingsTable.roomRate,
        deposit: bookingsTable.deposit,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    const allowedStatuses = ['option', 'confirmed', 'voucher'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({ error: `Pro-forma indisponible. Statut actuel: ${booking.status}` });
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

    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    const roomRate = parseFloat(booking.roomRate || 0);
    const estimatedRoomAmount = roomRate * nights;
    const deposit = parseFloat(booking.deposit || 0);
    const balanceDue = estimatedRoomAmount - deposit;

    res.json({
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status,
      customer: customer ? {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName
      } : null,
      room: room ? {
        id: room.id,
        roomNumber: room.roomNumber
      } : null,
      stay: {
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        nights,
        adults: booking.adults,
        children: booking.children,
        boardType: booking.boardType
      },
      pricing: {
        roomRate,
        estimatedRoomAmount,
        deposit,
        balanceDue
      },
      notes: {
        mode: 'static',
        source: 'booking.roomRate'
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

    const [room] = await db
      .select({ roomNumber: roomsTable.roomNumber })
      .from(roomsTable)
      .where(eq(roomsTable.id, booking.roomId))
      .limit(1);

    if (!room) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    try {
      await housekeepingClient.updateRoomStatusByNumero(room.roomNumber, 'propre', null, req.headers.authorization);
    } catch (err) {
      return res.status(502).json({ error: `Impossible de synchroniser le statut de la chambre: ${err.message}` });
    }

    await db
      .update(bookingsTable)
      .set({ status: 'confirmed', actualCheckIn: null, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    if (folioIds.length > 0) {
      await db.delete(foliosTable).where(eq(foliosTable.bookingId, bookingId));
    }

    res.json({ message: 'Check-in annulé avec succès', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
