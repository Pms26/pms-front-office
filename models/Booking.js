const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingRef: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  agencyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    default: null
  },
  status: {
    type: String,
    enum: ['option', 'confirmed', 'voucher', 'checked_in', 'checked_out', 'no_show', 'cancelled'],
    default: 'option'
  },
  optionExpiryDate: {
    type: Date,
    default: null
  },
  checkInDate: {
    type: Date,
    required: true
  },
  checkOutDate: {
    type: Date,
    required: true
  },
  actualCheckIn: Date,
  actualCheckOut: Date,
  adults: {
    type: Number,
    default: 1
  },
  children: {
    type: Number,
    default: 0
  },
  boardType: {
    type: String,
    enum: ['bb', 'dp', 'pc'],
    default: 'bb'
  },
  roomRate: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  deposit: {
    type: Number,
    default: 0
  },
  depositDueDate: Date,
  taxesAtReservation: {
    type: Boolean,
    default: true
  },
  specialRequests: String,
  cancellationPolicy: String,
  marketSegment: {
    type: String,
    enum: [
      'direct_walk_in', 'direct_phone_mail', 'direct_website',
      'ota_booking', 'ota_expedia', 'ota_hotels', 'ota_agoda', 'ota_airbnb',
      'b2b_agency', 'b2b_corporate'
    ],
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

bookingSchema.index({ status: 1, checkInDate: 1 });
bookingSchema.index({ roomId: 1, checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ customerId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
