const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  email: { type: String },
  source: { type: String, enum: ['bot', 'manual'], default: 'manual' },
  totalSpend: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  lastPurchase: { type: Date }
}, { timestamps: true });

customerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
