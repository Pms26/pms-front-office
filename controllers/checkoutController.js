const { eq, and, asc } = require('drizzle-orm');
const db = require('../config/database');
const bookingsTable = require('../schema/bookings');
const roomsTable = require('../schema/rooms');
const customersTable = require('../schema/customers');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');
const paymentsTable = require('../schema/payments');

exports.processCheckOut = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { payments } = req.body;

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'checked_in') {
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

    if (!payments || payments.length === 0) {
      return res.status(400).json({ error: 'Aucun mode de paiement sélectionné' });
    }

    const validMethods = ['cb', 'esp', 'chq', 'virement', 'debiteur'];
    let totalPaid = 0;
    for (const payment of payments) {
      if (!validMethods.includes(payment.paymentMethod)) {
        return res.status(400).json({ error: `Mode de paiement invalide: ${payment.paymentMethod}` });
      }
      totalPaid += payment.amount;
    }

    for (const payment of payments) {
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

    const today = new Date().toISOString().slice(0, 10);

    await db
      .update(bookingsTable)
      .set({ status: 'checked_out', actualCheckOut: today, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));

    for (const folio of folios) {
      await db
        .update(foliosTable)
        .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
        .where(eq(foliosTable.id, folio.id));
    }

    await db
      .update(roomsTable)
      .set({ housekeepingStatus: 'sale', blockReason: null, updatedAt: new Date() })
      .where(eq(roomsTable.id, booking.roomId));

    const totalDeposit = parseFloat(booking.deposit) || 0;
    const remainingBalance = totalCharges - totalPaid - totalDeposit;

    const [room] = await db
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, booking.roomId))
      .limit(1);

    res.json({
      message: 'Check-out effectué avec succès',
      booking: {
        id: booking.id,
        status: 'checked_out',
        actualCheckOut: today,
        room: room ? room.roomNumber : null
      },
      summary: {
        totalCharges,
        deposit: totalDeposit,
        totalPaid,
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

    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'checked_in' && booking.status !== 'checked_out') {
      return res.status(400).json({ error: 'Extrait disponible uniquement pour les séjours en cours ou terminés' });
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
        ref: booking.bookingRef,
        customer: customer ? `${customer.firstName} ${customer.lastName}` : '',
        room: room ? room.roomNumber : '',
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
