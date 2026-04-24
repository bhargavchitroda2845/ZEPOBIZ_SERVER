const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Tenant = require('./src/models/Tenant');
const Inward = require('./src/models/Inward');
const Outward = require('./src/models/Outward');
const Stock = require('./src/models/Stock');
const Product = require('./src/models/Product');
const Warehouse = require('./src/models/Warehouse');

dotenv.config();

const fixStock = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB...');

    const tenant = await Tenant.findOne();
    if (!tenant) {
      console.log('❌ No tenant found.');
      process.exit();
    }
    const tenantId = tenant._id;
    console.log(`🏢 Syncing stock for Tenant: ${tenant.name} (${tenantId})`);

    // 1. Ensure all Inwards are marked as "Arrived"
    const inwardResult = await Inward.updateMany(
      { tenant: tenantId, status: { $ne: "Arrived" } },
      { $set: { status: "Arrived" } }
    );
    console.log(`✅ Updated ${inwardResult.modifiedCount} Inward records to "Arrived".`);

    // 2. Clear and Recalculate Stock
    await Stock.deleteMany({ tenant: tenantId });
    console.log('🗑️ Cleared old stock records.');

    const products = await Product.find({ tenant: tenantId });
    const warehouses = await Warehouse.find({ tenant: tenantId });

    for (let p of products) {
      for (let w of warehouses) {
        const inwards = await Inward.find({ 
          product: p._id, 
          warehouse: w._id, 
          tenant: tenantId, 
          status: "Arrived" 
        });
        const outwards = await Outward.find({ 
          product: p._id, 
          warehouse: w._id, 
          tenant: tenantId 
        });
        
        const totalIn = inwards.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
        const totalOut = outwards.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
        const finalStock = totalIn - totalOut;

        if (finalStock > 0) {
          await Stock.create({
            product: p._id,
            warehouse: w._id,
            tenant: tenantId,
            quantity: finalStock
          });
          console.log(`📊 Stock Synced: ${p.name} at ${w.name} = ${finalStock}`);
        }
      }
    }

    console.log('🚀 STOCK FIX COMPLETE!');
    process.exit();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixStock();
