const mongoose = require('mongoose');

const folioSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  folioType: {
    type: String,
    enum: ['A', 'B'],
    required: true
  },
  label: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'transferred'],
    default: 'open'
  },
  visibleItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FolioItem'
  }],
  totalAmount: {
    type: Number,
    default: 0
  },
  closedAt: Date
}, { timestamps: true });

folioSchema.index({ bookingId: 1, folioType: 1 });

module.exports = mongoose.model('Folio', folioSchema);
