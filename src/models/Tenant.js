const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a company name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please add a company email"],
      unique: true,
    },
    plan: {
      type: String,
      enum: ["basic", "premium", "enterprise"],
      default: "basic",
    },
    address: {
      type: String,
    },
    logo: {
      type: String,
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

module.exports = mongoose.model("Tenant", tenantSchema);
