const mongoose = require('mongoose');

const folioItemSchema = new mongoose.Schema({
  folioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folio',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['accommodation', 'restaurant', 'bar', 'spa', 'activity', 'laundry', 'transfer', 'tax', 'other'],
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  taxRate: {
    type: Number,
    default: 0
  },
  isVisibleOnPrint: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

folioItemSchema.index({ folioId: 1 });

module.exports = mongoose.model('FolioItem', folioItemSchema);
