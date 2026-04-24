const mongoose = require("mongoose");

const outwardSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    customer: {
      type: String,
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Packing", "Waiting for pickup", "Dispatched", "In transit", "Delivered"],
      default: "Delivered",
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    source: {
      type: String,
      enum: ["bot", "manual"],
      default: "manual",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Outward", outwardSchema);
