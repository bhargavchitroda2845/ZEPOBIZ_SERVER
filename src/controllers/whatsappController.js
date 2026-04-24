const { sendMessage, downloadMedia } = require('../services/whatsappService');
const ChatMessage = require('../models/ChatMessage');
const WhatsAppAccount = require('../models/WhatsAppAccount');
const BotFlow = require('../models/BotFlow');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const BotCustomer = require('../models/BotCustomer');
const Customer = require('../models/Customer');
const Outward = require('../models/Outward');
const { createOrderFromBot } = require('../services/orderService');
const { generateReply } = require('../services/aiService');
const mongoose = require('mongoose');

// De-duplication cache
const processedMessages = new Set();
setInterval(() => processedMessages.clear(), 60000); // Clear every minute

// --- 7-STEP SALES MACHINE ---
const handleWebhook = async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);
    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value || !value.messages) return res.sendStatus(200);

    const message = value.messages[0];
    const messageId = message.id;

    // 🛑 De-duplication check
    if (processedMessages.has(messageId)) {
      console.log(`⚠️ Skipping duplicate message: ${messageId}`);
      return res.status(200).send("OK");
    }
    processedMessages.add(messageId);
    const fromPhone = message.from;
    const text = (message.text?.body || message.image?.caption || "").trim();

    console.log(`\n--- 📩 INCOMING MESSAGE ---`);
    console.log(`From: ${fromPhone}`);
    console.log(`Message: ${text || "[No Text/Caption]"}`);
    if (message.type === 'image') console.log(`Type: IMAGE (media_id: ${message.image.id})`);
    console.log(`----------------------------\n`);

    const account = await WhatsAppAccount.findOne({ phoneNumberId: value.metadata.phone_number_id });

    if (!account) return res.sendStatus(200);
    const tenantId = account.tenantId?._id || account.tenantId;

    let customer = await BotCustomer.findOne({ tenantId, phone: fromPhone });
    if (!customer) {
      customer = await BotCustomer.create({ tenantId, phone: fromPhone, state: 'START' });
      await Customer.findOneAndUpdate(
        { tenantId, phone: fromPhone },
        { 
          $setOnInsert: { source: 'bot' },
          $set: { name: `WhatsApp User (+${fromPhone.slice(-4)})` } 
        },
        { upsert: true }
      );
    }

    let replyText = "";
    const input = text.toLowerCase();

    // --- IMAGE PROCESSING ---
    if (message.type === 'image') {
      const mediaId = message.image.id;
      const mediaData = await downloadMedia(account, mediaId);
      
      const products = await Product.find({ tenant: tenantId, isActive: true });
      const productList = products.map(p => `${p.name} (₹${p.price})`).join(', ');

      const aiResponse = await generateReply(text, {
        businessName: account.name || "Zepobiz Merchant",
        productList: productList,
        businessInfo: "We sell medical supplies like gloves and masks."
      }, [], mediaData);

      // Check if AI found an order
      if (aiResponse.includes('[[ORDER_CONFIRMED:')) {
        const orderData = JSON.parse(aiResponse.split('[[ORDER_CONFIRMED:')[1].split(']]')[0]);
        const extractedItems = orderData.items || [];
        
        const validItems = [];
        let summaryText = "📝 *ORDER EXTRACTED FROM IMAGE*\n------------------\n";
        let totalBill = 0;

        for (const item of extractedItems) {
          const matchedProduct = products.find(p => p.name.toLowerCase().includes(item.product.toLowerCase()));
          if (matchedProduct) {
            const itemTotal = matchedProduct.price * item.quantity;
            validItems.push({
              productId: matchedProduct._id,
              productName: matchedProduct.name,
              price: matchedProduct.price,
              quantity: item.quantity
            });
            summaryText += `📦 ${matchedProduct.name} x ${item.quantity} = ₹${itemTotal}\n`;
            totalBill += itemTotal;
          }
        }
        
        if (validItems.length > 0) {
          customer.tempOrder = { items: validItems, total: totalBill };
          customer.markModified('tempOrder');

          
          // Only update address if AI found a NEW one
          if (orderData.address) {
            customer.address = orderData.address;
          }

          // Check if we have an address now (either from AI or existing)
          if (!customer.address || customer.address === "Please provide address" || customer.address === "") {
            customer.state = 'ADDRESS';
            summaryText += `💰 *Total Bill: ₹${totalBill}*\n------------------\n\n📍 *Almost there!* Please send your *Delivery Address* to proceed.`;
          } else {
            customer.state = 'CONFIRM';
            summaryText += `💰 *Total Bill: ₹${totalBill}*\n📍 Address: ${customer.address}\n------------------\n\nType *CONFIRM* to place order or tell me what to change.`;
          }
          replyText = summaryText;
        } else {
          replyText = aiResponse.split('[[ORDER_CONFIRMED:')[0].trim();
        }
      } else {
        replyText = aiResponse;
      }
      
      // Save and Send
      customer.lastInteraction = new Date();
      await customer.save();

      console.log(`\n--- 🤖 BOT REPLY (IMAGE FLOW) ---`);
      console.log(`To: ${fromPhone}`);
      console.log(`Reply: ${replyText}`);
      console.log(`-------------------------------\n`);

      const sentResponse = await sendMessage(account, fromPhone, replyText);
      const sentMsgId = sentResponse?.messages?.[0]?.id || `out_${Date.now()}`;
      await ChatMessage.create({ tenantId, whatsappAccountId: account._id, whatsappId: sentMsgId, from: fromPhone, text: replyText, type: 'outgoing' });
      return res.status(200).send("OK");
    }

    // --- GLOBAL COMMANDS ---
    const isConfirm = input === 'confirm';
    const isCancel = input === 'cancel' || input === 'reset' || input === 'end chat' || input === 'stop';
    const isHistory = input.includes('history') || input.includes('my order') || input.includes('status');

    if (input === 'hi' || input === 'hello' || isCancel || isHistory) {
      if (isHistory) {
        console.log(`🔍 Fetching history for ${fromPhone}...`);
        const orders = await Outward.find({ customer: fromPhone, tenant: tenantId }).populate('product').sort({ createdAt: -1 }).limit(5);
        
        if (orders.length === 0) {
          replyText = "You haven't placed any orders yet. Type 'Hi' to see our products!";
        } else {
          replyText = "📜 *YOUR ORDER HISTORY*\n------------------\n";
          orders.forEach(o => {
            const date = new Date(o.createdAt).toLocaleDateString('en-IN');
            const statusEmoji = o.status === 'Delivered' ? '✅' : o.status === 'Dispatched' ? '🚚' : '📦';
            replyText += `#${o.orderNumber} | ${date}\n${statusEmoji} Status: *${o.status.toUpperCase()}*\n📦 Item: ${o.product?.name || 'Item'} x ${o.quantity}\n\n`;
          });
          replyText += "Type 'Hi' to start a new order.";
        }
        
        const sentResp = await sendMessage(account, fromPhone, replyText);
        const sentMsgId = sentResp?.messages?.[0]?.id || `out_${Date.now()}`;
        await ChatMessage.create({ tenantId, whatsappAccountId: account._id, whatsappId: sentMsgId, from: fromPhone, text: replyText, type: 'outgoing' });
        
        console.log(`✅ History sent to ${fromPhone}`);
        return res.sendStatus(200);
      }
      
      if (isCancel) {
        customer.tempOrder = {};
        customer.state = 'START';
        replyText = "Order cancelled. Say 'Hi' to start again.";
        await customer.save();
        await sendMessage(account, fromPhone, replyText);
        return res.sendStatus(200);
      }
      customer.state = 'START';
    }


    switch (customer.state) {
      case 'START':
        if (input.includes('hi') || input.includes('hello')) {
          replyText = `Hi there! Welcome to *Bhargav's Company*. 🏢\n\nHow can I assist you today?\n\nWe offer these products:\n🔹 *Nitrile Gloves*\n🔹 *Latex Gloves*\n🔹 *Face Masks*\n\nWhich one are you interested in?`;
          customer.state = 'SELECTION';
        } else {
          const products = await Product.find({ tenant: tenantId, isActive: true });
          const match = products.find(p => input.includes(p.name.toLowerCase()));
          if (match) {
            customer.tempOrder = { productId: match._id, productName: match.name, price: match.price };
            replyText = `Great! *${match.name}* are ₹${match.price}.\n\nHow many units do you need?`;
            customer.state = 'QUANTITY';
          } else {
            replyText = "Hello! Please say 'Hi' to start shopping.";
          }
        }
        break;

      case 'SELECTION':
        const productsList = await Product.find({ tenant: tenantId, isActive: true });
        const matchedProduct = productsList.find(p => input.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(input));
        
        if (matchedProduct) {
          customer.tempOrder = { productId: matchedProduct._id, productName: matchedProduct.name, price: matchedProduct.price };
          customer.markModified('tempOrder');
          replyText = `Excellent! *${matchedProduct.name}* are ₹${matchedProduct.price}.\n\nHow many units?`;
          customer.state = 'QUANTITY';
        } else {
          // 🛡️ Safe Selection
          const list = productsList.map(p => `🔹 ${p.name} (₹${p.price})`).join('\n');
          replyText = `Please select a product from our list:\n\n${list}\n\n(Or send a photo of your handwritten order!)`;
        }
        break;


      case 'QUANTITY':
        const qty = parseInt(text);
        if (!isNaN(qty) && qty > 0) {
          const stock = await Stock.findOne({ product: customer.tempOrder.productId });
          if (stock && stock.quantity >= qty) {
            customer.tempOrder.quantity = qty;
            customer.markModified('tempOrder'); // 🚀 Force Mongoose to save the new quantity
            replyText = `Got it! Please provide your *Full Name and Delivery Address*.`;
            customer.state = 'ADDRESS';
          } else {
            replyText = `Sorry, only ${stock ? stock.quantity : 0} units available. How many?`;
          }
        } else {
          // 🛡️ Check if user is trying to switch products instead of giving a number
          const allProducts = await Product.find({ tenant: tenantId, isActive: true });
          const productMatch = allProducts.find(p => input.includes(p.name.toLowerCase()));
          
          if (productMatch) {
            customer.tempOrder = { productId: productMatch._id, productName: productMatch.name, price: productMatch.price };
            customer.markModified('tempOrder'); // 🚀 Force save on switch
            replyText = `Switching to *${productMatch.name}* (₹${productMatch.price}).\n\nHow many units do you need?`;
            customer.state = 'QUANTITY';
          } else {
            replyText = "Please enter a valid number (e.g., 5) or tell me if you'd like a different product.";
          }
        }
        break;



      case 'ADDRESS':
        const addressInput = text;
        
        // 🛡️ Simple Verification (Save AI Quota)
        if (addressInput.split(' ').length < 3) {
           replyText = "📍 That looks like just a city or incomplete. Please provide your *Full House No., Street, and Area* for delivery.";
           break;
        }

        customer.address = addressInput;
        const tempOrder = customer.tempOrder || {};
        
        // Support both single item and multi-item (from image)
        const items = tempOrder.items || (tempOrder.productName ? [{ 
          productName: tempOrder.productName, 
          quantity: tempOrder.quantity || 0, 
          price: tempOrder.price || 0 
        }] : []);
        
        if (items.length === 0) {
          replyText = "Your cart is empty. Please select a product first.";
          customer.state = 'START';
          break;
        }

        let summaryText = "📝 *ORDER SUMMARY*\n------------------\n";
        let totalBill = 0;
        for (const item of items) {
          const itemTotal = (item.price || 0) * (item.quantity || 0);
          summaryText += `📦 ${item.productName} x ${item.quantity} = ₹${itemTotal}\n`;
          totalBill += itemTotal;
        }
        summaryText += `💰 *Total: ₹${totalBill}*\n📍 Address: ${addressInput}\n------------------\n\nType *CONFIRM* to place order.`;
        
        replyText = summaryText;
        customer.state = 'CONFIRM';
        break;



      case 'CONFIRM':
        if (input === 'confirm') {
          // Final safety check for address
          if (!customer.address || customer.address === "Please provide address" || customer.address === "") {
            replyText = "⚠️ *Address Missing!* Please provide your delivery address first.";
            customer.state = 'ADDRESS';
            break;
          }

          const items = customer.tempOrder.items || [{ productName: customer.tempOrder.productName, quantity: customer.tempOrder.quantity }];
          const orderIds = [];
          
          for (const item of items) {
            const order = await createOrderFromBot(
              tenantId, 
              fromPhone, 
              { 
                product: item.productName, 
                quantity: item.quantity, 
                address: customer.address 
              }
            );
            if (order && !order.duplicate) {
              orderIds.push(order._id.toString().slice(-6).toUpperCase());
            }
          }

          replyText = `🎉 *ORDER(S) PLACED!*\n\nOrder ID(s): #${orderIds.join(', #')}\n\nThank you for choosing us!`;
          customer.state = 'START';
          customer.tempOrder = {};
        } else if (input === 'cancel') {
          customer.state = 'START';
          customer.tempOrder = {};
          replyText = "Order cancelled. Type 'Hi' to start again.";
        } else {
          // Use AI to handle potential edits or questions
          const products = await Product.find({ tenant: tenantId, isActive: true });
          const productList = products.map(p => `${p.name} (₹${p.price})`).join(', ');
          
          const aiResponse = await generateReply(text, {
            businessName: account.name || "Zepobiz Merchant",
            productList: productList,
            businessInfo: "We sell medical supplies like gloves and masks."
          });

          if (aiResponse.includes('[[CHANGE_ADDRESS]]')) {
            customer.state = 'ADDRESS';
            replyText = aiResponse.split('[[CHANGE_ADDRESS]]')[0].trim() || "Sure! Please provide your new delivery address.";
          } else if (aiResponse.includes('[[ORDER_CONFIRMED:')) {
            const orderData = JSON.parse(aiResponse.split('[[ORDER_CONFIRMED:')[1].split(']]')[0]);
            const extractedItems = orderData.items || [];
            
            const validItems = [];
            let totalBill = 0;
            let summaryText = "📝 *ORDER UPDATED*\n------------------\n";

            for (const item of extractedItems) {
              const matchedProduct = products.find(p => p.name.toLowerCase().includes(item.product.toLowerCase()));
              if (matchedProduct) {
                const itemTotal = matchedProduct.price * item.quantity;
                validItems.push({
                  productId: matchedProduct._id,
                  productName: matchedProduct.name,
                  price: matchedProduct.price,
                  quantity: item.quantity
                });
                summaryText += `📦 ${matchedProduct.name} x ${item.quantity} = ₹${itemTotal}\n`;
                totalBill += itemTotal;
              }
            }
            
            if (validItems.length > 0) {
              customer.tempOrder = { items: validItems, total: totalBill };
              if (orderData.address) customer.address = orderData.address;
              
              summaryText += `💰 *Total: ₹${totalBill}*\n📍 Address: ${customer.address}\n------------------\n\nType *CONFIRM* to place order or tell me what to change.`;
              replyText = summaryText;
            } else {
              replyText = aiResponse.split('[[ORDER_CONFIRMED:')[0].trim();
            }
          } else {
            replyText = aiResponse;
          }

        }
        break;



      default:
        customer.state = 'START';
        replyText = "Hello! Type 'Hi' to start.";
    }

    customer.lastInteraction = new Date();
    await customer.save();

    console.log(`\n--- 🤖 BOT REPLY ---`);
    console.log(`To: ${fromPhone}`);
    console.log(`Reply: ${replyText}`);
    console.log(`---------------------\n`);

    const sentResponse = await sendMessage(account, fromPhone, replyText);
    const sentMsgId = sentResponse?.messages?.[0]?.id || `out_${Date.now()}`;

    await ChatMessage.create({ tenantId, whatsappAccountId: account._id, whatsappId: sentMsgId, from: fromPhone, text: replyText, type: 'outgoing' });
    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 FLOW ERROR:", err.stack);
    res.sendStatus(200);
  }
};

const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token === 'zepobiz_bot_verify') res.status(200).send(challenge);
  else res.sendStatus(403);
};

// --- CRM & SETTINGS FUNCTIONS ---
const updateSettings = async (req, res) => {
  try {
    const { phoneNumberId, accessToken, name } = req.body;
    let account = await WhatsAppAccount.findOne({ tenantId: req.user.tenant });
    if (account) {
      account.phoneNumberId = phoneNumberId;
      account.accessToken = accessToken;
      account.name = name;
      await account.save();
    } else {
      account = await WhatsAppAccount.create({ tenantId: req.user.tenant, phoneNumberId, accessToken, name });
    }
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getChats = async (req, res) => {
  try {
    const tenantId = new mongoose.Types.ObjectId(req.user.tenant);
    const chats = await ChatMessage.aggregate([
      { $match: { tenantId: tenantId } },
      { $sort: { createdAt: -1 } },
      { $group: { 
          _id: "$from", 
          lastMessage: { $first: "$text" }, 
          lastTimestamp: { $first: "$createdAt" } 
      } },
      { $sort: { lastTimestamp: -1 } }
    ]);
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.find({ tenantId: req.user.tenant, from: req.params.phone }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBotOrders = async (req, res) => {
  try {
    const orders = await Outward.find({ tenant: req.user.tenant, source: 'bot' })
      .populate('product')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBotCustomers = async (req, res) => {
  try {
    const tenantId = new mongoose.Types.ObjectId(req.user.tenant);
    const filterType = req.query.filter;
    
    let matchQuery = { tenantId: tenantId };
    if (filterType === 'bot') {
      matchQuery.source = 'bot';
    }

    const customers = await Customer.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "outwards",
          let: { phone: "$phone" },
          pipeline: [
            { $match: { $expr: { $and: [
                { $eq: ["$customer", "$$phone"] },
                { $eq: ["$tenant", tenantId] }
            ] } } },
            { $lookup: { from: "products", localField: "product", foreignField: "_id", as: "product" } },
            { $unwind: "$product" },
            { $sort: { createdAt: -1 } }
          ],
          as: "orders"
        }
      },
      {
        $addFields: {
          totalOrders: { $size: "$orders" },
          totalSpend: { $sum: { $map: { 
            input: "$orders", 
            as: "o", 
            in: { $multiply: ["$$o.quantity", "$$o.product.price"] } 
          } } },
          lastOrderDate: { $arrayElemAt: ["$orders.createdAt", 0] }
        }
      },
      { $sort: { lastInteraction: -1, updatedAt: -1 } }
    ]);

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, address, email } = req.body;
    const tenantId = req.user.tenant;

    const customer = await Customer.findOneAndUpdate(
      { tenantId, phone },
      { $set: { name, address, email, source: 'manual' } },
      { upsert: true, new: true }
    );

    await BotCustomer.findOneAndUpdate(
      { tenantId, phone },
      { $set: { address } },
      { upsert: true }
    );

    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { name, address, email, source } = req.body;
    const customer = await Customer.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.params.id), tenantId: req.user.tenant },
      { $set: { name, address, email, source } },
      { new: true }
    );
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const deleteCustomer = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const id = new mongoose.Types.ObjectId(req.params.id);
    
    // 🗑️ Delete from both collections to be safe
    const deleted = await Customer.findOneAndDelete({ _id: id, tenantId: tenantId });
    if (deleted) {
      await BotCustomer.findOneAndDelete({ phone: deleted.phone, tenantId: tenantId });
    }
    
    res.json({ message: "Customer and session data deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  handleWebhook, verifyWebhook, updateSettings, getChats, getMessages, getBotOrders, getBotCustomers, createCustomer, updateCustomer, deleteCustomer 
};
