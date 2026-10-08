const pool = require("../db/database");

/**
 * GET /api/categories
 * Return all categories sorted by category_id
 */
const getAllCategories = async (req, res) => {
    try {
        const query = `
            SELECT category_id, category_name, status
            FROM categories
            ORDER BY category_id ASC;
        `;

        const result = await pool.query(query);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Error retrieving categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve categories",
            error: error.message
        });
    }
};

/**
 * GET /api/categories/:id
 * Return one category by category_id
 */
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Category ID must be a valid number"
            });
        }

        const query = `
            SELECT category_id, category_name, status
            FROM categories
            WHERE category_id = $1;
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error(`Error retrieving category ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve category",
            error: error.message
        });
    }
};

/**
 * POST /api/categories
 * Create a new category
 */
const createCategory = async (req, res) => {
    try {
        const { category_name } = req.body;

        if (!category_name || String(category_name).trim() === "") {
            return res.status(400).json({
                success: false,
                message: "category_name is required"
            });
        }

        const trimmedName = String(category_name).trim();

        const query = `
            INSERT INTO categories (category_name)
            VALUES ($1)
            RETURNING category_id, category_name, status;
        `;

        const result = await pool.query(query, [trimmedName]);

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Error creating category:", error);

        // Unique constraint violation for category_name
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Category with this name already exists"
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
            message: "Failed to create category",
            error: error.message
        });
    }
};

/**
 * PUT /api/categories/:id
 * Update an existing category name
 */
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Category ID must be a valid number"
            });
        }

        const { category_name } = req.body;

        if (!category_name || String(category_name).trim() === "") {
            return res.status(400).json({
                success: false,
                message: "category_name is required"
            });
        }

        const trimmedName = String(category_name).trim();

        const query = `
            UPDATE categories
            SET category_name = $1
            WHERE category_id = $2
            RETURNING category_id, category_name, status;
        `;

        const result = await pool.query(query, [trimmedName, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error(`Error updating category ${req.params.id}:`, error);

        // Unique constraint violation for category_name
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Category with this name already exists"
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
            message: "Failed to update category",
            error: error.message
        });
    }
};

/**
 * PATCH /api/categories/:id/status
 * Update category status ('active' or 'inactive')
 */
const updateCategoryStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Category ID must be a valid number"
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
            UPDATE categories
            SET status = $1
            WHERE category_id = $2
            RETURNING category_id, category_name, status;
        `;

        const result = await pool.query(query, [normalizedStatus, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Category status updated successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error(`Error updating status for category ${req.params.id}:`, error);
        res.status(500).json({
            success: false,
            message: "Failed to update category status",
            error: error.message
        });
    }
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    updateCategoryStatus
};
