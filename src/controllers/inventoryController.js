const Category = require("../models/Category");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const Stock = require("../models/Stock");
const Inward = require("../models/Inward");
const Outward = require("../models/Outward");
const WhatsAppAccount = require("../models/WhatsAppAccount");
const { sendMessage, sendDocument, uploadMedia } = require("../services/whatsappService");
const { generateInvoice } = require("../services/invoiceService");
const fs = require('fs');

// Helper function to sync stock for a tenant
const syncStockLevels = async (tenant) => {
  try {
    // 1. Mark legacy entries as Arrived
    await Inward.updateMany({ tenant, status: { $exists: false } }, { status: "Arrived" });

    const products = await Product.find({ tenant });
    const warehouses = await Warehouse.find({ tenant });

    for (let p of products) {
      for (let w of warehouses) {
        const inwards = await Inward.find({ 
          product: p._id, 
          warehouse: w._id, 
          tenant, 
          status: { $in: ["Arrived", null] } 
        });
        const outwards = await Outward.find({ product: p._id, warehouse: w._id, tenant });
        
        const totalIn = inwards.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
        const totalOut = outwards.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
        const finalStock = totalIn - totalOut;

        if (finalStock <= 0) {
          await Stock.deleteOne({ product: p._id, warehouse: w._id, tenant });
        } else {
          await Stock.findOneAndUpdate(
            { product: p._id, warehouse: w._id, tenant },
            { quantity: finalStock },
            { upsert: true }
          );
        }
      }
    }
    return true;
  } catch (error) {
    console.error("Stock Sync Error:", error);
    return false;
  }
};

// @desc    Get all categories with total stock
const getCategories = async (req, res) => {
  try {
    await syncStockLevels(req.user.tenant); // Ensure accurate counts
    const categories = await Category.find({ tenant: req.user.tenant }).lean();
    const products = await Product.find({ tenant: req.user.tenant }).lean();
    const stocks = await Stock.find({ tenant: req.user.tenant }).lean();

    const categoriesWithStock = categories.map(cat => {
      const catProducts = products.filter(p => String(p.category) === String(cat._id));
      const catStock = stocks.reduce((acc, s) => {
        const isProductInCat = catProducts.some(p => String(p._id) === String(s.product));
        return isProductInCat ? acc + Number(s.quantity || 0) : acc;
      }, 0);
      return { ...cat, totalStock: catStock };
    });

    res.json(categoriesWithStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    await syncStockLevels(req.user.tenant);
    const products = await Product.find({ tenant: req.user.tenant }).populate("category").lean();
    const stocks = await Stock.find({ tenant: req.user.tenant }).populate("warehouse").lean();

    const productsWithStock = products.map(p => {
      const pStocks = stocks.filter(s => String(s.product) === String(p._id));
      const totalStock = pStocks.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
      const breakdown = pStocks.map(s => ({
        warehouseName: s.warehouse?.name || "Unknown",
        quantity: s.quantity
      }));
      return { ...p, totalStock, breakdown };
    });

    res.json(productsWithStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getWarehouses = async (req, res) => {
  try {
    await syncStockLevels(req.user.tenant);
    const warehouses = await Warehouse.find({ tenant: req.user.tenant }).lean();
    const stocks = await Stock.find({ tenant: req.user.tenant }).populate("product").lean();

    const warehousesWithStock = warehouses.map(w => {
      const wStocks = stocks.filter(s => String(s.warehouse) === String(w._id));
      const totalStock = wStocks.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
      const breakdown = wStocks.map(s => ({
        productName: s.product?.name || "Unknown",
        sku: s.product?.sku || "N/A",
        quantity: s.quantity
      }));
      return { ...w, totalStock, breakdown };
    });

    res.json(warehousesWithStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const category = await Category.create({ name, description, tenant: req.user.tenant, createdBy: req.user._id });
    res.status(201).json(category);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate({ _id: req.params.id, tenant: req.user.tenant }, req.body, { new: true });
    res.json(category);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteCategory = async (req, res) => {
  try {
    await Category.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant });
    res.json({ message: "Category removed" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const createProduct = async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, tenant: req.user.tenant, createdBy: req.user._id });
    res.status(201).json(product);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate({ _id: req.params.id, tenant: req.user.tenant }, req.body, { new: true });
    res.json(product);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteProduct = async (req, res) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant });
    res.json({ message: "Product removed" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const createWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.create({ ...req.body, tenant: req.user.tenant });
    res.status(201).json(warehouse);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

const updateWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.findOneAndUpdate({ _id: req.params.id, tenant: req.user.tenant }, req.body, { new: true });
    res.json(warehouse);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteWarehouse = async (req, res) => {
  try {
    await Warehouse.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant });
    res.json({ message: "Warehouse removed" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const createInward = async (req, res) => {
  const { product, warehouse, quantity, status } = req.body;
  const numQty = Number(quantity);
  try {
    const inward = await Inward.create({ ...req.body, quantity: numQty, tenant: req.user.tenant, createdBy: req.user._id });
    if (status === "Arrived") {
      let stock = await Stock.findOne({ product, warehouse, tenant: req.user.tenant });
      if (stock) { stock.quantity = Number(stock.quantity) + numQty; await stock.save(); }
      else { await Stock.create({ product, warehouse, quantity: numQty, tenant: req.user.tenant }); }
    }
    res.status(201).json(inward);
  } catch (error) { res.status(400).json({ message: error.message }); }
};

const getInwards = async (req, res) => {
  try {
    const inwards = await Inward.find({ tenant: req.user.tenant }).populate("product").populate("warehouse").sort({ createdAt: -1 });
    res.json(inwards);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateInward = async (req, res) => {
  try {
    const oldInward = await Inward.findById(req.params.id);
    const newInward = await Inward.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    if ((!oldInward.status || oldInward.status !== "Arrived") && newInward.status === "Arrived") {
      let stock = await Stock.findOne({ product: newInward.product, warehouse: newInward.warehouse, tenant: req.user.tenant });
      if (stock) { stock.quantity = Number(stock.quantity) + Number(newInward.quantity); await stock.save(); }
      else { await Stock.create({ product: newInward.product, warehouse: newInward.warehouse, quantity: newInward.quantity, tenant: req.user.tenant }); }
    }
    else if ((oldInward.status === "Arrived" || !oldInward.status) && newInward.status !== "Arrived") {
      let stock = await Stock.findOne({ product: newInward.product, warehouse: newInward.warehouse, tenant: req.user.tenant });
      if (stock) { stock.quantity = Number(stock.quantity) - Number(oldInward.quantity); await stock.save(); }
    }
    
    res.json(newInward);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteInward = async (req, res) => {
  try {
    const inward = await Inward.findOne({ _id: req.params.id, tenant: req.user.tenant });
    if (inward && (inward.status === "Arrived" || !inward.status)) {
      let stock = await Stock.findOne({ product: inward.product, warehouse: inward.warehouse, tenant: req.user.tenant });
      if (stock) { stock.quantity = Math.max(0, Number(stock.quantity) - Number(inward.quantity)); await stock.save(); }
    }
    await Inward.deleteOne({ _id: req.params.id });
    res.json({ message: "Removed" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const createOutward = async (req, res) => {
  const { product, warehouse, quantity } = req.body;
  const numQty = Number(quantity);
  try {
    const stock = await Stock.findOne({ product, warehouse, tenant: req.user.tenant });
    if (!stock || Number(stock.quantity) < numQty) { return res.status(400).json({ message: "Insufficient stock" }); }
    const outward = await Outward.create({ ...req.body, quantity: numQty, tenant: req.user.tenant, createdBy: req.user._id });
    stock.quantity = Number(stock.quantity) - numQty; 
    await stock.save();

    // 🚀 Sync to Unified Customer Model
    try {
      const Customer = require("../models/Customer");
      await Customer.findOneAndUpdate(
        { tenantId: req.user.tenant, phone: req.body.customer }, // Using phone as key
        { 
          $set: { 
            name: req.body.customerName || req.body.customer || "Manual Customer",
            address: req.body.address || "",
          },
          $setOnInsert: { source: 'manual' },
          $inc: { totalOrders: 1, totalSpend: (product.price * numQty) },
          lastPurchase: new Date()
        },
        { upsert: true }
      );
    } catch (custErr) {
      console.error("❌ Failed to sync manual customer profile:", custErr.message);
    }

    res.status(201).json(outward);

  } catch (error) { res.status(400).json({ message: error.message }); }
};

const getOutwards = async (req, res) => {
  try {
    const outwards = await Outward.find({ tenant: req.user.tenant }).populate("product").populate("warehouse").sort({ createdAt: -1 });
    res.json(outwards);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateOutward = async (req, res) => {
  try {
    console.log(`📍 Update Outward API called for ID: ${req.params.id}`);
    
    // 🛡️ SECURITY: Prevent changing the 'source' or 'tenant' of an order during a status update
    const updateData = { ...req.body };
    delete updateData.source;
    delete updateData.tenant;
    delete updateData.customer; // Customer phone shouldn't change either

    const oldOutward = await Outward.findById(req.params.id);
    if (!oldOutward) return res.status(404).json({ message: "Order not found" });

    const newOutward = await Outward.findByIdAndUpdate(
      req.params.id, 
      { $set: updateData }, 
      { new: true }
    );

    // 🚀 WhatsApp Notification Logic
    if (newOutward.status !== oldOutward.status) {
      try {
        const tenantId = req.user.tenant._id || req.user.tenant;
        console.log(`🔄 Status changed for Order ${newOutward.orderNumber}. Fetching WhatsApp account for Tenant: ${tenantId}`);
        
        const account = await WhatsAppAccount.findOne({ tenantId });
        
        // Regex to check if customer is a phone number
        const isPhoneNumber = /^\d{10,15}$/.test(newOutward.customer?.replace(/\+/g, ''));

        if (account && isPhoneNumber) {
          const statusMap = {
            'Packing': '📦 PACKING',
            'Dispatched': '🚚 DISPATCHED',
            'Delivered': '✅ DELIVERED',
            'Cancelled': '❌ CANCELLED'
          };
          const displayStatus = statusMap[newOutward.status] || newOutward.status.toUpperCase();
          
          // 🔍 Fetch product details to show name in notification
          const product = await Product.findById(newOutward.product);
          const productName = product ? product.name : 'Your items';
          
          const messageText = `🔔 *ORDER UPDATE*\n\nHello! Your order *#${newOutward.orderNumber}* has been updated.\n\n📍 Status: *${displayStatus}*\n📦 Item: *${productName}*\n\nThank you for shopping with us!`;
          await sendMessage(account, newOutward.customer, messageText);
          console.log(`📱 Status notification sent to ${newOutward.customer}`);

          // 📄 INVOICE AUTOMATION: Send PDF if Delivered
          if (newOutward.status === 'Delivered') {
            try {
              console.log(`📄 Generating invoice for Order #${newOutward.orderNumber}...`);
              const pdfPath = await generateInvoice(newOutward, account.name || "ZEPOBIZ MERCHANT");
              
              const mediaId = await uploadMedia(account, pdfPath, `Invoice_${newOutward.orderNumber}.pdf`);
              await sendDocument(account, newOutward.customer, mediaId, `Invoice_${newOutward.orderNumber}.pdf`);
              
              console.log(`✅ Invoice sent successfully to ${newOutward.customer}`);
              
              // Cleanup: Delete the temp PDF file after sending
              if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
            } catch (invErr) {
              console.error("❌ Failed to generate/send invoice:", invErr.message);
            }
          }
        }

      } catch (waErr) {
        console.error("❌ Failed to send status notification:", waErr.message);
      }
    }


    res.json({ message: "Updated", outward: newOutward });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteOutward = async (req, res) => {
  try {
    const outward = await Outward.findOne({ _id: req.params.id, tenant: req.user.tenant });
    if (outward) {
      let stock = await Stock.findOne({ product: outward.product, warehouse: outward.warehouse, tenant: req.user.tenant });
      if (stock) { stock.quantity = Number(stock.quantity) + Number(outward.quantity); await stock.save(); }
    }
    await Outward.deleteOne({ _id: req.params.id });
    res.json({ message: "Removed" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getStockReport = async (req, res) => {
  try {
    await syncStockLevels(req.user.tenant); // FORCE SYNC BEFORE LOADING TABLE
    const { warehouse } = req.query;
    const products = await Product.find({ tenant: req.user.tenant }).populate("category").lean();
    const stocks = await Stock.find({ tenant: req.user.tenant }).populate("warehouse").lean();
    
    let report = [];

    if (warehouse) {
      const targetWh = await Warehouse.findById(warehouse);
      report = products.map(p => {
        const s = stocks.find(s => 
          String(s.product?._id || s.product) === String(p._id) && 
          String(s.warehouse?._id || s.warehouse) === String(warehouse)
        );
        return {
          _id: p._id,
          product: p,
          warehouse: targetWh || { name: "Selected Location" },
          quantity: s ? Number(s.quantity) : 0
        };
      });
    } else {
      report = products.map(p => {
        const pStocks = stocks.filter(s => String(s.product) === String(p._id) && Number(s.quantity) > 0);
        const total = pStocks.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
        
        let whDisplay = { name: "N/A" };
        if (pStocks.length === 1) { whDisplay = pStocks[0].warehouse; } 
        else if (pStocks.length > 1) { whDisplay = { name: "Multiple Locations" }; }

        return {
          _id: p._id,
          product: p,
          warehouse: whDisplay,
          quantity: total
        };
      });
    }

    res.json(report);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const deleteStock = async (req, res) => {
  try {
    await Stock.findOneAndDelete({ _id: req.params.id, tenant: req.user.tenant });
    res.json({ message: "Stock record cleared" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getInventoryStats = async (req, res) => {
  try {
    await syncStockLevels(req.user.tenant);
    const tenant = req.user.tenant;
    const products = await Product.countDocuments({ tenant });
    const warehouseCount = await Warehouse.countDocuments({ tenant });
    const stocks = await Stock.find({ tenant, quantity: { $gt: 0 } });
    const totalStock = stocks.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
    const lowStockItems = await Stock.find({ tenant, quantity: { $lt: 10, $gt: 0 } }).populate("product").populate("warehouse");
    const recentInward = await Inward.find({ tenant }).sort({ createdAt: -1 }).limit(5).populate("product");
    const recentOutward = await Outward.find({ tenant }).sort({ createdAt: -1 }).limit(5).populate("product");
    res.json({ totalProducts: products, totalStock, warehouses: warehouseCount, lowStockItems, recentActivity: { inward: recentInward, outward: recentOutward } });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = {
  getCategories, createCategory, updateCategory, deleteCategory,
  getProducts, createProduct, updateProduct, deleteProduct,
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  createInward, getInwards, updateInward, deleteInward,
  createOutward, getOutwards, updateOutward, deleteOutward,
  getStockReport, deleteStock, getInventoryStats,
};
