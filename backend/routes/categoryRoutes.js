const express = require("express");
const router = express.Router();
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    updateCategoryStatus
} = require("../controllers/categoryController");

// Category routes
router.get("/", getAllCategories);
router.post("/", createCategory);

router.get("/:id", getCategoryById);
router.put("/:id", updateCategory);

router.patch("/:id/status", updateCategoryStatus);

module.exports = router;
