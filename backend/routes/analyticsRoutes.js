const express = require("express");
const router = express.Router();
const {
    getOverviewAnalytics,
    getSalesTrendAnalytics,
    getTopProductsAnalytics,
    getCashierPerformanceAnalytics
} = require("../controllers/analyticsController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

// All analytics endpoints require valid JWT authentication and 'owner' role
router.get("/overview", authenticateToken, authorizeRoles("owner"), getOverviewAnalytics);
router.get("/sales-trend", authenticateToken, authorizeRoles("owner"), getSalesTrendAnalytics);
router.get("/top-products", authenticateToken, authorizeRoles("owner"), getTopProductsAnalytics);
router.get("/cashier-performance", authenticateToken, authorizeRoles("owner"), getCashierPerformanceAnalytics);

module.exports = router;
