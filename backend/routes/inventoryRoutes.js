const express = require("express");
const router = express.Router();
const {
    getInventory,
    getLowStockInventory,
    updateStock
} = require("../controllers/inventoryController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// GET /api/inventory/low-stock - View products at or below reorder level (Cashier, Staff, Owner)
router.get("/low-stock", authenticateToken, getLowStockInventory);

// GET /api/inventory - View all inventory details with optional filters (Cashier, Staff, Owner)
router.get("/", authenticateToken, getInventory);

// PATCH /api/inventory/:id/stock - Update product stock quantity (Staff and Owner only; Cashier forbidden)
router.patch("/:id/stock", authenticateToken, authorizeRoles("staff", "owner"), updateStock);

module.exports = router;
