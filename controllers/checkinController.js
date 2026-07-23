const { eq, and, inArray, sql } = require('drizzle-orm');
const db = require('../config/database');
const roomsTable = require('../schema/rooms');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');
const housekeepingClient = require('../src/services/housekeepingClient');
const tarificationClient = require('../src/services/tarificationClient');
const reservationsClient = require('../src/services/reservationsClient');

exports.processCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await reservationsClient.getBookingById(bookingId);

    if (booking.locked) {
      return res.status(400).json({ error: 'Check-in impossible. Dossier verrouillé après check-out.' });
    }

    const allowedStatuses = ['status_confirmed', 'status_voucher'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({ error: `Check-in impossible. Statut actuel: ${booking.status}` });
    }

    const roomNumber = booking.room?.number;
    if (!roomNumber) {
      return res.status(404).json({ error: 'Chambre introuvable dans la réservation' });
    }

    let freshRoomStatus;
    try {
      freshRoomStatus = await housekeepingClient.getRoomStatusByNumero(roomNumber, req.headers.authorization);
    } catch (err) {
      return res.status(503).json({
        error: `Impossible de vérifier le statut de la chambre côté housekeeping: ${err.message}`,
      });
    }

    if (freshRoomStatus.statut !== 'controlee' && freshRoomStatus.statut !== 'propre') {
      return res.status(400).json({ error: `Chambre non prête. Statut: ${freshRoomStatus.statut}` });
    }

    try {
      await housekeepingClient.updateRoomStatusByNumero(roomNumber, 'sale', null, req.headers.authorization);
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
            category: booking.room?.category,
            seasonId,
            regime: booking.regime || 'BB',
            nights,
          }, req.headers.authorization);

          const prixNet = result?.details?.prixParNuitFinalTTC;
          if (prixNet && result.details.source === 'tarif_partenaire') {
            const newRate = parseFloat(prixNet);
            const currentRate = booking.roomRate || 0;
            if (newRate !== currentRate) {
              await reservationsClient.updateBookingFields(bookingId, { roomRate: newRate });
              booking.roomRate = newRate;
            }
          }
        }
      } catch (err) {
        console.warn('[TARIFICATION] Échec calcul tarif partenaire, fallback tarif public:', err.message);
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    await reservationsClient.updateBookingStatus(bookingId, 'status_checked_in');
    await reservationsClient.updateBookingFields(bookingId, { actualCheckIn: new Date(today) });

    const customer = booking.customer || null;
    const guestLastName = booking.guest?.lastName || '';
    const guestFirstName = booking.guest?.firstName || '';

    const [folioA] = await db
      .insert(foliosTable)
      .values({
        bookingId,
        bookingRef: booking.reference || null,
        billToPartnerId: booking.billToPartnerId || null,
        billToLabel: booking.billToLabel || null,
        folioType: 'A',
        label: `Folio Client - ${customer ? `${customer.firstName || guestFirstName} ${customer.lastName || guestLastName}` : `${guestFirstName} ${guestLastName}`}`,
        status: 'open'
      })
      .returning();

    const [folioB] = await db
      .insert(foliosTable)
      .values({
        bookingId,
        bookingRef: booking.reference || null,
        billToPartnerId: booking.billToPartnerId || null,
        billToLabel: booking.billToLabel || null,
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
        id: booking._id,
        status: 'status_checked_in',
        actualCheckIn: today,
        room: roomNumber
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

    const booking = await reservationsClient.getBookingById(bookingId);

    const roomNumber = booking.room?.number || null;
    const roomCategory = booking.room?.category || null;

    res.json({
      booking: {
        id: booking._id,
        ref: booking.reference,
        status: booking.status,
        customer: booking.customer || null,
        guest: booking.guest || null,
        room: {
          roomNumber,
          category: roomCategory,
        },
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        pax: booking.pax,
        regime: booking.regime,
        roomRate: booking.roomRate,
        estimatedTotal: booking.estimatedTotal,
        deposit: booking.deposit,
        comments: booking.comments,
        marketSegment: booking.marketSegment || null,
        billToPartnerId: booking.billToPartnerId,
        billToLabel: booking.billToLabel,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProforma = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await reservationsClient.getBookingById(bookingId);

    const allowedStatuses = ['status_option', 'status_confirmed', 'status_voucher'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({ error: `Pro-forma indisponible. Statut actuel: ${booking.status}` });
    }

    const roomNumber = booking.room?.number || null;
    const guestLastName = booking.guest?.lastName || '';
    const guestFirstName = booking.guest?.firstName || '';

    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    const nights = Math.max(0, Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    const roomRate = booking.roomRate || 0;
    const estimatedRoomAmount = roomRate * nights;
    const deposit = booking.deposit?.amount || 0;
    const balanceDue = estimatedRoomAmount - deposit;

    res.json({
      bookingId: booking._id,
      bookingRef: booking.reference,
      status: booking.status,
      customer: booking.customer || null,
      guest: {
        firstName: guestFirstName,
        lastName: guestLastName,
      },
      room: {
        roomNumber,
        category: booking.room?.category,
      },
      stay: {
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        nights,
        pax: booking.pax,
        regime: booking.regime,
      },
      pricing: {
        roomRate,
        estimatedRoomAmount,
        deposit,
        balanceDue
      },
      notes: {
        mode: 'dynamic',
        source: 'service-reservations'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await reservationsClient.getBookingById(bookingId);

    if (booking.status !== 'status_checked_in') {
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

    const roomNumber = booking.room?.number;
    if (!roomNumber) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    try {
      await housekeepingClient.updateRoomStatusByNumero(roomNumber, 'propre', null, req.headers.authorization);
    } catch (err) {
      return res.status(502).json({ error: `Impossible de synchroniser le statut de la chambre: ${err.message}` });
    }

    await reservationsClient.updateBookingStatus(bookingId, 'status_confirmed');
    await reservationsClient.updateBookingFields(bookingId, { actualCheckIn: null });

    if (folioIds.length > 0) {
      await db.delete(foliosTable).where(eq(foliosTable.bookingId, bookingId));
    }

    res.json({ message: 'Check-in annulé avec succès', booking: { id: booking._id, status: 'status_confirmed' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
