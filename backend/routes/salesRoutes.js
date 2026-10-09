const express = require("express");
const router = express.Router();
const {
    createSale,
    getSaleById,
    getAllSales
} = require("../controllers/salesController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// POST /api/sales - Create a bill (strictly Cashier only)
router.post("/", authenticateToken, authorizeRoles("cashier"), createSale);

// GET /api/sales - List sales with pagination (Owner: all, Cashier: own, Staff: forbidden)
router.get("/", authenticateToken, getAllSales);

// GET /api/sales/:id - Sale details (Owner: any, Cashier: own, Staff: forbidden)
router.get("/:id", authenticateToken, getSaleById);

module.exports = router;
