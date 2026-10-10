const pool = require("../db/database");

/**
 * Validates a YYYY-MM-DD date string strictly according to calendar rules.
 */
const isValidYMD = (str) => {
    if (!str || typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return false;
    }
    const [y, m, d] = str.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
        return false;
    }
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
        date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d
    );
};

/**
 * Returns default date range: last 30 days up to today.
 */
const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29); // 30-day window including today

    const formatYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    return {
        start_date: formatYMD(start),
        end_date: formatYMD(end)
    };
};

/**
 * Validates and extracts start_date and end_date from request query.
 */
const parseAndValidateDateRange = (query) => {
    const defaults = getDefaultDateRange();
    const rawStart = query.start_date;
    const rawEnd = query.end_date;

    if (rawStart !== undefined && !isValidYMD(rawStart)) {
        return { error: "start_date must be a valid date in YYYY-MM-DD format" };
    }

    if (rawEnd !== undefined && !isValidYMD(rawEnd)) {
        return { error: "end_date must be a valid date in YYYY-MM-DD format" };
    }

    const startDate = rawStart || defaults.start_date;
    const endDate = rawEnd || defaults.end_date;

    if (startDate > endDate) {
        return { error: "start_date cannot be after end_date" };
    }

    // Limit maximum query span to 366 days to protect query performance
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    if (diffDays > 366) {
        return { error: "Date range cannot exceed 366 days" };
    }

    return { startDate, endDate };
};

/**
 * GET /api/analytics/overview
 * Returns summary metrics for the specified date range:
 * - total_revenue
 * - number_of_bills
 * - average_bill_value
 * - total_units_sold
 */
const getOverviewAnalytics = async (req, res) => {
    try {
        const dateRangeResult = parseAndValidateDateRange(req.query);
        if (dateRangeResult.error) {
            return res.status(400).json({
                success: false,
                message: dateRangeResult.error
            });
        }

        const { startDate, endDate } = dateRangeResult;

        const query = `
            WITH filtered_sales AS (
                SELECT sale_id, total_amount
                FROM sales
                WHERE sale_date >= $1::date AND sale_date < ($2::date + INTERVAL '1 day')
            )
            SELECT
                COALESCE(SUM(fs.total_amount), 0)::numeric AS total_revenue,
                COUNT(fs.sale_id)::int AS number_of_bills,
                CASE
                    WHEN COUNT(fs.sale_id) > 0 THEN ROUND(SUM(fs.total_amount) / COUNT(fs.sale_id), 2)
                    ELSE 0.00
                END::numeric AS average_bill_value,
                COALESCE((
                    SELECT SUM(si.quantity)
                    FROM sale_items si
                    WHERE si.sale_id IN (SELECT sale_id FROM filtered_sales)
                ), 0)::int AS total_units_sold
            FROM filtered_sales fs;
        `;

        const result = await pool.query(query, [startDate, endDate]);
        const row = result.rows[0];

        return res.status(200).json({
            success: true,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            data: {
                total_revenue: Number(row.total_revenue).toFixed(2),
                number_of_bills: Number(row.number_of_bills),
                average_bill_value: Number(row.average_bill_value).toFixed(2),
                total_units_sold: Number(row.total_units_sold)
            }
        });
    } catch (error) {
        console.error("Error retrieving overview analytics:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve overview analytics"
        });
    }
};

/**
 * GET /api/analytics/sales-trend
 * Returns daily sales data for the selected date range:
 * - date (YYYY-MM-DD)
 * - revenue
 * - number_of_bills
 * - units_sold
 * Includes dates with zero sales via PostgreSQL generate_series in chronological order.
 */
const getSalesTrendAnalytics = async (req, res) => {
    try {
        const dateRangeResult = parseAndValidateDateRange(req.query);
        if (dateRangeResult.error) {
            return res.status(400).json({
                success: false,
                message: dateRangeResult.error
            });
        }

        const { startDate, endDate } = dateRangeResult;

        const query = `
            WITH date_series AS (
                SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS day
            ),
            daily_sales AS (
                SELECT
                    s.sale_date::date AS day,
                    COALESCE(SUM(s.total_amount), 0) AS revenue,
                    COUNT(s.sale_id) AS number_of_bills
                FROM sales s
                WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + INTERVAL '1 day')
                GROUP BY s.sale_date::date
            ),
            daily_units AS (
                SELECT
                    s.sale_date::date AS day,
                    COALESCE(SUM(si.quantity), 0) AS units_sold
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.sale_id
                WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + INTERVAL '1 day')
                GROUP BY s.sale_date::date
            )
            SELECT
                TO_CHAR(ds.day, 'YYYY-MM-DD') AS date,
                COALESCE(sales_agg.revenue, 0)::numeric AS revenue,
                COALESCE(sales_agg.number_of_bills, 0)::int AS number_of_bills,
                COALESCE(units_agg.units_sold, 0)::int AS units_sold
            FROM date_series ds
            LEFT JOIN daily_sales sales_agg ON ds.day = sales_agg.day
            LEFT JOIN daily_units units_agg ON ds.day = units_agg.day
            ORDER BY ds.day ASC;
        `;

        const result = await pool.query(query, [startDate, endDate]);

        const trendData = result.rows.map((r) => ({
            date: r.date,
            revenue: Number(r.revenue).toFixed(2),
            number_of_bills: Number(r.number_of_bills),
            units_sold: Number(r.units_sold)
        }));

        return res.status(200).json({
            success: true,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            count: trendData.length,
            data: trendData
        });
    } catch (error) {
        console.error("Error retrieving sales trend analytics:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sales trend analytics"
        });
    }
};

/**
 * GET /api/analytics/top-products
 * Returns best-selling products for the selected date range ranked by units sold:
 * - product_id
 * - product_name
 * - units_sold
 * - revenue (calculated from persisted sale_items.subtotal)
 */
const getTopProductsAnalytics = async (req, res) => {
    try {
        const dateRangeResult = parseAndValidateDateRange(req.query);
        if (dateRangeResult.error) {
            return res.status(400).json({
                success: false,
                message: dateRangeResult.error
            });
        }

        const { startDate, endDate } = dateRangeResult;

        // Validate limit parameter (default: 5, max: 100)
        let limit = 5;
        if (req.query.limit !== undefined) {
            const rawLimit = req.query.limit;
            if (
                isNaN(rawLimit) ||
                !Number.isInteger(Number(rawLimit)) ||
                Number(rawLimit) <= 0 ||
                Number(rawLimit) > 100 ||
                String(rawLimit).includes(".")
            ) {
                return res.status(400).json({
                    success: false,
                    message: "limit must be a positive integer between 1 and 100"
                });
            }
            limit = Number(rawLimit);
        }

        const query = `
            SELECT
                p.product_id,
                p.product_name,
                COALESCE(SUM(si.quantity), 0)::int AS units_sold,
                COALESCE(SUM(si.subtotal), 0)::numeric AS revenue
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.sale_id
            JOIN products p ON si.product_id = p.product_id
            WHERE s.sale_date >= $1::date AND s.sale_date < ($2::date + INTERVAL '1 day')
            GROUP BY p.product_id, p.product_name
            ORDER BY units_sold DESC, revenue DESC, p.product_id ASC
            LIMIT $3;
        `;

        const result = await pool.query(query, [startDate, endDate, limit]);

        const topProducts = result.rows.map((r) => ({
            product_id: Number(r.product_id),
            product_name: r.product_name,
            units_sold: Number(r.units_sold),
            revenue: Number(r.revenue).toFixed(2)
        }));

        return res.status(200).json({
            success: true,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            count: topProducts.length,
            data: topProducts
        });
    } catch (error) {
        console.error("Error retrieving top products analytics:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve top products analytics"
        });
    }
};

/**
 * GET /api/analytics/cashier-performance
 * Returns performance metrics for each cashier for the selected date range:
 * - cashier_id
 * - cashier_name
 * - number_of_bills
 * - total_revenue
 * - average_bill_value
 * Only includes users with the 'cashier' role.
 */
const getCashierPerformanceAnalytics = async (req, res) => {
    try {
        const dateRangeResult = parseAndValidateDateRange(req.query);
        if (dateRangeResult.error) {
            return res.status(400).json({
                success: false,
                message: dateRangeResult.error
            });
        }

        const { startDate, endDate } = dateRangeResult;

        const query = `
            SELECT
                u.user_id AS cashier_id,
                u.name AS cashier_name,
                COUNT(s.sale_id)::int AS number_of_bills,
                COALESCE(SUM(s.total_amount), 0)::numeric AS total_revenue,
                CASE
                    WHEN COUNT(s.sale_id) > 0 THEN ROUND(SUM(s.total_amount) / COUNT(s.sale_id), 2)
                    ELSE 0.00
                END::numeric AS average_bill_value
            FROM users u
            LEFT JOIN sales s ON u.user_id = s.cashier_id
                AND s.sale_date >= $1::date AND s.sale_date < ($2::date + INTERVAL '1 day')
            WHERE u.role = 'cashier'
            GROUP BY u.user_id, u.name
            ORDER BY total_revenue DESC, number_of_bills DESC, u.user_id ASC;
        `;

        const result = await pool.query(query, [startDate, endDate]);

        const cashierData = result.rows.map((r) => ({
            cashier_id: Number(r.cashier_id),
            cashier_name: r.cashier_name,
            number_of_bills: Number(r.number_of_bills),
            total_revenue: Number(r.total_revenue).toFixed(2),
            average_bill_value: Number(r.average_bill_value).toFixed(2)
        }));

        return res.status(200).json({
            success: true,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            count: cashierData.length,
            data: cashierData
        });
    } catch (error) {
        console.error("Error retrieving cashier performance analytics:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve cashier performance analytics"
        });
    }
};

module.exports = {
    getOverviewAnalytics,
    getSalesTrendAnalytics,
    getTopProductsAnalytics,
    getCashierPerformanceAnalytics
};
