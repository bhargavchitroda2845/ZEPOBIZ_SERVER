const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  whatsappAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsappAccount',
    required: true
  },
  whatsappId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple nulls if needed, but we will fill it
  },
  from: {
    type: String, // Customer phone number
    required: true
  },
  text: {
    type: String
  },
  type: {
    type: String,
    enum: ['incoming', 'outgoing'],
    required: true
  },
  mediaUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
