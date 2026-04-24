const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a product name"],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, "Please add a SKU"],
      unique: true,
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
      default: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Please select a category"],
    },
    unit: {
      type: String,
      enum: ["pcs", "kg", "ltr", "box", "pkt"],
      default: "pcs",
    },
    minStockLevel: {
      type: Number,
      default: 0,
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
