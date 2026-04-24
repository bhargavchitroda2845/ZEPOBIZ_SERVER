const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Outward = require('../models/Outward');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const BotCustomer = require('../models/BotCustomer');
const { sendDocument } = require('./whatsappService');

const createOrderFromBot = async (tenantId, customerPhone, orderData, account) => {
  try {
    // 0. Anti-Duplicate Check (Check if same order created in last 2 mins)
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingOrder = await Outward.findOne({
      tenant: tenantId,
      customer: customerPhone,
      createdAt: { $gte: twoMinsAgo }
    }).populate('product');

    if (existingOrder && existingOrder.product.name.toLowerCase().includes(orderData.product.toLowerCase())) {
      console.log('⚠️ Duplicate order detected! Skipping...');
      return { duplicate: true };
    }

    // 1. Find Product
    console.log(`🔍 Searching for product: "${orderData.product}"...`);
    const product = await Product.findOne({ 
      tenant: tenantId, 
      name: { $regex: orderData.product, $options: 'i' } 
    });

    if (!product) {
      console.log('❌ Order Failed: Product not found in database.');
      return null;
    }

    // 2. Find a Warehouse
    const warehouse = await Warehouse.findOne({ tenant: tenantId, isActive: true });
    if (!warehouse) {
      console.log('❌ Order Failed: No active warehouse found in ZEPOBIZ.');
      return null;
    }

    // 3. Create Outward Record
    const orderNumber = `WA-${Date.now().toString().slice(-6)}`;
    console.log(`📝 Creating Outward record for ${orderNumber}...`);
    const outward = await Outward.create({
      tenant: tenantId,
      product: product._id,
      warehouse: warehouse._id,
      quantity: orderData.quantity,
      customer: customerPhone,
      orderNumber,
      status: 'Packing',
      source: 'bot'
    });


    console.log('✅ Order saved to database!');
    
    // 🛑 PHASE 5: Sync Unified Customer Profile
    try {
      const Customer = require('../models/Customer');
      await Customer.findOneAndUpdate(
        { tenantId: tenantId, phone: customerPhone },
        { 
          $set: { 
            name: orderData.name || "WhatsApp Customer",
            address: orderData.address || "No address"
          },
          $setOnInsert: { source: 'bot' },
          $inc: { totalOrders: 1, totalSpend: (product.price * orderData.quantity) },
          lastPurchase: new Date()
        },
        { upsert: true, new: true }
      );


      // Also sync to BotCustomer (for session/bot specific data)
      await BotCustomer.findOneAndUpdate(
        { tenantId: tenantId, phone: customerPhone },
        { 
          $set: { address: orderData.address || "No address" },
          $inc: { totalOrders: 1, totalSpend: (product.price * orderData.quantity) },
          lastOrderDate: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (custErr) {
      console.error("❌ Failed to sync customer profiles:", custErr.message);
    }



    // 4. Generate PDF Invoice
    const invoicePath = await generateInvoice(outward, product, orderData.address);
    
    return outward;


  } catch (error) {
    console.error('Order Service Error:', error.message);
    throw error;
  }
};

const generateInvoice = async (order, product, address) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const filename = `invoice_${order.orderNumber}.pdf`;
      const filePath = path.join(__dirname, '../../uploads', filename);

      // Ensure directory exists
      if (!fs.existsSync(path.join(__dirname, '../../uploads'))) {
        fs.mkdirSync(path.join(__dirname, '../../uploads'), { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // PDF Content
      doc.fontSize(25).text('ZEPOBIZ INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Order Number: ${order.orderNumber}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Customer: ${order.customer}`);
      doc.text(`Address: ${address || 'Not provided'}`);
      doc.moveDown();
      doc.text('-------------------------------------------');
      doc.text(`Product: ${product.name}`);
      doc.text(`Quantity: ${order.quantity}`);
      doc.text(`Price per unit: ₹${product.price}`);
      doc.text(`Total Amount: ₹${product.price * order.quantity}`);
      doc.text('-------------------------------------------');
      doc.moveDown();
      doc.text('Thank you for shopping with us!', { align: 'center' });

      doc.end();
      stream.on('finish', () => resolve(filePath));
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { createOrderFromBot };
