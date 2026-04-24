const mongoose = require("mongoose");

const inwardSchema = new mongoose.Schema(
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
    distributor: {
      type: String,
      required: true,
    },
    billNo: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Ordered", "Waiting for approval", "Dispatched from company", "Delivery by today", "Arrived"],
      default: "Arrived",
    },
    inwardDate: {
      type: Date,
      default: Date.now,
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Inward", inwardSchema);
