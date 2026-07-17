const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Folio = require('../models/Folio');
const FolioItem = require('../models/FolioItem');

exports.processCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).populate('roomId').populate('customerId');
    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'confirmed' && booking.status !== 'voucher') {
      return res.status(400).json({ error: `Check-in impossible. Statut actuel: ${booking.status}` });
    }

    if (booking.status === 'option' && (!booking.optionExpiryDate || booking.optionExpiryDate < new Date())) {
      return res.status(400).json({ error: 'Option expirée. Réservation non confirmée.' });
    }

    const room = await Room.findById(booking.roomId._id);
    if (!room) {
      return res.status(404).json({ error: 'Chambre introuvable' });
    }

    if (room.housekeepingStatus !== 'controlee' && room.housekeepingStatus !== 'propre') {
      return res.status(400).json({ error: `Chambre non prête. Statut: ${room.housekeepingStatus}` });
    }

    booking.status = 'checked_in';
    booking.actualCheckIn = new Date();
    await booking.save();

    room.housekeepingStatus = 'sale';
    await room.save();

    const folioA = await Folio.create({
      bookingId: booking._id,
      folioType: 'A',
      label: `Folio Client - ${booking.customerId.firstName} ${booking.customerId.lastName}`,
      status: 'open'
    });

    let folioB = null;
    if (booking.agencyId) {
      folioB = await Folio.create({
        bookingId: booking._id,
        folioType: 'B',
        label: `Folio Agence - ${booking.agencyId}`,
        status: 'open'
      });
    }

    res.json({
      message: 'Check-in effectué avec succès',
      booking: {
        id: booking._id,
        status: booking.status,
        actualCheckIn: booking.actualCheckIn,
        room: room.roomNumber
      },
      folios: {
        folioA: { id: folioA._id, type: 'A' },
        folioB: folioB ? { id: folioB._id, type: 'B' } : null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCheckInDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .populate('customerId')
      .populate('roomId')
      .populate('agencyId');

    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    res.json({
      booking: {
        id: booking._id,
        ref: booking.bookingRef,
        status: booking.status,
        customer: booking.customerId,
        room: booking.roomId,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        adults: booking.adults,
        children: booking.children,
        boardType: booking.boardType,
        roomRate: booking.roomRate,
        totalAmount: booking.totalAmount,
        deposit: booking.deposit,
        specialRequests: booking.specialRequests,
        marketSegment: booking.marketSegment,
        agency: booking.agencyId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelCheckIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ error: 'Annulation impossible. Statut actuel: ' + booking.status });
    }

    const folioItems = await FolioItem.countDocuments({
      folioId: { $in: await Folio.find({ bookingId: booking._id }).distinct('_id') }
    });

    if (folioItems > 0) {
      return res.status(400).json({ error: 'Impossible d\'annuler. Des prestations ont été enregistrées sur le folio.' });
    }

    booking.status = 'confirmed';
    booking.actualCheckIn = null;
    await booking.save();

    const room = await Room.findById(booking.roomId);
    if (room) {
      room.housekeepingStatus = 'propre';
      await room.save();
    }

    await Folio.deleteMany({ bookingId: booking._id });

    res.json({ message: 'Check-in annulé avec succès', booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
