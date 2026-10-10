const express = require("express");
const router = express.Router();
const {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    updateProductStatus
} = require("../controllers/productController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// Product routes
// Read operations: accessible by all authenticated roles (cashier, staff, owner)
router.get("/", authenticateToken, getAllProducts);
router.get("/:id", authenticateToken, getProductById);

// Write operations: strictly restricted to owner
router.post("/", authenticateToken, authorizeRoles("owner"), createProduct);
router.put("/:id", authenticateToken, authorizeRoles("owner"), updateProduct);
router.patch("/:id/status", authenticateToken, authorizeRoles("owner"), updateProductStatus);

module.exports = router;
