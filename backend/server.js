const express = require("express");
const cors = require("cors");

const pool = require("./db/database");
const productRoutes = require("./routes/productRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/products", productRoutes);

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "Nature's Basket API is running"
    });
});

// Database test route
app.get("/api/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW() AS current_time");

        res.json({
            success: true,
            message: "Database connection is working",
            database_time: result.rows[0].current_time
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});