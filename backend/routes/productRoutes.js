const express = require("express");
const router = express.Router();
const {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    updateProductStatus
} = require("../controllers/productController");

// Product routes
router.get("/", getAllProducts);
router.post("/", createProduct);

router.get("/:id", getProductById);
router.put("/:id", updateProduct);

router.patch("/:id/status", updateProductStatus);

module.exports = router;
