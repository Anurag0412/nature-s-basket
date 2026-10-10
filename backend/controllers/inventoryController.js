const pool = require("../db/database");

/**
 * GET /api/inventory
 * Retrieve inventory details for all products.
 *
 * Query filters supported:
 * - low_stock=true: filter to products where stock_quantity <= reorder_level
 * - status=active|inactive: filter by product status
 * - category_id=<int>: filter by category
 */
const getInventory = async (req, res) => {
    try {
        const { low_stock, lowStock, status, category_id } = req.query;

        let query = `
            SELECT
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.price,
                p.stock_quantity,
                p.reorder_level,
                p.status,
                (p.stock_quantity <= p.reorder_level) AS is_low_stock,
                p.created_at,
                p.updated_at
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE 1=1
        `;

        const queryParams = [];

        // Low stock filter
        if (low_stock === "true" || lowStock === "true") {
            query += ` AND p.stock_quantity <= p.reorder_level`;
        }

        // Status filter
        if (status) {
            const normalizedStatus = String(status).trim().toLowerCase();
            if (normalizedStatus === "active" || normalizedStatus === "inactive") {
                queryParams.push(normalizedStatus);
                query += ` AND p.status = $${queryParams.length}`;
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter. Accepted values are 'active' or 'inactive'"
                });
            }
        }

        // Category filter
        if (category_id !== undefined) {
            if (isNaN(category_id) || !Number.isInteger(Number(category_id)) || Number(category_id) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "category_id must be a valid positive integer"
                });
            }
            queryParams.push(Number(category_id));
            query += ` AND p.category_id = $${queryParams.length}`;
        }

        query += ` ORDER BY p.product_id ASC;`;

        const result = await pool.query(query, queryParams);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error retrieving inventory:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve inventory data"
        });
    }
};

/**
 * GET /api/inventory/low-stock
 * Retrieve products whose current stock is less than or equal to their reorder level.
 */
const getLowStockInventory = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT
                p.product_id,
                p.product_name,
                p.category_id,
                c.category_name,
                p.price,
                p.stock_quantity,
                p.reorder_level,
                p.status,
                (p.reorder_level - p.stock_quantity) AS deficit,
                p.created_at,
                p.updated_at
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE p.stock_quantity <= p.reorder_level
        `;

        const queryParams = [];

        if (status) {
            const normalizedStatus = String(status).trim().toLowerCase();
            if (normalizedStatus === "active" || normalizedStatus === "inactive") {
                queryParams.push(normalizedStatus);
                query += ` AND p.status = $${queryParams.length}`;
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid status filter. Accepted values are 'active' or 'inactive'"
                });
            }
        }

        query += ` ORDER BY p.stock_quantity ASC, p.product_id ASC;`;

        const result = await pool.query(query, queryParams);

        return res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error retrieving low-stock inventory:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve low-stock inventory"
        });
    }
};

/**
 * PATCH /api/inventory/:id/stock
 * Atomically update stock quantity for a product.
 *
 * Permissions:
 * - staff or owner only
 *
 * Rules:
 * - Validates positive integer product ID
 * - Validates non-negative integer stock_quantity
 * - Uses dedicated transaction with row-level locking (SELECT ... FOR UPDATE) to prevent lost updates with concurrent billing
 * - Rejects inactive products
 * - Prevents modification of other fields (price, category, etc.)
 */
const updateStock = async (req, res) => {
    const { id } = req.params;

    // Validate product ID
    if (
        id === undefined ||
        isNaN(id) ||
        !Number.isInteger(Number(id)) ||
        Number(id) <= 0 ||
        String(id).includes(".")
    ) {
        return res.status(400).json({
            success: false,
            message: "Product ID must be a valid positive integer"
        });
    }

    const productId = Number(id);

    // Accept stock_quantity or quantity
    const rawStock = req.body.stock_quantity !== undefined ? req.body.stock_quantity : req.body.quantity;

    // Validate stock quantity: must be non-negative integer
    if (
        rawStock === undefined ||
        rawStock === null ||
        typeof rawStock === "boolean" ||
        isNaN(rawStock) ||
        !Number.isInteger(Number(rawStock)) ||
        Number(rawStock) < 0 ||
        String(rawStock).includes(".")
    ) {
        return res.status(400).json({
            success: false,
            message: "stock_quantity is required and must be a non-negative integer"
        });
    }

    const newStock = Number(rawStock);

    // Acquire dedicated client for row-locking transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Lock product row to prevent lost updates during concurrent sales transactions
        const selectQuery = `
            SELECT product_id, product_name, stock_quantity, status
            FROM products
            WHERE product_id = $1
            FOR UPDATE;
        `;
        const selectResult = await client.query(selectQuery, [productId]);

        if (selectResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const product = selectResult.rows[0];

        // Reject restocking of inactive products
        if (product.status !== "active") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: `Cannot update stock for inactive product '${product.product_name}' (ID: ${product.product_id}). Product must be active to restock.`
            });
        }

        // Atomically update stock_quantity only (preserves price, category, name, etc.)
        const updateQuery = `
            WITH updated AS (
                UPDATE products
                SET stock_quantity = $1,
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
        const updateResult = await client.query(updateQuery, [newStock, productId]);

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Stock quantity updated successfully",
            data: updateResult.rows[0]
        });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rbErr) {
            console.error("Rollback failed:", rbErr.message);
        }
        console.error(`Error updating stock for product ${productId}:`, error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to update stock quantity"
        });
    } finally {
        client.release();
    }
};

module.exports = {
    getInventory,
    getLowStockInventory,
    updateStock
};
