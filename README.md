# Nature's Basket — Grocery Store Management System

Nature's Basket is a full-featured grocery store management web application engineered for neighborhood supermarkets and organic food retailers. The system streamlines day-to-day retail operations across multi-role store personnel, covering inventory replenishment, catalog management, point-of-sale transactional billing, historical sales audits, and business analytics.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture and Folder Structure](#3-architecture-and-folder-structure)
4. [Database Design](#4-database-design)
5. [Backend Features Implemented](#5-backend-features-implemented)
6. [Authorization Matrix](#6-authorization-matrix)
7. [Testing](#7-testing)
8. [Frontend Design Progress](#8-frontend-design-progress)
9. [Setup and Run Instructions](#9-setup-and-run-instructions)
10. [Git and Security](#10-git-and-security)

---

## 1. Project Overview

Nature's Basket organizes retail operations into tailored experiences for three key store roles:

- **Owner (Administrator):** Oversees complete store health. The Owner manages product catalog listings, creates and manages categories, adjusts reorder thresholds, tracks store inventory, reviews global sales transactions, and monitors financial analytics (revenue trends, best-selling products, cashier sales performance).
- **Staff (Inventory & Floor Operations):** Focuses on warehouse and shelf stock maintenance. Staff can view product and category catalogs, monitor low-stock alerts, and perform restocking updates (`PATCH /api/inventory/:id/stock`). Staff members do not process register sales and cannot access financial analytics.
- **Cashier (Point of Sale):** Operates checkout registers. Cashiers can browse active products and categories, verify stock availability, generate customer checkout bills (`POST /api/sales`), and inspect receipts for their own checkout sessions. Cashiers cannot modify product pricing, restock inventory, or inspect store-wide analytics.

### Core Workflows

1. **Product & Category Management:** Hierarchical categorization of grocery items, unit pricing, real-time stock levels, reorder warning thresholds, and active/inactive status toggling.
2. **Inventory & Stock Tracking:** Low-stock tracking with calculated deficit metrics (`reorder_level - stock_quantity`), query filtering, and atomic row-locked restocking.
3. **Point of Sale (POS) Billing:** High-speed barcode/item lookup, transactional cart submission, line item calculation with database-persisted prices, atomic stock decrements, and automatic rollback protection.
4. **Sales Records & Auditing:** Paginated sales register with cashier attribution and line-item breakdowns, enforcing role-scoped visibility.
5. **Business Analytics:** Owner analytics covering gross revenue, average basket size, units sold, daily sales trends with calendar series padding, top-selling items, and individual cashier sales totals.

---

## 2. Technology Stack

### Frontend *(Implemented)*
- **Framework & Language:** React (v19.x), JavaScript (ESModules).
- **Build Tool & Dev Server:** Vite (v8.x) with `@vitejs/plugin-react` and local API proxy to `http://localhost:5000`.
- **Routing:** React Router DOM (v7.x) with role-protected client-side navigation.
- **Styling Architecture:** Vanilla CSS design tokens (`theme.css`) implementing the verified Nature's Basket botanical design system (parchment canvas `#FDFBF7`, forest green `#2C5F2D`, burgundy `#8A3033`, Playfair Display editorial typography).
- **Linter:** Oxlint (high-performance static code analysis).

### Backend *(Implemented)*
- **Runtime:** Node.js (CommonJS modules).
- **Framework:** Express.js (v5.x).
- **Security & Utilities:** `jsonwebtoken` (JWT authentication), `bcryptjs` (password hashing), `dotenv` (environment configuration), `cors` (Cross-Origin Resource Sharing).
- **Database Driver:** `pg` (node-postgres connection pool).

### Database
- **Engine:** PostgreSQL relational database.
- **Management Client:** pgAdmin 4 and PostgreSQL CLI (`psql`).

### Development & Collaboration Tools
- **IDE:** Google Antigravity IDE.
- **Version Control:** Git and GitHub.

---

## 3. Architecture and Folder Structure

The project separates concerns across database definitions, server-side APIs, documentation, and the upcoming frontend client:

```text
Natures_basket/
├── .env.example                     # Sample template for local environment variables
├── .gitignore                       # Git ignore rules (node_modules, .env, build output)
├── README.md                        # Master project documentation
├── backend/                         # Node.js + Express backend application
│   ├── config/                      # Configuration helpers (reserved for future adapters)
│   ├── controllers/                 # Request handlers and business logic
│   │   ├── analyticsController.js   # Owner dashboard metrics and aggregation queries
│   │   ├── authController.js        # User login and profile (/me) handlers
│   │   ├── categoryController.js    # Category CRUD and status management
│   │   ├── inventoryController.js   # Stock listing, low-stock alerts, row-locked restock
│   │   ├── productController.js     # Product CRUD, validation, and status toggles
│   │   └── salesController.js       # Transactional checkout billing and sales history
│   ├── db/
│   │   └── database.js              # PostgreSQL pg.Pool connection singleton
│   ├── middleware/
│   │   └── authMiddleware.js        # JWT verification and role-based access control (RBAC)
│   ├── routes/                      # Express route definitions
│   │   ├── analyticsRoutes.js       # Endpoints under /api/analytics
│   │   ├── authRoutes.js            # Endpoints under /api/auth
│   │   ├── categoryRoutes.js        # Endpoints under /api/categories
│   │   ├── inventoryRoutes.js       # Endpoints under /api/inventory
│   │   ├── productRoutes.js         # Endpoints under /api/products
│   │   └── salesRoutes.js           # Endpoints under /api/sales
│   ├── scripts/
│   │   └── updateSeedPasswords.js   # Safe CLI utility to hash development user passwords
│   ├── services/                    # Service layer (reserved for external integrations)
│   ├── tests/                       # Automated regression and API test suites
│   │   ├── analytics.test.js        # Analytics access control, date validation, and metrics tests
│   │   ├── auth_product_category.test.js # Auth, product, and category test suite
│   │   ├── inventory.test.js        # Inventory filtering, permission, and stock update tests
│   │   ├── run_all_tests.js         # Test runner orchestrating all test suites
│   │   └── sales.test.js            # POS billing transaction and rollback test suite
│   ├── package.json                 # Backend scripts and dependencies
│   ├── package-lock.json            # Exact dependency lockfile
│   └── server.js                    # Express application entrypoint and middleware assembly
├── database/                        # Database scripts directory
│   ├── queries.sql                  # Reference queries and testing scripts
│   ├── schema.sql                   # Core table schemas and relational constraints
│   └── seed.sql                     # Initial seed data for store setup
├── docs/                            # Project documentation assets
└── frontend/                        # React + Vite frontend client application
    ├── public/                      # Static assets
    ├── src/
    │   ├── api/                     # Centralized API service modules
    │   │   ├── analyticsApi.js      # Executive analytics client
    │   │   ├── authApi.js           # Authentication & profile client
    │   │   ├── categoryApi.js       # Category management client
    │   │   ├── client.js            # Base HTTP client with Bearer auth injection
    │   │   ├── inventoryApi.js      # Stock management client
    │   │   ├── productApi.js        # Catalog management client
    │   │   └── salesApi.js          # POS checkout & sales history client
    │   ├── components/              # Shared UI & layout components
    │   │   ├── layout/              # AppLayout, TopNavbar, PageHeader, ProtectedRoute
    │   │   └── ui/                  # Button, Badge, Modal, DataTable, MetricCard, etc.
    │   ├── context/                 # AuthContext (JWT session) & ToastContext
    │   ├── screens/                 # Seven operational role-based screens
    │   │   ├── LoginScreen.jsx      # Branded authentication screen
    │   │   ├── DashboardScreen.jsx  # Owner executive analytics & sales trend
    │   │   ├── ProductsScreen.jsx   # Product catalog CRUD with search/filters
    │   │   ├── CategoriesScreen.jsx # Category CRUD and status toggles
    │   │   ├── InventoryScreen.jsx  # Stock levels, low-stock alerts & restocking
    │   │   ├── PosScreen.jsx        # POS high-speed register & instant receipt
    │   │   └── SalesHistoryScreen.jsx # Historical audit ledger & itemized receipts
    │   ├── styles/                  # Heritage botanical design tokens (theme.css)
    │   ├── App.jsx                  # Application routes with ProtectedRoute
    │   └── main.jsx                 # React root mounting
    ├── index.html                   # HTML entrypoint with Google Fonts
    ├── package.json                 # Frontend scripts and dependencies
    └── vite.config.js               # Vite config with backend proxy (/api -> :5000)
```

> **Note on Architecture:**
> - `frontend/` houses the complete React + Vite client, communicating via relative `/api` calls proxied to the Express backend.
> - `database/` houses standard SQL scripts (`schema.sql`, `seed.sql`, `queries.sql`) matching the PostgreSQL database schema and initial starter data.
> - `docs/` is designated for design specifications and architecture references.

---

## 4. Database Design

The relational schema in PostgreSQL consists of five interconnected tables designed for referential integrity, domain constraint validation, and concurrent transaction safety:

### Table Summary

```
   ┌───────────┐         ┌────────────┐
   │   users   │         │ categories │
   └─────┬─────┘         └─────┬──────┘
         │ 1                   │ 1
         │                     │
         │ *                   │ *
   ┌─────┴─────┐         ┌─────┴──────┐
   │   sales   │         │  products  │
   └─────┬─────┘         └─────┬──────┘
         │ 1                   │ 1
         │                     │
         │ *                   │ *
   ┌─────┴─────────────────────┴──────┐
   │            sale_items            │
   └──────────────────────────────────┘
```

#### 1. `users`
Stores store personnel credentials and roles:
- `user_id` (`SERIAL PRIMARY KEY`): Unique user identifier.
- `name` (`VARCHAR(100) NOT NULL`): Employee full name.
- `username` (`VARCHAR(50) NOT NULL UNIQUE`): Unique login handle.
- `password_hash` (`VARCHAR(255) NOT NULL`): Secure bcrypt password hash (never stored in plaintext).
- `role` (`VARCHAR(20) NOT NULL`): Role classification with `CHECK (role IN ('cashier', 'staff', 'owner'))`.
- `status` (`VARCHAR(20) NOT NULL DEFAULT 'active'`): Account status with `CHECK (status IN ('active', 'inactive'))`.
- `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`): Record creation timestamp.

#### 2. `categories`
Organizes merchandise into operational store departments:
- `category_id` (`SERIAL PRIMARY KEY`): Unique category identifier.
- `category_name` (`VARCHAR(100) NOT NULL UNIQUE`): Unique category label (e.g., "Fresh Produce", "Dairy & Eggs").
- `status` (`VARCHAR(20) NOT NULL DEFAULT 'active'`): Status with `CHECK (status IN ('active', 'inactive'))`.

#### 3. `products`
Catalog of sellable inventory:
- `product_id` (`SERIAL PRIMARY KEY`): Unique item identifier.
- `product_name` (`VARCHAR(150) NOT NULL`): Display name of the grocery item.
- `category_id` (`INTEGER NOT NULL REFERENCES categories(category_id)`): Foreign key linking to category.
- `price` (`NUMERIC(10,2) NOT NULL`): Unit selling price with `CHECK (price >= 0)`.
- `stock_quantity` (`INTEGER NOT NULL`): Quantity on hand with `CHECK (stock_quantity >= 0)`.
- `reorder_level` (`INTEGER NOT NULL`): Low-stock threshold with `CHECK (reorder_level >= 0)`.
- `status` (`VARCHAR(20) NOT NULL DEFAULT 'active'`): Status with `CHECK (status IN ('active', 'inactive'))`.
- `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`): Timestamp of creation.
- `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`): Timestamp of last modification.

#### 4. `sales`
Transaction headers created during register checkout:
- `sale_id` (`SERIAL PRIMARY KEY`): Unique transaction invoice number.
- `cashier_id` (`INTEGER NOT NULL REFERENCES users(user_id)`): Register cashier foreign key.
- `sale_date` (`TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`): Transaction timestamp.
- `total_amount` (`NUMERIC(10,2) NOT NULL`): Final invoice total with `CHECK (total_amount >= 0)`.

#### 5. `sale_items`
Individual line items belonging to a sale:
- `sale_item_id` (`SERIAL PRIMARY KEY`): Unique line item identifier.
- `sale_id` (`INTEGER NOT NULL REFERENCES sales(sale_id)`): Parent invoice foreign key.
- `product_id` (`INTEGER NOT NULL REFERENCES products(product_id)`): Sold product foreign key.
- `quantity` (`INTEGER NOT NULL`): Units purchased with `CHECK (quantity > 0)`.
- `unit_price` (`NUMERIC(10,2) NOT NULL`): Locked unit price snapshot at time of sale with `CHECK (unit_price >= 0)`.
- `subtotal` (`NUMERIC(10,2) NOT NULL`): Line total (`quantity * unit_price`) with `CHECK (subtotal >= 0)`.

### Database Scripts Purpose
- **`database/schema.sql`**: Contains the DDL statements for creating the five core tables, foreign keys, unique constraints, check conditions, and performance indexes.
- **`database/seed.sql`**: Provides default initial seed data, including pre-populated grocery categories, starter catalog products, and initial staff user profiles.
- **`database/queries.sql`**: Houses standardized reference SQL queries for testing, inventory reports, daily revenue summaries, and operational checks.

> **Security Note:** Neither database scripts nor environment templates contain real credentials or production passwords. Seeded accounts require development password generation via `backend/scripts/updateSeedPasswords.js`.

---

## 5. Backend Features Implemented

The Express application is fully implemented, verified, and protected by JWT authentication and role authorization:

### 1. Server & PostgreSQL Connection
- Connection pooling with configurable pool clients via `pg.Pool`.
- Global error handling, JSON request body parsing, and CORS support.
- Connectivity verification endpoints: `GET /` and `GET /api/test-db`.

### 2. Authentication & User Profile (`/api/auth`)
- **`POST /api/auth/login`**: Accepts `{ username, password }`. Verifies user existence, checks active account status, compares bcrypt password hash, and issues signed JWT tokens containing `userId` and `role`.
- **`GET /api/auth/me`**: Reads Bearer token, queries PostgreSQL in real-time, verifies account status, and returns safe user details (`user_id`, `name`, `username`, `role`, `status`, `created_at`) without exposing `password_hash`.

### 3. Category Management (`/api/categories`)
- **`GET /api/categories`**: Returns all categories sorted by ID (accessible by all authenticated roles).
- **`GET /api/categories/:id`**: Returns a single category by ID (accessible by all authenticated roles).
- **`POST /api/categories`**: Creates a new category (Owner only). Validates uniqueness; duplicate names return `409 Conflict`.
- **`PUT /api/categories/:id`**: Updates category name (Owner only).
- **`PATCH /api/categories/:id/status`**: Updates status to `'active'` or `'inactive'` (Owner only).

### 4. Product Catalog Management (`/api/products`)
- **`GET /api/products`**: Lists all products joined with their parent category name (accessible by all authenticated roles).
- **`GET /api/products/:id`**: Retrieves a single product with category details (accessible by all authenticated roles).
- **`POST /api/products`**: Inserts a new product with complete validation of required fields (`product_name`, `category_id`, non-negative numeric `price`, non-negative integer `stock_quantity`, non-negative integer `reorder_level`) (Owner only).
- **`PUT /api/products/:id`**: Updates all product attributes (Owner only).
- **`PATCH /api/products/:id/status`**: Toggles product status between `'active'` and `'inactive'` (Owner only).

### 5. Inventory & Stock Management (`/api/inventory`)
- **`GET /api/inventory`**: Returns inventory records joined with category names. Supports query filtering by `low_stock=true`, `status=active|inactive`, and `category_id=<id>`. Adds a computed `is_low_stock` boolean flag. (Accessible by Cashier, Staff, Owner).
- **`GET /api/inventory/low-stock`**: Returns only products where `stock_quantity <= reorder_level` ordered by lowest stock first, computing the stock `deficit` (`reorder_level - stock_quantity`). (Accessible by Cashier, Staff, Owner).
- **`PATCH /api/inventory/:id/stock`**: Atomically updates `stock_quantity`. Uses row-level locking (`SELECT ... FOR UPDATE`) in a dedicated transaction. Validates non-negative integer quantity, rejects inactive products (`400 Bad Request`), and strictly protects other fields (price, category, name) from being altered. (Staff and Owner only; Cashier forbidden).

### 6. Transactional Billing & POS Sales (`/api/sales`)
- **`POST /api/sales`**: Creates an atomic sale invoice (Cashier only).
  - Accepts `{ items: [{ product_id, quantity }] }`.
  - Automatically merges duplicate product IDs into single consolidated quantities.
  - Validates positive integers for product IDs and quantities.
  - Acquires a dedicated PostgreSQL pool client and begins a database transaction (`BEGIN`).
  - Sorts product IDs in ascending order and locks product rows using `SELECT ... FOR UPDATE` to eliminate concurrency deadlocks.
  - Rejects nonexistent products (`400`) and inactive products (`400`).
  - Verifies available stock against requested quantities; rejects with `400` if stock is insufficient.
  - Computes subtotals and invoice total using database price snapshots in integer paise to eliminate floating-point precision errors.
  - Creates the `sales` record, inserts each `sale_items` record, and decrements product `stock_quantity` with conditional updates (`WHERE product_id = $2 AND stock_quantity >= $1`).
  - Commits the transaction (`COMMIT`) or executes a complete rollback (`ROLLBACK`) on any failure, leaving stock and records untouched.
- **`GET /api/sales`**: Retrieves paginated sales history (`page`, `limit`).
  - Owner: Views all sales across all cashiers.
  - Cashier: Scoped strictly to their own checkout sales (`WHERE cashier_id = $1`).
  - Staff: Forbidden (`403`).
- **`GET /api/sales/:id`**: Retrieves sale invoice by ID with cashier info and detailed line items.
  - Owner: Views any sale invoice.
  - Cashier: Can only view their own sale; returns `404 Not Found` for another cashier's sale to prevent information leakage.
  - Staff: Forbidden (`403`).

### 7. Store Analytics (`/api/analytics`)
*All analytics endpoints require valid JWT authentication and the `owner` role. Staff and Cashiers receive `403 Forbidden`.*
- **`GET /api/analytics/overview`**: Returns aggregate performance metrics (`total_revenue`, `number_of_bills`, `average_bill_value`, `total_units_sold`) for a date range (defaults to the last 30 days).
- **`GET /api/analytics/sales-trend`**: Returns chronological daily breakdown (`date`, `revenue`, `number_of_bills`, `units_sold`). Uses PostgreSQL `generate_series` to ensure days with zero sales are included.
- **`GET /api/analytics/top-products`**: Returns best-selling products ranked by units sold and revenue calculated from persisted `sale_items.subtotal`. Supports a customizable `limit` parameter (default: 5, max: 100).
- **`GET /api/analytics/cashier-performance`**: Returns metrics per cashier (`cashier_id`, `cashier_name`, `number_of_bills`, `total_revenue`, `average_bill_value`), filtering strictly to users with the `cashier` role.
- Date handling: Accepts `start_date` and `end_date` query parameters in strict `YYYY-MM-DD` format, validates calendar correctness, ensures `start_date <= end_date`, and caps queries at 366 days.

### Complete API Route Reference

| Method | Endpoint | Allowed Roles | Description |
|:---|:---|:---|:---|
| `GET` | `/` | Public | System status and service greeting |
| `GET` | `/api/test-db` | Public | Live database connectivity diagnostic |
| `POST` | `/api/auth/login` | Public | Authenticates user and issues JWT token |
| `GET` | `/api/auth/me` | Authenticated | Retrieves current user profile |
| `GET` | `/api/categories` | Cashier, Staff, Owner | Lists all merchandise categories |
| `GET` | `/api/categories/:id` | Cashier, Staff, Owner | Gets a specific category by ID |
| `POST` | `/api/categories` | Owner | Creates a new category |
| `PUT` | `/api/categories/:id` | Owner | Updates an existing category name |
| `PATCH` | `/api/categories/:id/status` | Owner | Updates category status (`active`/`inactive`) |
| `GET` | `/api/products` | Cashier, Staff, Owner | Lists all products with categories |
| `GET` | `/api/products/:id` | Cashier, Staff, Owner | Gets product details by ID |
| `POST` | `/api/products` | Owner | Creates a new product |
| `PUT` | `/api/products/:id` | Owner | Updates product details |
| `PATCH` | `/api/products/:id/status` | Owner | Updates product status (`active`/`inactive`) |
| `GET` | `/api/inventory` | Cashier, Staff, Owner | Lists inventory with optional filters |
| `GET` | `/api/inventory/low-stock` | Cashier, Staff, Owner | Lists items at or below reorder level |
| `PATCH` | `/api/inventory/:id/stock` | Staff, Owner | Atomically updates product stock |
| `POST` | `/api/sales` | Cashier | Generates bill and commits sale transaction |
| `GET` | `/api/sales` | Cashier (own), Owner (all) | Paginated sales transaction list |
| `GET` | `/api/sales/:id` | Cashier (own), Owner (any) | Gets sale receipt details with line items |
| `GET` | `/api/analytics/overview` | Owner | Store overview KPI summary metrics |
| `GET` | `/api/analytics/sales-trend` | Owner | Daily sales trends with zero-fill |
| `GET` | `/api/analytics/top-products` | Owner | Best-selling products ranked by volume |
| `GET` | `/api/analytics/cashier-performance` | Owner | Sales breakdown by cashier |

---

## 6. Authorization Matrix

The application uses standard JSON Web Tokens passed via the `Authorization: Bearer <token>` HTTP header. Unauthenticated requests are rejected with `401 Unauthorized`. Authenticated requests with insufficient privileges are rejected with `403 Forbidden`.

| Feature Area | Cashier | Staff | Owner |
|:---|:---:|:---:|:---:|
| **Browse Categories & Products** | Allowed | Allowed | Allowed |
| **Create / Edit Categories & Products** | Forbidden (403) | Forbidden (403) | Allowed |
| **Toggle Category / Product Status** | Forbidden (403) | Forbidden (403) | Allowed |
| **View Inventory & Low Stock Alerts** | Allowed | Allowed | Allowed |
| **Update Stock Quantity (Restock)** | Forbidden (403) | Allowed | Allowed |
| **Create POS Bill (Checkout Sale)** | Allowed | Forbidden (403) | Forbidden (403) |
| **View Own Sales History** | Allowed | Forbidden (403) | Allowed |
| **View All Sales History (Store-wide)** | Forbidden (404/403) | Forbidden (403) | Allowed |
| **Store Analytics & Financial KPIs** | Forbidden (403) | Forbidden (403) | Allowed |

---

## 7. Testing

### Test Suite Execution
The backend features an automated regression and integration test suite that spins up ephemeral test servers, verifies status codes and response bodies, asserts database state before and after transactions, and safely restores baseline database records upon completion.

The test script is defined in `backend/package.json`:

```bash
# Navigate to the backend directory
cd backend

# Execute all test suites
npm test
# Equivalent to: node tests/run_all_tests.js
```

### Test Suites Covered
1. **Authentication, Products, & Categories (`auth_product_category.test.js`)**:
   - Rejection of unauthenticated requests across 10 endpoints (`401`).
   - Rejection of malformed authorization headers, expired tokens, tampered signatures, and inactive accounts (`401`).
   - Read permissions for Cashier and Staff (`200`).
   - Rejection of write operations for Cashier and Staff (`403`).
   - Successful Owner CRUD operations for products and categories (`201`, `200`).
   - Schema and constraint validation (unique category duplicate detection `409`, missing fields `400`, negative price `400`).
   - Automatic cleanup of created test records.

2. **Inventory Management (`inventory.test.js`)**:
   - Rejection of unauthenticated inventory access (`401`).
   - Cashier read-only access and rejection of Cashier stock updates (`403`).
   - Successful stock updates by Staff and Owner (`200`).
   - Product ID and stock quantity validation (rejection of strings, decimals, and negative values).
   - Inactive product restocking prohibition (`400`).
   - Low-stock reorder filtering and deficit calculation.
   - Field preservation verification (confirms price, name, and category cannot be altered via stock endpoints).
   - Concurrency integrity during simultaneous stock modifications.

3. **POS Billing & Sales Transactions (`sales.test.js`)**:
   - Token validation and cashier-only bill creation restriction (`403` for Staff and Owner).
   - Correct subtotal and total recalculation using database price snapshots.
   - Exact database stock decrement matching purchased quantities.
   - Rejection and automatic rollback for insufficient stock, inactive products, and nonexistent items.
   - Duplicate line item consolidation in single carts.
   - Cashier data isolation (Cashier A receives `404` when attempting to read Cashier B's sale).
   - Owner access to global sales and Staff rejection (`403`).
   - Pagination limit, page number, and descending order verification.
   - Complete restoration of initial stock baselines and cleanup of temporary sales.

4. **Business Analytics (`analytics.test.js`)**:
   - Rejection of unauthenticated, malformed, expired, tampered, and inactive tokens (`401`).
   - Access restriction denying Cashier and Staff across all analytics endpoints (`403`).
   - Successful Owner access across all four analytics routes (`200`).
   - Strict `YYYY-MM-DD` date validation, calendar validity, inverted dates check, and 366-day window limits.
   - Overview KPI verification against controlled test sales.
   - Daily sales trend verification ensuring zero-sales dates are populated via `generate_series`.
   - Top-selling products ranked accurately by units sold and persisted subtotal revenue.
   - Cashier performance metrics calculation scoped strictly to cashiers.
   - Graceful handling of date ranges with zero sales (returns zeros instead of `null`).
   - Purge of all test sales and line items.

### Test Results Verification
When executed against the local PostgreSQL test database, all 4 test suites pass cleanly:
- `auth_product_category.test.js`: **23/23 tests passed**
- `inventory.test.js`: **10/10 tests passed**
- `sales.test.js`: **17/17 tests passed**
- `analytics.test.js`: **12/12 tests passed**
- **Overall Result:** **62/62 tests passed (0 failures)**

---

## 8. Frontend Implementation

The frontend client is fully implemented in React 19 and Vite 8, featuring an artisanal botanical design system and role-scoped workflows.

### Design System & Visual Direction
- **Atmosphere:** Warm, artisanal, and reliable grocery aesthetic.
- **Color Palette:** Warm parchment background (`#FDFBF7`), deep forest green primary accents (`#2C5F2D`), muted burgundy highlights (`#8A3033`), and brand-tinted dark charcoal text (`#1F2421`).
- **Typography:** Editorial serif typography (*Playfair Display*) for page headings, script branding (*Fleur De Leah*) for wordmarks, paired with crisp sans-serif (*Plus Jakarta Sans*) for tabular operational data.
- **Micro-Interactions:** Subtle CSS micro-animations, toast notifications, responsive mobile drawer, and accessible dialogs with escape-key termination and backdrop containment.
- **Table Philosophy:** Management tables intentionally omit product photographs to prioritize scannability, operational speed, and dense data display.

### Implemented Screens
1. **Login Screen (`/login`)**: Branded credentials form, password visibility toggle, quick-fill development operator selector, and role-based redirector.
2. **Owner Dashboard (`/dashboard`)**: Executive analytics overview tiles (Gross Revenue, Orders, Basket Size, Units Dispensed), SVG sales trajectory area chart, best-selling product rankings, cashier throughput audit, and flexible date-range filters.
3. **Products Management (`/products`)**: Real-time product catalog table with search, category filtering, stock badges, and modal forms for adding and editing products.
4. **Categories Management (`/categories`)**: Category listing with product counts, status badges, and modal forms for creating and editing categories.
5. **Inventory & Stock (`/inventory`)**: Real-time inventory table with low-stock deficit indicators (`reorder_level - stock_quantity`), query filtering, and atomic row-locked restocking dialogs.
6. **Point of Sale / POS Billing (`/pos`)**: High-speed cashier checkout terminal with catalog search, responsive cart drawer, quantity limit enforcement, atomic checkout settlement, and printable receipt generation.
7. **Sales History & Receipts (`/sales`)**: Paginated historical transaction ledger with role isolation (Cashier views own sales; Owner views all store sales; Staff forbidden), search filters, and itemized receipt modal with line items and print support.

---

## 9. Setup and Run Instructions

### Prerequisites
- **Node.js:** v18.x, v20.x, or v24.x LTS.
- **PostgreSQL:** v14 or newer running locally or on a network host.
- **Database Tool:** pgAdmin 4 or `psql` command line tool.
- **Git:** Git CLI for repository version control.

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Anurag0412/nature-s-basket.git
cd nature-s-basket
```

---

### Step 2: Configure Environment Variables
Copy the example environment template into a new `.env` file at the root of the project:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure the parameters for your local environment:

```env
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=Nature_s_Basket
DB_USER=postgres
DB_PASSWORD=your_actual_postgresql_password

JWT_SECRET=your_secure_random_jwt_secret_key_here
JWT_EXPIRES_IN=15m
```

> **Security Rule:** Never commit `.env` to Git. The `.gitignore` file is pre-configured to keep `.env` strictly untracked.

---

### Step 3: Install Backend Dependencies
```bash
cd backend
npm install
```

---

### Step 4: Initialize and Seed PostgreSQL Database

1. Open pgAdmin 4 or connect via `psql`.
2. Create the database:
   ```sql
   CREATE DATABASE "Nature_s_Basket";
   ```
3. Initialize the schema and starter seed data using the repository scripts:
   ```bash
   # From the project root:
   psql -U postgres -d Nature_s_Basket -f database/schema.sql
   psql -U postgres -d Nature_s_Basket -f database/seed.sql
   ```
4. Set development passwords for the seeded users:
   ```bash
   cd backend
   node scripts/updateSeedPasswords.js
   ```
   Follow the interactive prompt to set local development passwords for each seeded user (`rahul.cashier`, `priya.cashier`, `amit.staff`, `neha.staff`, `owner.admin`).

---

### Step 5: Start the Backend Server

```bash
cd backend
npm start
# Or for development with automatic reload via nodemon:
npm run dev
```

The server will initialize on port 5000:
```text
✅ PostgreSQL connected successfully
🚀 Server running on http://localhost:5000
```

Verify backend health by navigating to:
- `http://localhost:5000/` (Returns API health status)
- `http://localhost:5000/api/test-db` (Confirms live PostgreSQL connection)

---

### Step 6: Start the Frontend Application

In a separate terminal, start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at:
- `http://localhost:5173/`

Vite is pre-configured with a development proxy that forwards all `/api/*` requests directly to `http://localhost:5000`.

---

### Step 7: Run Automated Verification & Tests

```bash
# 1. Run all backend regression and integration tests (62 tests):
cd backend
npm test

# 2. Run frontend lint and production bundle checks:
cd ../frontend
npm run lint
npm run build
```

---

## 10. Git and Security

### Environment and Secret Protection
- The `.env` file is excluded from version control via `.gitignore`.
- Secrets such as `DB_PASSWORD` and `JWT_SECRET` must never be hardcoded into source files or committed to Git history.
- The repository provides [`.env.example`](file:///c:/Users/anurag/Programming/Natures_basket/.env.example) solely as a schema reference for required environment variable names.

### Authentication & Credential Safety
- Passwords are encrypted using `bcryptjs` with 10 salt rounds before persistence.
- User queries omit `password_hash` from API response payloads.
- Authentication tokens are signed using HMAC SHA-256 via `jsonwebtoken` with short expirations (`15m` by default).
- The `authenticateToken` middleware verifies token validity and checks active account status in PostgreSQL on every protected request. Inactive accounts are immediately rejected (`401`).

### Transactional Integrity & Concurrency
- Sales transactions and stock adjustments employ explicit PostgreSQL transactions (`BEGIN` ... `COMMIT` / `ROLLBACK`).
- Deadlock prevention is enforced by sorting product IDs in ascending numerical order prior to locking rows with `SELECT ... FOR UPDATE`.
- Currency computations utilize integer paise internally to avoid JavaScript floating-point errors.
- Stock reductions use atomic conditional updates (`WHERE product_id = $2 AND stock_quantity >= $1`), ensuring items cannot be oversold even under high concurrent load.

### Parameterized Queries & SQL Injection Defense
- All database interactions throughout the controllers use parameterized queries (`$1`, `$2`, etc.), preventing SQL injection attacks.

### Repository Workflow
- Git operations (`git add`, `git commit`, `git push`, branch management) are handled manually by the project owner. Automated assistants do not execute Git mutation commands.

---

*Nature's Basket — Grocery Store Management System &copy; 2026. All rights reserved.*
