-- ============================================================================
-- Nature's Basket — Reference & Operational SQL Queries
-- Useful read-only queries for administrative reporting, diagnostics,
-- and verifying business functionality
-- ============================================================================
--
-- QUERY INDEX
-- Line 24: UNION ALL & COUNT (Query 1) - Table record diagnostics across 5 tables
-- Line 39: SELECT & ORDER BY (Query 2) - Active store personnel sorted by role
-- Line 54: INNER JOIN (Query 3) - Product catalog with category names
-- Line 72: WHERE & Expressions (Query 4) - Low-stock items below reorder level
-- Line 91: GROUP BY & Pagination (Query 5) - Sales register with LIMIT/OFFSET
-- Line 111: Multi-Table JOIN (Query 6) - Itemized bill lookup joining 4 tables
-- Line 133: HAVING & SUM (Query 7) - Best-selling merchandise ranking
-- Line 152: CASE & Aggregate Functions (Query 8) - Cashier throughput audit
-- Line 173: CTE (WITH) & Date Functions (Query 9) - 30-day continuous revenue
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. System & Table Diagnostics
-- Concepts: UNION ALL, Aggregate Functions (COUNT), Column Aliasing
-- Check table record counts across all application tables
-- ----------------------------------------------------------------------------
SELECT 'users' AS table_name, COUNT(*) AS total_records FROM users
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'sale_items', COUNT(*) FROM sale_items;

-- ----------------------------------------------------------------------------
-- 2. User Accounts & Role Audit
-- Concepts: SELECT, ORDER BY (Multi-column Ascending)
-- List all active store personnel with roles (passwords omitted)
-- ----------------------------------------------------------------------------
SELECT
    user_id,
    name,
    username,
    role,
    status,
    created_at
FROM users
ORDER BY role ASC, user_id ASC;

-- ----------------------------------------------------------------------------
-- 3. Product Catalog with Category Join
-- Concepts: INNER JOIN, Table Aliasing, ORDER BY
-- Complete inventory listing with parent category and formatted prices
-- ----------------------------------------------------------------------------
SELECT
    p.product_id,
    p.product_name,
    c.category_name,
    p.price,
    p.stock_quantity,
    p.reorder_level,
    p.status,
    p.updated_at
FROM products p
JOIN categories c ON p.category_id = c.category_id
ORDER BY c.category_name ASC, p.product_name ASC;

-- ----------------------------------------------------------------------------
-- 4. Low-Stock Alert & Inventory Deficit Report
-- Concepts: WHERE (Comparison Filter), Arithmetic Expressions, INNER JOIN
-- Identifies products at or below their reorder threshold with restocking deficit
-- ----------------------------------------------------------------------------
SELECT
    p.product_id,
    p.product_name,
    c.category_name,
    p.stock_quantity,
    p.reorder_level,
    (p.reorder_level - p.stock_quantity) AS deficit_quantity,
    p.price,
    p.status
FROM products p
JOIN categories c ON p.category_id = c.category_id
WHERE p.stock_quantity <= p.reorder_level
ORDER BY p.stock_quantity ASC, deficit_quantity DESC;

-- ----------------------------------------------------------------------------
-- 5. Paginated Sales Transaction Register
-- Concepts: GROUP BY, Aggregate Functions (COUNT), LEFT JOIN, LIMIT & OFFSET
-- Historical customer checkout bills joined with cashier attribution
-- ----------------------------------------------------------------------------
SELECT
    s.sale_id,
    s.sale_date,
    u.name AS cashier_name,
    u.username AS cashier_username,
    s.total_amount,
    COUNT(si.sale_item_id) AS total_items_count
FROM sales s
JOIN users u ON s.cashier_id = u.user_id
LEFT JOIN sale_items si ON s.sale_id = si.sale_id
GROUP BY s.sale_id, s.sale_date, u.name, u.username, s.total_amount
ORDER BY s.sale_date DESC, s.sale_id DESC
LIMIT 10 OFFSET 0;

-- ----------------------------------------------------------------------------
-- 6. Itemized Receipt Inspection (Single Bill Lookup)
-- Concepts: Multi-Table JOIN (4 Tables), WHERE (Equality Filter), ORDER BY
-- Reconstructs the complete bill invoice with product names and subtotals
-- (Replace :target_sale_id with desired integer, e.g., 69 or 72)
-- ----------------------------------------------------------------------------
SELECT
    s.sale_id,
    s.sale_date,
    u.name AS cashier_name,
    si.sale_item_id,
    p.product_name,
    si.quantity,
    si.unit_price,
    si.subtotal,
    s.total_amount AS bill_total
FROM sales s
JOIN users u ON s.cashier_id = u.user_id
JOIN sale_items si ON s.sale_id = si.sale_id
JOIN products p ON si.product_id = p.product_id
WHERE s.sale_id = 72 -- Or target sale_id
ORDER BY si.sale_item_id ASC;

-- ----------------------------------------------------------------------------
-- 7. Best-Selling Products Ranking (Top Merchandise)
-- Concepts: HAVING (Aggregate Filter), Aggregate Functions (SUM), COALESCE, LIMIT
-- Ranks items by cumulative units sold and gross revenue generated
-- ----------------------------------------------------------------------------
SELECT
    p.product_id,
    p.product_name,
    c.category_name,
    COALESCE(SUM(si.quantity), 0) AS total_units_sold,
    COALESCE(SUM(si.subtotal), 0) AS gross_revenue
FROM products p
JOIN categories c ON p.category_id = c.category_id
LEFT JOIN sale_items si ON p.product_id = si.product_id
GROUP BY p.product_id, p.product_name, c.category_name
HAVING COALESCE(SUM(si.quantity), 0) > 0
ORDER BY total_units_sold DESC, gross_revenue DESC
LIMIT 5;

-- ----------------------------------------------------------------------------
-- 8. Cashier Register Performance & Throughput Audit
-- Concepts: CASE Expression (Conditional Logic), Aggregate Functions (COUNT, SUM), Numeric Functions (ROUND)
-- Operator efficiency, checkout bill count, and revenue collected
-- ----------------------------------------------------------------------------
SELECT
    u.user_id AS cashier_id,
    u.name AS cashier_name,
    u.username AS cashier_username,
    COUNT(s.sale_id) AS bills_processed,
    COALESCE(SUM(s.total_amount), 0.00) AS total_revenue_collected,
    CASE
        WHEN COUNT(s.sale_id) > 0 THEN ROUND(SUM(s.total_amount) / COUNT(s.sale_id), 2)
        ELSE 0.00
    END AS average_basket_value
FROM users u
LEFT JOIN sales s ON u.user_id = s.cashier_id
WHERE u.role = 'cashier'
GROUP BY u.user_id, u.name, u.username
ORDER BY total_revenue_collected DESC, bills_processed DESC;

-- ----------------------------------------------------------------------------
-- 9. Daily Revenue & Volume Trajectory (Last 30 Days with Zero Padding)
-- Concepts: Common Table Expressions (WITH / CTE), Date/Time Functions (generate_series, CURRENT_DATE, INTERVAL), TO_CHAR
-- PostgreSQL continuous calendar series aggregation
-- ----------------------------------------------------------------------------
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS day
),
daily_sales AS (
    SELECT
        sale_date::date AS day,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(sale_id) AS number_of_bills
    FROM sales
    WHERE sale_date >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY sale_date::date
)
SELECT
    TO_CHAR(ds.day, 'YYYY-MM-DD') AS date,
    COALESCE(s.revenue, 0.00) AS daily_revenue,
    COALESCE(s.number_of_bills, 0) AS daily_bills
FROM date_series ds
LEFT JOIN daily_sales s ON ds.day = s.day
ORDER BY ds.day ASC;
