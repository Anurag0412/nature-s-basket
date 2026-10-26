-- QUERY INDEX
-- Line 13: Query 1 (UNION ALL, COUNT) - System table record counts
-- Line 24: Query 2 (SELECT, ORDER BY) - Store personnel directory
-- Line 35: Query 3 (INNER JOIN) - Product catalog with category names
-- Line 49: Query 4 (WHERE) - Low-stock deficit report
-- Line 64: Query 5 (GROUP BY, LIMIT/OFFSET) - Paginated sales register
-- Line 79: Query 6 (Multi-Table JOIN) - Itemized receipt inspection
-- Line 97: Query 7 (HAVING, SUM) - Best-selling merchandise ranking
-- Line 112: Query 8 (CASE, Aggregates) - Cashier throughput audit
-- Line 129: Query 9 (CTE, Date Functions) - 30-day continuous revenue

-- 1. System & Table Diagnostics: Count records across tables (UNION ALL, COUNT)
SELECT 'users' AS table_name, COUNT(*) AS total_records FROM users
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'sale_items', COUNT(*) FROM sale_items;

-- 2. User Accounts & Role Audit: List store personnel (SELECT, ORDER BY)
SELECT
    user_id,
    name,
    username,
    role,
    status,
    created_at
FROM users
ORDER BY role ASC, user_id ASC;

-- 3. Product Catalog: List products with category names (INNER JOIN)
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

-- 4. Low-Stock Alert: Filter products below reorder level (WHERE, Expressions)
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

-- 5. Paginated Sales Register: Historical transactions with line item counts (GROUP BY, LIMIT/OFFSET)
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

-- 6. Itemized Receipt Inspection: Single bill lookup with product details (Multi-Table JOIN, WHERE)
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

-- 7. Best-Selling Products Ranking: Top merchandise by units and revenue (HAVING, SUM, LIMIT)
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

-- 8. Cashier Register Performance: Throughput and average basket audit (CASE, COUNT, SUM)
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

-- 9. Daily Revenue Trajectory: Continuous calendar series with zero padding (CTE, Date Functions)
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
