const express = require("express");
const router = express.Router();
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    updateCategoryStatus
} = require("../controllers/categoryController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// Category routes
// Read operations: accessible by all authenticated roles (cashier, staff, owner)
router.get("/", authenticateToken, getAllCategories);
router.get("/:id", authenticateToken, getCategoryById);

// Write operations: strictly restricted to owner
router.post("/", authenticateToken, authorizeRoles("owner"), createCategory);
router.put("/:id", authenticateToken, authorizeRoles("owner"), updateCategory);
router.patch("/:id/status", authenticateToken, authorizeRoles("owner"), updateCategoryStatus);

module.exports = router;
