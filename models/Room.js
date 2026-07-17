const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['standard', 'superior', 'suite', 'lodge'],
    required: true
  },
  floor: {
    type: Number,
    required: true
  },
  bedType: {
    type: String,
    enum: ['single', 'double', 'twin', 'king'],
    required: true
  },
  maxOccupancy: {
    type: Number,
    required: true
  },
  housekeepingStatus: {
    type: String,
    enum: ['sale', 'nettoyage_en_cours', 'propre', 'controlee', 'bloquee'],
    default: 'propre'
  },
  blockReason: {
    type: String,
    enum: ['day_use', 'probleme_technique', 'depart_tardif', 'travaux', null],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
