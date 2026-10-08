const pool = require("../db/database");

/**
 * GET /api/products
 * Return all products joined with categories
 */
const getAllProducts = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.price,
                p.stock_quantity,
                p.reorder_level,
                p.status,
                p.created_at,
                p.updated_at
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            ORDER BY p.product_id ASC;
        `;

        const result = await pool.query(query);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error retrieving products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve products",
            error: error.message
        });
    }
};

/**
 * GET /api/products/:id
 * Return one product by product_id with category name
 */
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Product ID must be a valid number"
            });
        }

        const query = `
            SELECT 
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.price,
                p.stock_quantity,
                p.reorder_level,
                p.status,
                p.created_at,
                p.updated_at
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.product_id = $1;
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error(`Error retrieving product ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve product",
            error: error.message
        });
    }
};

/**
 * POST /api/products
 * Create a new product
 */
const createProduct = async (req, res) => {
    try {
        const { product_name, category_id, price, stock_quantity, reorder_level } = req.body;

        // Validate required fields presence
        if (
            product_name === undefined || product_name === null || String(product_name).trim() === "" ||
            category_id === undefined || category_id === null ||
            price === undefined || price === null ||
            stock_quantity === undefined || stock_quantity === null ||
            reorder_level === undefined || reorder_level === null
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: product_name, category_id, price, stock_quantity, and reorder_level"
            });
        }

        const numericPrice = Number(price);
        const numericStock = Number(stock_quantity);
        const numericReorder = Number(reorder_level);
        const numericCategoryId = Number(category_id);

        if (isNaN(numericPrice) || numericPrice < 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a non-negative number"
            });
        }

        if (isNaN(numericStock) || !Number.isInteger(numericStock) || numericStock < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity must be a non-negative integer"
            });
        }

        if (isNaN(numericReorder) || !Number.isInteger(numericReorder) || numericReorder < 0) {
            return res.status(400).json({
                success: false,
                message: "Reorder level must be a non-negative integer"
            });
        }

        if (isNaN(numericCategoryId) || !Number.isInteger(numericCategoryId)) {
            return res.status(400).json({
                success: false,
                message: "Category ID must be a valid integer"
            });
        }

        const query = `
            WITH inserted AS (
                INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            )
            SELECT 
                i.product_id,
                i.product_name,
                i.category_id,
                c.category_name,
                i.price,
                i.stock_quantity,
                i.reorder_level,
                i.status,
                i.created_at,
                i.updated_at
            FROM inserted i
            JOIN categories c ON i.category_id = c.category_id;
        `;

        const values = [String(product_name).trim(), numericCategoryId, numericPrice, numericStock, numericReorder];
        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error creating product:", error);

        // Foreign key violation (invalid category_id)
        if (error.code === "23503") {
            return res.status(400).json({
                success: false,
                message: "Category not found. Please provide a valid category_id"
            });
        }

        // Check constraint violation
        if (error.code === "23514") {
            return res.status(400).json({
                success: false,
                message: "Invalid field values violating database constraints",
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create product",
            error: error.message
        });
    }
};

/**
 * PUT /api/products/:id
 * Update an existing product
 */
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Product ID must be a valid number"
            });
        }

        const { product_name, category_id, price, stock_quantity, reorder_level } = req.body;

        // Validate required fields presence
        if (
            product_name === undefined || product_name === null || String(product_name).trim() === "" ||
            category_id === undefined || category_id === null ||
            price === undefined || price === null ||
            stock_quantity === undefined || stock_quantity === null ||
            reorder_level === undefined || reorder_level === null
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: product_name, category_id, price, stock_quantity, and reorder_level"
            });
        }

        const numericPrice = Number(price);
        const numericStock = Number(stock_quantity);
        const numericReorder = Number(reorder_level);
        const numericCategoryId = Number(category_id);

        if (isNaN(numericPrice) || numericPrice < 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be a non-negative number"
            });
        }

        if (isNaN(numericStock) || !Number.isInteger(numericStock) || numericStock < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity must be a non-negative integer"
            });
        }

        if (isNaN(numericReorder) || !Number.isInteger(numericReorder) || numericReorder < 0) {
            return res.status(400).json({
                success: false,
                message: "Reorder level must be a non-negative integer"
            });
        }

        if (isNaN(numericCategoryId) || !Number.isInteger(numericCategoryId)) {
            return res.status(400).json({
                success: false,
                message: "Category ID must be a valid integer"
            });
        }

        const query = `
            WITH updated AS (
                UPDATE products
                SET 
                    product_name = $1,
                    category_id = $2,
                    price = $3,
                    stock_quantity = $4,
                    reorder_level = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = $6
                RETURNING *
            )
            SELECT 
                u.product_id,
                u.product_name,
                u.category_id,
                c.category_name,
                u.price,
                u.stock_quantity,
                u.reorder_level,
                u.status,
                u.created_at,
                u.updated_at
            FROM updated u
            JOIN categories c ON u.category_id = c.category_id;
        `;

        const values = [String(product_name).trim(), numericCategoryId, numericPrice, numericStock, numericReorder, id];
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error(`Error updating product ${req.params.id}:`, error);

        // Foreign key violation (invalid category_id)
        if (error.code === "23503") {
            return res.status(400).json({
                success: false,
                message: "Category not found. Please provide a valid category_id"
            });
        }

        // Check constraint violation
        if (error.code === "23514") {
            return res.status(400).json({
                success: false,
                message: "Invalid field values violating database constraints",
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update product",
            error: error.message
        });
    }
};

/**
 * PATCH /api/products/:id/status
 * Update product status ('active' or 'inactive')
 */
const updateProductStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Product ID must be a valid number"
            });
        }

        const { status } = req.body;
        const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";

        if (normalizedStatus !== "active" && normalizedStatus !== "inactive") {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Accepted values are 'active' or 'inactive'"
            });
        }

        const query = `
            WITH updated AS (
                UPDATE products
                SET 
                    status = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = $2
                RETURNING *
            )
            SELECT 
                u.product_id,
                u.product_name,
                u.category_id,
                c.category_name,
                u.price,
                u.stock_quantity,
                u.reorder_level,
                u.status,
                u.created_at,
                u.updated_at
            FROM updated u
            JOIN categories c ON u.category_id = c.category_id;
        `;

        const result = await pool.query(query, [normalizedStatus, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Product status updated successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error(`Error updating status for product ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to update product status",
            error: error.message
        });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    updateProductStatus
};
