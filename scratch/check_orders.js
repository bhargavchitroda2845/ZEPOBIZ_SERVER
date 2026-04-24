require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const Outward = require(path.join(process.cwd(), 'src/models/Outward'));

async function checkData() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const sourceCounts = await Outward.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    console.log('Order Source Counts:', sourceCounts);

    const missingSource = await Outward.find({ source: { $exists: false } }).countDocuments();
    console.log('Orders with MISSING source:', missingSource);

    process.exit();
}

checkData();
