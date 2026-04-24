const express = require("express");
const router = express.Router();
const {
  getCategories, createCategory, updateCategory, deleteCategory,
  getProducts, createProduct, updateProduct, deleteProduct,
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse,
  createInward, getInwards, updateInward, deleteInward,
  createOutward, getOutwards, updateOutward, deleteOutward,
  getStockReport, deleteStock, getInventoryStats,
} = require("../controllers/inventoryController");
const { protect } = require("../middlewares/authMiddleware");

// Middleware to protect all inventory routes
router.use(protect);

// Categories
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Products
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Warehouses
router.get("/warehouses", getWarehouses);
router.post("/warehouses", createWarehouse);
router.put("/warehouses/:id", updateWarehouse);
router.delete("/warehouses/:id", deleteWarehouse);

// Transactions
router.post("/inward", createInward);
router.get("/inward", getInwards);
router.put("/inward/:id", updateInward);
router.delete("/inward/:id", deleteInward);

router.post("/outward", createOutward);
router.get("/outward", getOutwards);
router.put("/outward/:id", updateOutward);
router.delete("/outward/:id", deleteOutward);

// Reports & Stock Management
router.get("/stock", getStockReport);
router.delete("/stock/:id", deleteStock);
router.get("/stats", getInventoryStats);

module.exports = router;
