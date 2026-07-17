const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  folioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folio',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cb', 'esp', 'chq', 'virement', 'debiteur'],
    required: true
  },
  cardType: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'other', null],
    default: null
  },
  reference: String,
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

paymentSchema.index({ bookingId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
