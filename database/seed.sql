-- ============================================================================
-- Nature's Basket — Initial Development Seed Data
-- Safe, repeatable starter dataset for development and testing
--
-- SECURITY NOTE:
-- Real passwords and production secrets are NEVER stored in seed scripts.
-- Default user accounts are inserted with safe placeholder bcrypt hashes.
-- To set your local development passwords, run:
--   cd backend && node scripts/updateSeedPasswords.js
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Seed Categories (Repeatable via ON CONFLICT)
-- ----------------------------------------------------------------------------
INSERT INTO categories (category_name, status) VALUES
    ('Fruits & Vegetables', 'active'),
    ('Dairy', 'active'),
    ('Bakery', 'active'),
    ('Beverages', 'active'),
    ('Snacks', 'active'),
    ('Staples', 'active'),
    ('Personal Care', 'active'),
    ('Household', 'active')
ON CONFLICT (category_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Seed Default Development Users (Repeatable via ON CONFLICT)
-- Note: Placeholder hashes require setting local development passwords via:
--       node scripts/updateSeedPasswords.js
-- ----------------------------------------------------------------------------
INSERT INTO users (name, username, password_hash, role, status) VALUES
    ('Store Owner', 'owner.admin', '$2a$10$DEVELOPMENT_PLACEHOLDER_HASH_USE_SCRIPT_TO_SET_PASSWORD', 'owner', 'active'),
    ('Rahul Mehta', 'rahul.cashier', '$2a$10$DEVELOPMENT_PLACEHOLDER_HASH_USE_SCRIPT_TO_SET_PASSWORD', 'cashier', 'active'),
    ('Priya Sharma', 'priya.cashier', '$2a$10$DEVELOPMENT_PLACEHOLDER_HASH_USE_SCRIPT_TO_SET_PASSWORD', 'cashier', 'active'),
    ('Amit Patil', 'amit.staff', '$2a$10$DEVELOPMENT_PLACEHOLDER_HASH_USE_SCRIPT_TO_SET_PASSWORD', 'staff', 'active'),
    ('Neha Joshi', 'neha.staff', '$2a$10$DEVELOPMENT_PLACEHOLDER_HASH_USE_SCRIPT_TO_SET_PASSWORD', 'staff', 'active')
ON CONFLICT (username) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Seed Starter Catalog Products
-- Subqueries map product records to category_ids dynamically
-- ----------------------------------------------------------------------------
INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Fresh Apples', c.category_id, 180.00, 25, 10, 'active'
FROM categories c WHERE c.category_name = 'Fruits & Vegetables'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Fresh Apples');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Bananas', c.category_id, 60.00, 80, 15, 'active'
FROM categories c WHERE c.category_name = 'Fruits & Vegetables'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Bananas');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Potatoes', c.category_id, 45.00, 100, 20, 'active'
FROM categories c WHERE c.category_name = 'Fruits & Vegetables'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Potatoes');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Tomatoes', c.category_id, 55.00, 75, 15, 'active'
FROM categories c WHERE c.category_name = 'Fruits & Vegetables'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Tomatoes');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Amul Taaza Milk 1L', c.category_id, 58.00, 35, 15, 'active'
FROM categories c WHERE c.category_name = 'Dairy'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Amul Taaza Milk 1L');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Fresh Curd 500g', c.category_id, 45.00, 45, 10, 'active'
FROM categories c WHERE c.category_name = 'Dairy'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Fresh Curd 500g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Paneer 200g', c.category_id, 95.00, 35, 8, 'active'
FROM categories c WHERE c.category_name = 'Dairy'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Paneer 200g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Butter 100g', c.category_id, 25.00, 20, 10, 'active'
FROM categories c WHERE c.category_name = 'Dairy'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Butter 100g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'White Bread', c.category_id, 45.00, 50, 10, 'active'
FROM categories c WHERE c.category_name = 'Bakery'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'White Bread');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Brown Bread', c.category_id, 55.00, 40, 10, 'active'
FROM categories c WHERE c.category_name = 'Bakery'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Brown Bread');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Chocolate Cake', c.category_id, 350.00, 15, 5, 'active'
FROM categories c WHERE c.category_name = 'Bakery'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Chocolate Cake');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Coca-Cola 750ml', c.category_id, 40.00, 100, 15, 'active'
FROM categories c WHERE c.category_name = 'Beverages'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Coca-Cola 750ml');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Orange Juice 1L', c.category_id, 120.00, 35, 8, 'active'
FROM categories c WHERE c.category_name = 'Beverages'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Orange Juice 1L');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Instant Coffee 100g', c.category_id, 180.00, 30, 8, 'active'
FROM categories c WHERE c.category_name = 'Beverages'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Instant Coffee 100g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Green Tea 25 Bags', c.category_id, 150.00, 25, 6, 'active'
FROM categories c WHERE c.category_name = 'Beverages'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Green Tea 25 Bags');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Potato Chips 100g', c.category_id, 30.00, 100, 20, 'active'
FROM categories c WHERE c.category_name = 'Snacks'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Potato Chips 100g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Cream Biscuits 120g', c.category_id, 30.00, 90, 20, 'active'
FROM categories c WHERE c.category_name = 'Snacks'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Cream Biscuits 120g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Mixed Namkeen 200g', c.category_id, 85.00, 45, 10, 'active'
FROM categories c WHERE c.category_name = 'Snacks'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Mixed Namkeen 200g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Basmati Rice 5kg', c.category_id, 650.00, 25, 5, 'active'
FROM categories c WHERE c.category_name = 'Staples'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Basmati Rice 5kg');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Wheat Flour 5kg', c.category_id, 280.00, 30, 6, 'active'
FROM categories c WHERE c.category_name = 'Staples'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Wheat Flour 5kg');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Sugar 1kg', c.category_id, 48.00, 60, 15, 'active'
FROM categories c WHERE c.category_name = 'Staples'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Sugar 1kg');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Salt 1kg', c.category_id, 25.00, 70, 15, 'active'
FROM categories c WHERE c.category_name = 'Staples'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Salt 1kg');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Shampoo 180ml', c.category_id, 220.00, 35, 8, 'active'
FROM categories c WHERE c.category_name = 'Personal Care'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Shampoo 180ml');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Bath Soap Pack', c.category_id, 140.00, 50, 10, 'active'
FROM categories c WHERE c.category_name = 'Personal Care'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Bath Soap Pack');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Toothpaste 150g', c.category_id, 110.00, 45, 10, 'active'
FROM categories c WHERE c.category_name = 'Personal Care'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Toothpaste 150g');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Dishwash Liquid 500ml', c.category_id, 125.00, 40, 10, 'active'
FROM categories c WHERE c.category_name = 'Household'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Dishwash Liquid 500ml');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Laundry Detergent 1kg', c.category_id, 180.00, 35, 8, 'active'
FROM categories c WHERE c.category_name = 'Household'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Laundry Detergent 1kg');

INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
SELECT 'Floor Cleaner 1L', c.category_id, 160.00, 30, 8, 'active'
FROM categories c WHERE c.category_name = 'Household'
AND NOT EXISTS (SELECT 1 FROM products WHERE product_name = 'Floor Cleaner 1L');
