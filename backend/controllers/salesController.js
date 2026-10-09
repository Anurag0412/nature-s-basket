const pool = require("../db/database");

/**
 * Decimal-safe currency helper: converts decimal string or number to integer paise (cents)
 * to completely eliminate JavaScript floating-point arithmetic errors.
 */
const toPaise = (val) => {
    if (typeof val === "number") {
        return Math.round(val * 100);
    }
    const str = String(val).trim();
    if (!str.includes(".")) {
        return parseInt(str, 10) * 100;
    }
    const [wholePart, fracPart] = str.split(".");
    const whole = parseInt(wholePart, 10) || 0;
    const frac = parseInt((fracPart + "00").slice(0, 2), 10) || 0;
    return whole * 100 + frac;
};

/**
 * Converts integer paise back to formatted rupee string with 2 decimal places.
 */
const toRupeesString = (paise) => {
    return (paise / 100).toFixed(2);
};

/**
 * POST /api/sales
 * Create a bill / sale transaction.
 * 
 * Requirements:
 * - Requires JWT authentication and 'cashier' role.
 * - Accept body with `items: [{ product_id, quantity }]`.
 * - Combines quantities if duplicate product IDs are provided in items.
 * - Validates product existence, active status, and sufficient stock.
 * - Performs atomic transaction using a dedicated PostgreSQL pool client with SELECT ... FOR UPDATE.
 * - Locks products in ascending product_id order to avoid deadlocks.
 * - Recalculates subtotals and total using DB snapshot prices (ignores client prices/totals/cashier ID).
 * - Decrements stock using conditional UPDATE.
 * - Commits transaction or cleanly rolls back on any error.
 */
const createSale = async (req, res) => {
    // 1. Validate request body and items array
    if (!req.body || !Array.isArray(req.body.items) || req.body.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Request body must contain a non-empty 'items' array"
        });
    }

    const { items } = req.body;
    const consolidatedItems = new Map(); // product_id -> total requested quantity

    // 2. Validate line items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return res.status(400).json({
                success: false,
                message: `Item at index ${i} must be a valid object`
            });
        }

        const rawPid = item.product_id !== undefined ? item.product_id : item.productId;
        const rawQty = item.quantity;

        // Reject non-integer, <= 0, or missing product_id
        if (
            rawPid === undefined ||
            rawPid === null ||
            typeof rawPid === "boolean" ||
            isNaN(rawPid) ||
            !Number.isInteger(Number(rawPid)) ||
            Number(rawPid) <= 0 ||
            String(rawPid).includes(".")
        ) {
            return res.status(400).json({
                success: false,
                message: `Item at index ${i} has an invalid product_id. It must be a positive integer`
            });
        }

        // Reject non-integer, <= 0, or missing quantity
        if (
            rawQty === undefined ||
            rawQty === null ||
            typeof rawQty === "boolean" ||
            isNaN(rawQty) ||
            !Number.isInteger(Number(rawQty)) ||
            Number(rawQty) <= 0 ||
            String(rawQty).includes(".")
        ) {
            return res.status(400).json({
                success: false,
                message: `Item at index ${i} has an invalid quantity. It must be a positive integer`
            });
        }

        const productId = Number(rawPid);
        const quantity = Number(rawQty);

        // Combine quantities for duplicate product entries
        consolidatedItems.set(productId, (consolidatedItems.get(productId) || 0) + quantity);
    }

    // Acquire dedicated client from pool for the atomic transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 3. Sort product IDs in ascending order to prevent deadlocks across concurrent transactions
        const productIds = Array.from(consolidatedItems.keys()).sort((a, b) => a - b);

        // 4. Lock rows using SELECT ... FOR UPDATE in consistent ascending order
        const lockQuery = `
            SELECT product_id, product_name, price, stock_quantity, status
            FROM products
            WHERE product_id = ANY($1::int[])
            ORDER BY product_id ASC
            FOR UPDATE;
        `;
        const lockResult = await client.query(lockQuery, [productIds]);
        const fetchedProducts = lockResult.rows;

        // Check for nonexistent products
        const fetchedMap = new Map();
        for (const prod of fetchedProducts) {
            fetchedMap.set(prod.product_id, prod);
        }

        for (const pid of productIds) {
            if (!fetchedMap.has(pid)) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: `Product with ID ${pid} does not exist`
                });
            }
        }

        // 5. Validate status and stock availability for all items before any mutation
        for (const pid of productIds) {
            const prod = fetchedMap.get(pid);
            const requestedQty = consolidatedItems.get(pid);

            if (prod.status !== "active") {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: `Product '${prod.product_name}' (ID: ${prod.product_id}) is inactive`
                });
            }

            if (prod.stock_quantity < requestedQty) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product '${prod.product_name}' (ID: ${prod.product_id}). Available: ${prod.stock_quantity}, requested: ${requestedQty}`
                });
            }
        }

        // 6. Calculate subtotals and bill total using database snapshot prices
        let totalPaise = 0;
        const lineItemsPrepared = [];

        for (const pid of productIds) {
            const prod = fetchedMap.get(pid);
            const quantity = consolidatedItems.get(pid);
            const unitPricePaise = toPaise(prod.price);
            const subtotalPaise = unitPricePaise * quantity;
            totalPaise += subtotalPaise;

            lineItemsPrepared.push({
                product_id: pid,
                product_name: prod.product_name,
                quantity: quantity,
                unit_price: toRupeesString(unitPricePaise),
                subtotal: toRupeesString(subtotalPaise)
            });
        }

        const totalAmount = toRupeesString(totalPaise);
        const cashierId = req.user.user_id; // Identity strictly from authenticated JWT

        // 7. Insert into sales table
        const insertSaleQuery = `
            INSERT INTO sales (cashier_id, total_amount)
            VALUES ($1, $2)
            RETURNING sale_id, cashier_id, sale_date, total_amount;
        `;
        const saleResult = await client.query(insertSaleQuery, [cashierId, totalAmount]);
        const createdSale = saleResult.rows[0];

        // 8. Insert line items into sale_items table and deduct stock
        const insertedItems = [];
        for (const line of lineItemsPrepared) {
            const insertItemQuery = `
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING sale_item_id, sale_id, product_id, quantity, unit_price, subtotal;
            `;
            const itemResult = await client.query(insertItemQuery, [
                createdSale.sale_id,
                line.product_id,
                line.quantity,
                line.unit_price,
                line.subtotal
            ]);

            insertedItems.push({
                sale_item_id: itemResult.rows[0].sale_item_id,
                product_id: line.product_id,
                product_name: line.product_name,
                quantity: line.quantity,
                unit_price: line.unit_price,
                subtotal: line.subtotal
            });

            // Conditional atomic stock update
            const updateStockQuery = `
                UPDATE products
                SET stock_quantity = stock_quantity - $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = $2 AND stock_quantity >= $1
                RETURNING product_id, stock_quantity;
            `;
            const updateResult = await client.query(updateStockQuery, [line.quantity, line.product_id]);
            if (updateResult.rowCount === 0) {
                throw new Error(`Atomic stock reduction failed for product ID ${line.product_id}`);
            }
        }

        // 9. Commit transaction
        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Sale created successfully",
            data: {
                sale_id: createdSale.sale_id,
                cashier_id: createdSale.cashier_id,
                cashier_name: req.user.name,
                sale_date: createdSale.sale_date,
                total_amount: createdSale.total_amount,
                items: insertedItems
            }
        });
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rbError) {
            console.error("Rollback failed:", rbError.message);
        }
        console.error("Error creating sale:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to process sale transaction"
        });
    } finally {
        // Dedicated client released back to pool unconditionally
        client.release();
    }
};

/**
 * GET /api/sales/:id
 * Retrieve a single sale by ID including cashier information and line items.
 * 
 * Access control:
 * - Cashier: may only view their own sales (returns 404 if sale doesn't exist or belongs to another cashier).
 * - Owner: may view any sale.
 * - Staff: forbidden (403).
 */
const getSaleById = async (req, res) => {
    try {
        const { id } = req.params;

        if (
            isNaN(id) ||
            !Number.isInteger(Number(id)) ||
            Number(id) <= 0 ||
            String(id).includes(".")
        ) {
            return res.status(400).json({
                success: false,
                message: "Sale ID must be a valid positive integer"
            });
        }

        const saleId = Number(id);
        const { role, user_id: userId } = req.user;

        // Staff is forbidden from accessing sales
        if (role === "staff") {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: staff role is not authorized to view sales"
            });
        }

        let saleQuery;
        let queryParams;

        if (role === "owner") {
            saleQuery = `
                SELECT 
                    s.sale_id,
                    s.cashier_id,
                    u.name AS cashier_name,
                    u.username AS cashier_username,
                    s.sale_date,
                    s.total_amount
                FROM sales s
                JOIN users u ON s.cashier_id = u.user_id
                WHERE s.sale_id = $1;
            `;
            queryParams = [saleId];
        } else if (role === "cashier") {
            // Cashier can only see their own sales; returning 404 avoids leaking existence of another cashier's sale
            saleQuery = `
                SELECT 
                    s.sale_id,
                    s.cashier_id,
                    u.name AS cashier_name,
                    u.username AS cashier_username,
                    s.sale_date,
                    s.total_amount
                FROM sales s
                JOIN users u ON s.cashier_id = u.user_id
                WHERE s.sale_id = $1 AND s.cashier_id = $2;
            `;
            queryParams = [saleId, userId];
        } else {
            return res.status(403).json({
                success: false,
                message: "Access forbidden"
            });
        }

        const saleResult = await pool.query(saleQuery, queryParams);

        if (saleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found"
            });
        }

        const sale = saleResult.rows[0];

        // Fetch line items with product names
        const itemsQuery = `
            SELECT 
                si.sale_item_id,
                si.sale_id,
                si.product_id,
                p.product_name,
                si.quantity,
                si.unit_price,
                si.subtotal
            FROM sale_items si
            JOIN products p ON si.product_id = p.product_id
            WHERE si.sale_id = $1
            ORDER BY si.sale_item_id ASC;
        `;
        const itemsResult = await pool.query(itemsQuery, [saleId]);

        return res.status(200).json({
            success: true,
            data: {
                ...sale,
                items: itemsResult.rows
            }
        });
    } catch (error) {
        console.error("Error retrieving sale by ID:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sale details"
        });
    }
};

/**
 * GET /api/sales
 * Retrieve paginated sales list.
 * 
 * Access control:
 * - Cashier: can only view their own sales.
 * - Owner: can view all sales.
 * - Staff: forbidden (403).
 * 
 * Pagination:
 * - Query params: page (default 1), limit (default 10, max 100).
 * - Stable sorting: newest first (sale_date DESC, sale_id DESC).
 */
const getAllSales = async (req, res) => {
    try {
        const { role, user_id: userId } = req.user;

        // Staff is forbidden from accessing sales
        if (role === "staff") {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: staff role is not authorized to view sales"
            });
        }

        // Validate pagination query params
        const pageParam = req.query.page !== undefined ? req.query.page : 1;
        const limitParam = req.query.limit !== undefined ? req.query.limit : 10;

        if (
            isNaN(pageParam) ||
            !Number.isInteger(Number(pageParam)) ||
            Number(pageParam) <= 0 ||
            String(pageParam).includes(".")
        ) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer"
            });
        }

        if (
            isNaN(limitParam) ||
            !Number.isInteger(Number(limitParam)) ||
            Number(limitParam) <= 0 ||
            Number(limitParam) > 100 ||
            String(limitParam).includes(".")
        ) {
            return res.status(400).json({
                success: false,
                message: "Limit must be a positive integer between 1 and 100"
            });
        }

        const page = Number(pageParam);
        const limit = Number(limitParam);
        const offset = (page - 1) * limit;

        let countQuery;
        let countParams;
        let listQuery;
        let listParams;

        if (role === "owner") {
            countQuery = `SELECT COUNT(*) AS total FROM sales;`;
            countParams = [];

            listQuery = `
                SELECT 
                    s.sale_id,
                    s.cashier_id,
                    u.name AS cashier_name,
                    u.username AS cashier_username,
                    s.sale_date,
                    s.total_amount
                FROM sales s
                JOIN users u ON s.cashier_id = u.user_id
                ORDER BY s.sale_date DESC, s.sale_id DESC
                LIMIT $1 OFFSET $2;
            `;
            listParams = [limit, offset];
        } else if (role === "cashier") {
            countQuery = `SELECT COUNT(*) AS total FROM sales WHERE cashier_id = $1;`;
            countParams = [userId];

            listQuery = `
                SELECT 
                    s.sale_id,
                    s.cashier_id,
                    u.name AS cashier_name,
                    u.username AS cashier_username,
                    s.sale_date,
                    s.total_amount
                FROM sales s
                JOIN users u ON s.cashier_id = u.user_id
                WHERE s.cashier_id = $1
                ORDER BY s.sale_date DESC, s.sale_id DESC
                LIMIT $2 OFFSET $3;
            `;
            listParams = [userId, limit, offset];
        } else {
            return res.status(403).json({
                success: false,
                message: "Access forbidden"
            });
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

        const listResult = await pool.query(listQuery, listParams);

        return res.status(200).json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages
            },
            data: listResult.rows
        });
    } catch (error) {
        console.error("Error retrieving sales:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sales list"
        });
    }
};

module.exports = {
    createSale,
    getSaleById,
    getAllSales
};
