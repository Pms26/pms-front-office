const { eq, and, asc } = require('drizzle-orm');
const db = require('../config/database');
const roomsTable = require('../schema/rooms');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');
const paymentsTable = require('../schema/payments');
const housekeepingClient = require('../src/services/housekeepingClient');
const reservationsClient = require('../src/services/reservationsClient');

exports.processCheckOut = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { payments } = req.body;

    const booking = await reservationsClient.getBookingById(bookingId);

    if (booking.status !== 'status_checked_in') {
      return res.status(400).json({ error: `Check-out impossible. Statut actuel: ${booking.status}` });
    }

    const folios = await db
      .select()
      .from(foliosTable)
      .where(eq(foliosTable.bookingId, bookingId));

    let totalCharges = 0;

    for (const folio of folios) {
      const items = await db
        .select()
        .from(folioItemsTable)
        .where(eq(folioItemsTable.folioId, folio.id));
      const folioTotal = items.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0);
      totalCharges += folioTotal;
    }

    const previousPayments = await db
      .select({ amount: paymentsTable.amount })
      .from(paymentsTable)
      .where(eq(paymentsTable.bookingId, bookingId));

    const alreadyPaid = previousPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    const balanceDue = totalCharges - alreadyPaid;

    if ((!payments || payments.length === 0) && balanceDue !== 0) {
      return res.status(400).json({ error: 'Aucun mode de paiement sélectionné' });
    }

    const validMethods = ['cb', 'esp', 'chq', 'virement', 'debiteur'];
    for (const payment of payments || []) {
      if (!validMethods.includes(payment.paymentMethod)) {
        return res.status(400).json({ error: `Mode de paiement invalide: ${payment.paymentMethod}` });
      }
    }

    const requestedPaymentTotal = (payments || []).reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);

    if (Math.round(requestedPaymentTotal * 100) !== Math.round(balanceDue * 100)) {
      return res.status(400).json({ error: 'Le montant des paiements ne correspond pas au solde dû.' });
    }

    for (const payment of payments || []) {
      const folio = folios.find(f => f.folioType === (payment.folioType || 'A'));
      if (!folio) {
        return res.status(400).json({ error: `Folio ${payment.folioType || 'A'} introuvable` });
      }

      await db.insert(paymentsTable).values({
        bookingId,
        folioId: folio.id,
        amount: String(payment.amount),
        paymentMethod: payment.paymentMethod,
        cardType: payment.cardType || null,
        reference: payment.reference || null,
        processedAt: new Date()
      });
    }

    const roomNumber = booking.room?.number;

    try {
      await housekeepingClient.updateRoomStatusByNumero(roomNumber, 'sale', null, req.headers.authorization);
    } catch (err) {
      return res.status(502).json({ error: `Impossible de synchroniser le statut de la chambre: ${err.message}` });
    }

    await reservationsClient.updateBookingStatus(bookingId, 'status_checked_out');
    await reservationsClient.updateBookingFields(bookingId, {
      actualCheckOut: new Date(),
      locked: true,
    });

    for (const folio of folios) {
      await db
        .update(foliosTable)
        .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
        .where(eq(foliosTable.id, folio.id));
    }

    const totalDeposit = booking.deposit?.amount || 0;
    const remainingBalance = totalCharges - requestedPaymentTotal - totalDeposit;

    res.json({
      message: 'Check-out effectué avec succès',
      booking: {
        id: booking._id,
        status: 'status_checked_out',
        actualCheckOut: new Date().toISOString().slice(0, 10),
        room: roomNumber
      },
      summary: {
        totalCharges,
        deposit: totalDeposit,
        totalPaid: requestedPaymentTotal,
        remainingBalance
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStatement = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await reservationsClient.getBookingById(bookingId);

    if (booking.status !== 'status_checked_in' && booking.status !== 'status_checked_out') {
      return res.status(400).json({ error: 'Extrait disponible uniquement pour les séjours en cours ou terminés' });
    }

    const roomNumber = booking.room?.number || '';
    const guestLastName = booking.guest?.lastName || '';
    const guestFirstName = booking.guest?.firstName || '';

    const folios = await db
      .select()
      .from(foliosTable)
      .where(eq(foliosTable.bookingId, bookingId));

    const foliosWithItems = await Promise.all(
      folios.map(async (folio) => {
        const items = await db
          .select()
          .from(folioItemsTable)
          .where(eq(folioItemsTable.folioId, folio.id))
          .orderBy(asc(folioItemsTable.date));
        return {
          id: folio.id,
          type: folio.folioType,
          label: folio.label,
          status: folio.status,
          items: items.map(item => ({
            id: item.id,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
            taxRate: item.taxRate,
            isVisibleOnPrint: item.isVisibleOnPrint,
            date: item.date
          })),
          totalAmount: items.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0)
        };
      })
    );

    const paymts = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.bookingId, bookingId));

    res.json({
      booking: {
        ref: booking.reference,
        customer: `${guestFirstName} ${guestLastName}`.trim(),
        room: roomNumber,
        checkIn: booking.actualCheckIn,
        checkOut: booking.actualCheckOut || null,
        nights: Math.ceil((new Date(booking.checkOutDate) - new Date(booking.checkInDate)) / (1000 * 60 * 60 * 24))
      },
      folios: foliosWithItems,
      payments: paymts.map(p => ({
        amount: parseFloat(p.amount),
        method: p.paymentMethod,
        date: p.processedAt
      })),
      totalCharges: foliosWithItems.reduce((sum, f) => sum + f.totalAmount, 0),
      totalPaid: paymts.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
