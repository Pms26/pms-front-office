const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    sparse: true
  },
  phone: {
    type: String,
    trim: true
  },
  nationality: String,
  idType: {
    type: String,
    enum: ['cin', 'passport', 'other'],
    default: 'cin'
  },
  idNumber: String,
  dateOfBirth: Date,
  address: {
    street: String,
    city: String,
    country: String,
    zipCode: String
  },
  preferences: {
    type: [String],
    default: []
  },
  allergies: {
    type: [String],
    default: []
  },
  notes: {
    type: String,
    default: ''
  },
  isVip: {
    type: Boolean,
    default: false
  },
  totalStays: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

customerSchema.index({ lastName: 1, firstName: 1 });
customerSchema.index({ phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
