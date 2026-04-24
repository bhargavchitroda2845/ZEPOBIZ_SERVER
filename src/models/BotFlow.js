const mongoose = require('mongoose');

const botFlowSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  trigger: {
    type: String, // Keyword or pattern
    required: true
  },
  response: {
    type: String, // Text response
    required: true
  },
  type: {
    type: String,
    enum: ['exact', 'contains', 'regex'],
    default: 'exact'
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

module.exports = mongoose.model('BotFlow', botFlowSchema);
