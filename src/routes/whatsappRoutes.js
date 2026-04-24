const express = require('express');
const router = express.Router();
const { 
  verifyWebhook, 
  handleWebhook, 
  updateSettings, 
  getChats, 
  getMessages, 
  getBotOrders, 
  getBotCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/whatsappController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

router.post('/settings', protect, updateSettings);
router.get('/chats', protect, getChats);
router.get('/messages/:phone', protect, getMessages);
router.get('/bot-orders', protect, getBotOrders);
router.get('/bot-customers', protect, getBotCustomers);

// Unified Customer CRUD
router.post('/customers', protect, createCustomer);
router.put('/customers/:id', protect, updateCustomer);
router.delete('/customers/:id', protect, deleteCustomer);

module.exports = router;
