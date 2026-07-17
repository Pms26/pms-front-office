const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Folio = require('../models/Folio');
const FolioItem = require('../models/FolioItem');
const Payment = require('../models/Payment');

exports.processCheckOut = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { payments } = req.body;

    const booking = await Booking.findById(bookingId).populate('roomId').populate('customerId');
    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ error: `Check-out impossible. Statut actuel: ${booking.status}` });
    }

    const folios = await Folio.find({ bookingId: booking._id });

    let totalCharges = 0;
    let totalPaid = 0;

    for (const folio of folios) {
      const items = await FolioItem.find({ folioId: folio._id });
      const folioTotal = items.reduce((sum, item) => sum + item.totalAmount, 0);
      totalCharges += folioTotal;
    }

    if (!payments || payments.length === 0) {
      return res.status(400).json({ error: 'Aucun mode de paiement sélectionné' });
    }

    const validMethods = ['cb', 'esp', 'chq', 'virement', 'debiteur'];
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

      await Payment.create({
        bookingId: booking._id,
        folioId: folio._id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        cardType: payment.cardType || null,
        reference: payment.reference || null,
        receivedBy: req.user?.id || null
      });
    }

    booking.status = 'checked_out';
    booking.actualCheckOut = new Date();
    await booking.save();

    for (const folio of folios) {
      folio.status = 'closed';
      folio.closedAt = new Date();
      await folio.save();
    }

    const room = await Room.findById(booking.roomId._id);
    if (room) {
      room.housekeepingStatus = 'sale';
      room.blockReason = null;
      await room.save();
    }

    const totalDeposit = booking.deposit || 0;
    const remainingBalance = totalCharges - totalPaid - totalDeposit;

    res.json({
      message: 'Check-out effectué avec succès',
      booking: {
        id: booking._id,
        status: booking.status,
        actualCheckOut: booking.actualCheckOut,
        room: room.roomNumber
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

    const booking = await Booking.findById(bookingId)
      .populate('customerId')
      .populate('roomId');

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'checked_in' && booking.status !== 'checked_out') {
      return res.status(400).json({ error: 'Extrait disponible uniquement pour les séjours en cours ou terminés' });
    }

    const folios = await Folio.find({ bookingId: booking._id });

    const foliosWithItems = await Promise.all(
      folios.map(async (folio) => {
        const items = await FolioItem.find({ folioId: folio._id }).sort({ date: 1 });
        return {
          id: folio._id,
          type: folio.folioType,
          label: folio.label,
          status: folio.status,
          items: items.map(item => ({
            id: item._id,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
            taxRate: item.taxRate,
            isVisibleOnPrint: item.isVisibleOnPrint,
            date: item.date
          })),
          totalAmount: items.reduce((sum, item) => sum + item.totalAmount, 0)
        };
      })
    );

    const payments = await Payment.find({ bookingId: booking._id });

    res.json({
      booking: {
        ref: booking.bookingRef,
        customer: `${booking.customerId.firstName} ${booking.customerId.lastName}`,
        room: booking.roomId.roomNumber,
        checkIn: booking.actualCheckIn,
        checkOut: booking.actualCheckOut || null,
        nights: Math.ceil((booking.checkOutDate - booking.checkInDate) / (1000 * 60 * 60 * 24))
      },
      folios: foliosWithItems,
      payments: payments.map(p => ({
        amount: p.amount,
        method: p.paymentMethod,
        date: p.processedAt
      })),
      totalCharges: foliosWithItems.reduce((sum, f) => sum + f.totalAmount, 0),
      totalPaid: payments.reduce((sum, p) => sum + p.amount, 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
