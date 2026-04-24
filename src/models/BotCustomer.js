const mongoose = require('mongoose');

const botCustomerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  phone: { type: String, required: true },
  name: { type: String, default: 'Customer' },
  address: { type: String, default: '' },
  
  // State Machine Fields
  state: { type: String, default: 'START' }, // START, SELECTION, QUANTITY, ADDRESS, CONFIRM
  tempOrder: { type: Object, default: {} },


  totalOrders: { type: Number, default: 0 },
  totalSpend: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now }
}, { timestamps: true });

// Unique per tenant + phone
botCustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.models.BotCustomer || mongoose.model('BotCustomer', botCustomerSchema);
