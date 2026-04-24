const mongoose = require('mongoose');

const whatsappAccountSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  phoneNumberId: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true
  },
  name: {
    type: String
  },
  verifyToken: {
    type: String,
    default: 'zepobiz_bot_verify'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.WhatsappAccount || mongoose.model('WhatsappAccount', whatsappAccountSchema);
