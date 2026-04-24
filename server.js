require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const connectDB = require("./src/config/db");

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => res.send("ZEPOBIZ SaaS Backend is Running"));
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/inventory", require("./src/routes/inventoryRoutes"));
app.use("/api/whatsapp", require("./src/routes/whatsappRoutes"));

// DATA MIGRATION - Runs once on connection
const migrateData = async () => {
  try {
    const BotCustomer = require("./src/models/BotCustomer");
    const Customer = require("./src/models/Customer");
    const Outward = require("./src/models/Outward");

    // 1. Sync Customers
    const botCustomers = await BotCustomer.find();
    for (let bc of botCustomers) {
      const existing = await Customer.findOne({ tenantId: bc.tenantId, phone: bc.phone });
      if (!existing) {
        await Customer.create({
          tenantId: bc.tenantId,
          phone: bc.phone,
          name: bc.name || `WhatsApp User (+${bc.phone.slice(-4)})`,
          address: bc.address,
          source: 'bot'
        });
      }
    }

    // 2. Tag old orders
    await Outward.updateMany(
      { source: { $exists: false } }, 
      { $set: { source: 'bot' } }
    );
    
    console.log("✅ Server: Data Migration Check Complete.");
  } catch (err) {
    console.error("❌ Migration Error:", err.message);
  }
};

connectDB().then(() => {
  migrateData();
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 ZEPOBIZ Server Running on Port: ${PORT}`);
});
