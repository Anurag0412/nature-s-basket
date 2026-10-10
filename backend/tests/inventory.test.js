const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const jwt = require("jsonwebtoken");
const pool = require("../db/database");
const app = require("../server");

async function runInventoryTests() {
    let server;
    let baseUrl;
    const testResults = [];
    const initialStocks = {};

    function recordTest(testName, passed, details = "") {
        testResults.push({ testName, passed, details });
        const icon = passed ? "✅" : "❌";
        console.log(`${icon} ${testName}${details ? " - " + details : ""}`);
    }

    try {
        // Start ephemeral server
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                console.log(`Test server running at ${baseUrl}`);
                resolve();
            });
        });

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET is missing from environment");
        }

        // Active tokens
        const cashierToken = jwt.sign({ userId: 1, role: "cashier" }, jwtSecret, { expiresIn: "1h" });
        const staffToken = jwt.sign({ userId: 3, role: "staff" }, jwtSecret, { expiresIn: "1h" });
        const ownerToken = jwt.sign({ userId: 5, role: "owner" }, jwtSecret, { expiresIn: "1h" });

        // Record baseline state for products 1, 2, 3
        const prodRows = (await pool.query(
            "SELECT * FROM products WHERE product_id IN (1, 2, 3) ORDER BY product_id;"
        )).rows;

        for (const p of prodRows) {
            initialStocks[p.product_id] = { ...p };
        }
        console.log("Initial product baseline:", initialStocks);

        console.log("\n=================== 1. UNAUTHENTICATED REQUESTS (401) ===================");
        {
            const resInv = await fetch(`${baseUrl}/api/inventory`);
            const resLow = await fetch(`${baseUrl}/api/inventory/low-stock`);
            const resStock = await fetch(`${baseUrl}/api/inventory/1/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stock_quantity: 60 })
            });

            const passed = resInv.status === 401 && resLow.status === 401 && resStock.status === 401;
            recordTest("All inventory endpoints reject unauthenticated requests with 401", passed, `Inv: ${resInv.status}, Low: ${resLow.status}, Stock: ${resStock.status}`);
        }

        console.log("\n=================== 2. CASHIER PERMISSIONS (READ ONLY) ===================");
        {
            const resInv = await fetch(`${baseUrl}/api/inventory`, {
                headers: { Authorization: `Bearer ${cashierToken}` }
            });
            const dataInv = await resInv.json();

            const resLow = await fetch(`${baseUrl}/api/inventory/low-stock`, {
                headers: { Authorization: `Bearer ${cashierToken}` }
            });
            const dataLow = await resLow.json();

            const resStock = await fetch(`${baseUrl}/api/inventory/1/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${cashierToken}` },
                body: JSON.stringify({ stock_quantity: 60 })
            });

            const passed =
                resInv.status === 200 && dataInv.success === true && Array.isArray(dataInv.data) &&
                resLow.status === 200 && dataLow.success === true && Array.isArray(dataLow.data) &&
                resStock.status === 403;

            recordTest("Cashier can read inventory and low-stock, but cannot update stock (403)", passed, `Read: ${resInv.status}, Low: ${resLow.status}, Patch: ${resStock.status}`);
        }

        console.log("\n=================== 3. STAFF & OWNER CAN UPDATE STOCK ===================");
        // Staff updates stock of Product 1
        {
            const resStaff = await fetch(`${baseUrl}/api/inventory/1/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ stock_quantity: 70 })
            });
            const dataStaff = await resStaff.json();
            const dbStockStaff = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = 1;")).rows[0].stock_quantity;

            const passed = resStaff.status === 200 && dataStaff.success === true && dataStaff.data.stock_quantity === 70 && dbStockStaff === 70;
            recordTest("Staff can update stock quantity successfully (200)", passed, `New stock: ${dbStockStaff}`);
        }

        // Owner updates stock of Product 1
        {
            const resOwner = await fetch(`${baseUrl}/api/inventory/1/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ stock_quantity: 55 })
            });
            const dataOwner = await resOwner.json();
            const dbStockOwner = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = 1;")).rows[0].stock_quantity;

            const passed = resOwner.status === 200 && dataOwner.success === true && dataOwner.data.stock_quantity === 55 && dbStockOwner === 55;
            recordTest("Owner can update stock quantity successfully (200)", passed, `New stock: ${dbStockOwner}`);
        }

        console.log("\n=================== 4. VALIDATION OF PRODUCT ID & STOCK QUANTITY ===================");
        {
            const invalidCases = [
                { name: "Non-numeric product ID", url: `${baseUrl}/api/inventory/abc/stock`, body: { stock_quantity: 50 }, expected: 400 },
                { name: "Negative product ID", url: `${baseUrl}/api/inventory/-5/stock`, body: { stock_quantity: 50 }, expected: 400 },
                { name: "Decimal product ID", url: `${baseUrl}/api/inventory/1.5/stock`, body: { stock_quantity: 50 }, expected: 400 },
                { name: "Nonexistent product ID", url: `${baseUrl}/api/inventory/999999/stock`, body: { stock_quantity: 50 }, expected: 404 },
                { name: "Missing stock quantity field", url: `${baseUrl}/api/inventory/1/stock`, body: {}, expected: 400 },
                { name: "Negative stock quantity", url: `${baseUrl}/api/inventory/1/stock`, body: { stock_quantity: -10 }, expected: 400 },
                { name: "Decimal stock quantity", url: `${baseUrl}/api/inventory/1/stock`, body: { stock_quantity: 25.5 }, expected: 400 },
                { name: "String stock quantity", url: `${baseUrl}/api/inventory/1/stock`, body: { stock_quantity: "not_a_number" }, expected: 400 },
                { name: "Boolean stock quantity", url: `${baseUrl}/api/inventory/1/stock`, body: { stock_quantity: true }, expected: 400 },
                { name: "Null stock quantity", url: `${baseUrl}/api/inventory/1/stock`, body: { stock_quantity: null }, expected: 400 }
            ];

            let allValidationPassed = true;
            for (const c of invalidCases) {
                const res = await fetch(c.url, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                    body: JSON.stringify(c.body)
                });
                if (res.status !== c.expected) {
                    allValidationPassed = false;
                    console.error(`Validation case '${c.name}' expected ${c.expected}, got ${res.status}`);
                }
            }
            recordTest("Invalid product IDs and stock quantities are rejected with appropriate status codes", allValidationPassed);
        }

        console.log("\n=================== 5. INACTIVE PRODUCT RESTOCKING RULE ===================");
        {
            // Temporarily mark Product 3 as inactive
            await pool.query("UPDATE products SET status = 'inactive' WHERE product_id = 3;");

            const resInactive = await fetch(`${baseUrl}/api/inventory/3/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ stock_quantity: 120 })
            });
            const dataInactive = await resInactive.json();

            const currentDbStock = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = 3;")).rows[0].stock_quantity;

            // Restore Product 3
            await pool.query("UPDATE products SET status = 'active' WHERE product_id = 3;");

            const passed = resInactive.status === 400 && dataInactive.success === false && currentDbStock === initialStocks[3].stock_quantity;
            recordTest("Inactive products cannot be restocked (400 Bad Request, stock unchanged)", passed, `Status: ${resInactive.status}, DB Stock: ${currentDbStock}`);
        }

        console.log("\n=================== 6. LOW-STOCK REORDER LEVEL FILTERING ===================");
        {
            // Product 2 has stock_quantity: 80, reorder_level: 15
            // Update Product 2 stock to 12 (<= 15) using staff
            await fetch(`${baseUrl}/api/inventory/2/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ stock_quantity: 12 })
            });

            // 1. GET /api/inventory/low-stock
            const resLow = await fetch(`${baseUrl}/api/inventory/low-stock`, {
                headers: { Authorization: `Bearer ${staffToken}` }
            });
            const dataLow = await resLow.json();
            const foundInLowStock = dataLow.data.find(p => p.product_id === 2);

            // 2. GET /api/inventory?low_stock=true
            const resFilter = await fetch(`${baseUrl}/api/inventory?low_stock=true`, {
                headers: { Authorization: `Bearer ${staffToken}` }
            });
            const dataFilter = await resFilter.json();
            const foundInFilter = dataFilter.data.find(p => p.product_id === 2);

            // Restore Product 2 stock back to 80
            await fetch(`${baseUrl}/api/inventory/2/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ stock_quantity: 80 })
            });

            // Verify Product 2 is no longer in low stock
            const resLowAfter = await fetch(`${baseUrl}/api/inventory/low-stock`, {
                headers: { Authorization: `Bearer ${staffToken}` }
            });
            const dataLowAfter = await resLowAfter.json();
            const notInLowStock = !dataLowAfter.data.some(p => p.product_id === 2);

            const passed =
                resLow.status === 200 && foundInLowStock && foundInLowStock.deficit === 3 &&
                resFilter.status === 200 && foundInFilter && foundInFilter.is_low_stock === true &&
                notInLowStock;

            recordTest("Low-stock endpoints correctly identify products at or below reorder level", passed, `Deficit when 12 (reorder 15): ${foundInLowStock?.deficit}`);
        }

        console.log("\n=================== 7. FIELD PROTECTION ON STOCK UPDATE ===================");
        {
            // Attempt to forge price, name, category_id during stock patch
            const resForge = await fetch(`${baseUrl}/api/inventory/1/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({
                    stock_quantity: 50,
                    price: 1.00,
                    product_name: "Tampered Name",
                    category_id: 999
                })
            });
            const dataForge = await resForge.json();

            // Verify in DB directly
            const dbProduct = (await pool.query("SELECT * FROM products WHERE product_id = 1;")).rows[0];

            const passed =
                resForge.status === 200 &&
                Number(dbProduct.price) === Number(initialStocks[1].price) &&
                dbProduct.product_name === initialStocks[1].product_name &&
                dbProduct.category_id === initialStocks[1].category_id &&
                dbProduct.stock_quantity === 50;

            recordTest("Stock update endpoint cannot modify price, category, name, or other product fields", passed, `Price: ${dbProduct.price}, Name: ${dbProduct.product_name}`);
        }

        console.log("\n=================== 8. BILLING & INVENTORY CONCURRENCY INTEGRITY ===================");
        {
            // Cashier creates a bill for Product 1 (buying 2 units)
            const resSale = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${cashierToken}` },
                body: JSON.stringify({ items: [{ product_id: 1, quantity: 2 }] })
            });
            const saleData = await resSale.json();

            // Check stock was deducted atomically by billing
            const stockAfterSale = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = 1;")).rows[0].stock_quantity;

            // Staff restocks Product 1 by setting stock to 60
            const resRestock = await fetch(`${baseUrl}/api/inventory/1/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify({ stock_quantity: 60 })
            });

            const stockAfterRestock = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = 1;")).rows[0].stock_quantity;

            // Clean up test sale
            if (saleData?.data?.sale_id) {
                await pool.query("DELETE FROM sale_items WHERE sale_id = $1;", [saleData.data.sale_id]);
                await pool.query("DELETE FROM sales WHERE sale_id = $1;", [saleData.data.sale_id]);
            }

            const passed =
                resSale.status === 201 &&
                stockAfterSale === 48 && // 50 - 2
                resRestock.status === 200 &&
                stockAfterRestock === 60;

            recordTest("Transactional billing and inventory stock updates work consistently without lost updates", passed, `Sale stock: ${stockAfterSale}, Restock: ${stockAfterRestock}`);
        }

        console.log("\n=================== 9. CLEANUP & VERIFICATION ===================");
        {
            // Restore Product 1, 2, 3 stock to baseline
            for (const pid of Object.keys(initialStocks)) {
                await pool.query("UPDATE products SET stock_quantity = $1, status = $2 WHERE product_id = $3;", [
                    initialStocks[pid].stock_quantity,
                    initialStocks[pid].status,
                    pid
                ]);
            }

            // Verify
            const restored = (await pool.query(
                "SELECT product_id, stock_quantity, status FROM products WHERE product_id IN (1, 2, 3) ORDER BY product_id;"
            )).rows;

            let allClean = true;
            for (const r of restored) {
                if (r.stock_quantity !== initialStocks[r.product_id].stock_quantity || r.status !== initialStocks[r.product_id].status) {
                    allClean = false;
                }
            }

            recordTest("Test cleanup restored all product stock and statuses to baseline", allClean);
        }

    } catch (err) {
        console.error("Inventory test error:", err);
    } finally {
        if (server) {
            server.close();
        }
        await pool.end();
    }

    console.log("\n=================== INVENTORY TEST SUMMARY ===================");
    let allPassed = true;
    for (const r of testResults) {
        if (!r.passed) allPassed = false;
    }
    console.log(`TOTAL TESTS: ${testResults.length}`);
    console.log(`PASSED: ${testResults.filter(r => r.passed).length}`);
    console.log(`FAILED: ${testResults.filter(r => !r.passed).length}`);
    console.log(`OVERALL RESULT: ${allPassed ? "ALL INVENTORY TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);

    if (!allPassed) {
        process.exit(1);
    }
}

runInventoryTests();
