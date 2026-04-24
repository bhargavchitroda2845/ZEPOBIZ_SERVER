require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const Outward = require(path.join(process.cwd(), 'src/models/Outward'));

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await Outward.updateMany({}, { $set: { source: 'bot' } });
    console.log(`✅ Migrated ${result.modifiedCount} orders to bot source.`);
    process.exit();
}

migrate();
