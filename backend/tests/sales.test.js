const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const jwt = require("jsonwebtoken");
const pool = require("../db/database");
const app = require("../server");

async function runSalesTests() {
    let server;
    let baseUrl;
    const testResults = [];
    const createdCategoryIds = [];
    const createdProductIds = [];
    const createdSaleIds = [];

    // Isolated test fixtures
    let prod1Id;
    let prod2Id;
    let prod3Id;
    const initialStocks = {};

    function logTest(testNum, testName, passed, details = "") {
        testResults.push({ testNum, testName, passed, details });
        const icon = passed ? "✅" : "❌";
        console.log(`${icon} Test ${testNum}: ${testName}${details ? " - " + details : ""}`);
    }

    try {
        // Start ephemeral test server
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                console.log(`Test server running at ${baseUrl}`);
                resolve();
            });
        });

        // Generate role-scoped tokens
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET is missing from environment");
        }
        const cashier1Token = jwt.sign({ userId: 1, role: "cashier" }, jwtSecret, { expiresIn: "1h" });
        const cashier2Token = jwt.sign({ userId: 2, role: "cashier" }, jwtSecret, { expiresIn: "1h" });
        const staffToken = jwt.sign({ userId: 3, role: "staff" }, jwtSecret, { expiresIn: "1h" });
        const ownerToken = jwt.sign({ userId: 5, role: "owner" }, jwtSecret, { expiresIn: "1h" });

        // --- SETUP ISOLATED TEST FIXTURES ---
        // Create a dedicated test category and isolated test products
        // This guarantees test determinism without mutating development catalog inventory
        const timestamp = Date.now();
        const catRes = await pool.query(
            "INSERT INTO categories (category_name, status) VALUES ($1, 'active') RETURNING category_id;",
            [`Test Sales Category ${timestamp}`]
        );
        const testCategoryId = catRes.rows[0].category_id;
        createdCategoryIds.push(testCategoryId);

        const prod1Res = await pool.query(
            `INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
             VALUES ($1, $2, 180.00, 20, 10, 'active') RETURNING product_id;`,
            [`Test Apples ${timestamp}`, testCategoryId]
        );
        prod1Id = prod1Res.rows[0].product_id;
        createdProductIds.push(prod1Id);

        const prod2Res = await pool.query(
            `INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
             VALUES ($1, $2, 60.00, 80, 15, 'active') RETURNING product_id;`,
            [`Test Bananas ${timestamp}`, testCategoryId]
        );
        prod2Id = prod2Res.rows[0].product_id;
        createdProductIds.push(prod2Id);

        const prod3Res = await pool.query(
            `INSERT INTO products (product_name, category_id, price, stock_quantity, reorder_level, status)
             VALUES ($1, $2, 45.00, 100, 20, 'active') RETURNING product_id;`,
            [`Test Potatoes ${timestamp}`, testCategoryId]
        );
        prod3Id = prod3Res.rows[0].product_id;
        createdProductIds.push(prod3Id);

        initialStocks[prod1Id] = { name: `Test Apples ${timestamp}`, stock: 20, price: "180.00", status: "active" };
        initialStocks[prod2Id] = { name: `Test Bananas ${timestamp}`, stock: 80, price: "60.00", status: "active" };
        initialStocks[prod3Id] = { name: `Test Potatoes ${timestamp}`, stock: 100, price: "45.00", status: "active" };

        console.log("Isolated test fixtures created:", {
            categoryId: testCategoryId,
            products: initialStocks
        });

        // --- TEST 1: Missing token cannot create a sale ---
        {
            const res = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [{ product_id: prod1Id, quantity: 1 }] })
            });
            const data = await res.json();
            const passed = res.status === 401 && data.success === false;
            logTest(1, "Missing token cannot create a sale", passed, `Status: ${res.status}`);
        }

        // --- TEST 2: Staff and owner cannot create cashier bills ---
        {
            const resStaff = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${staffToken}`
                },
                body: JSON.stringify({ items: [{ product_id: prod1Id, quantity: 1 }] })
            });
            const resOwner = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${ownerToken}`
                },
                body: JSON.stringify({ items: [{ product_id: prod1Id, quantity: 1 }] })
            });
            const passed = resStaff.status === 403 && resOwner.status === 403;
            logTest(2, "Staff and owner cannot create cashier bills", passed, `Staff: ${resStaff.status}, Owner: ${resOwner.status}`);
        }

        // --- TEST 3: Valid cashier can create a sale ---
        let sale1Id;
        {
            const res = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({
                    items: [
                        { product_id: prod1Id, quantity: 2 },
                        { product_id: prod2Id, quantity: 1 }
                    ]
                })
            });
            const data = await res.json();
            const passed = res.status === 201 && data.success === true && !!data.data.sale_id;
            if (passed) {
                sale1Id = data.data.sale_id;
                createdSaleIds.push(sale1Id);
            }
            logTest(3, "Valid cashier can create a sale", passed, `Created sale ID: ${sale1Id}`);
        }

        // --- TEST 4: Correct item subtotals and total are returned ---
        {
            const res = await fetch(`${baseUrl}/api/sales/${sale1Id}`, {
                headers: { Authorization: `Bearer ${cashier1Token}` }
            });
            const data = await res.json();
            const item1 = data.data.items.find(i => i.product_id === prod1Id);
            const item2 = data.data.items.find(i => i.product_id === prod2Id);
            const passed =
                res.status === 200 &&
                data.data.total_amount === "420.00" &&
                item1 && item1.quantity === 2 && item1.unit_price === "180.00" && item1.subtotal === "360.00" &&
                item2 && item2.quantity === 1 && item2.unit_price === "60.00" && item2.subtotal === "60.00";
            logTest(4, "Correct item subtotals and total are returned", passed, `Total: ${data.data.total_amount}`);
        }

        // --- TEST 5: Database stock decreases by exactly the purchased quantities ---
        {
            const pRes = await pool.query("SELECT product_id, stock_quantity FROM products WHERE product_id IN ($1, $2) ORDER BY product_id;", [prod1Id, prod2Id]);
            const p1 = pRes.rows.find(p => p.product_id === prod1Id);
            const p2 = pRes.rows.find(p => p.product_id === prod2Id);
            const p1Decreased = p1.stock_quantity === (initialStocks[prod1Id].stock - 2);
            const p2Decreased = p2.stock_quantity === (initialStocks[prod2Id].stock - 1);
            const passed = p1Decreased && p2Decreased;
            logTest(5, "Database stock decreases by exactly the purchased quantities", passed, `P1: ${initialStocks[prod1Id].stock} -> ${p1.stock_quantity}, P2: ${initialStocks[prod2Id].stock} -> ${p2.stock_quantity}`);
        }

        // --- TEST 6: Sale header and sale items persist consistently in DB ---
        {
            const sRes = await pool.query("SELECT * FROM sales WHERE sale_id = $1;", [sale1Id]);
            const siRes = await pool.query("SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY sale_item_id;", [sale1Id]);
            const headerOk = sRes.rows.length === 1 && sRes.rows[0].cashier_id === 1 && sRes.rows[0].total_amount === "420.00";
            const itemsOk = siRes.rows.length === 2 && siRes.rows[0].quantity === 2 && siRes.rows[1].quantity === 1;
            const passed = headerOk && itemsOk;
            logTest(6, "Sale header and sale items persist consistently in DB", passed, `Header rows: ${sRes.rows.length}, item rows: ${siRes.rows.length}`);
        }

        // --- TEST 7: Insufficient stock is rejected and stock remains unchanged ---
        {
            const stockBefore = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1;", [prod1Id])).rows[0].stock_quantity;
            const res = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({ items: [{ product_id: prod1Id, quantity: 999999 }] })
            });
            const data = await res.json();
            const stockAfter = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1;", [prod1Id])).rows[0].stock_quantity;
            const passed = res.status === 400 && data.success === false && stockBefore === stockAfter;
            logTest(7, "Insufficient stock is rejected and stock remains unchanged", passed, `Status: ${res.status}, stock stayed: ${stockAfter}`);
        }

        // --- TEST 8: Inactive / nonexistent products are rejected ---
        {
            // Nonexistent product
            const resNonexistent = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({ items: [{ product_id: 999999, quantity: 1 }] })
            });

            // Inactive product
            await pool.query("UPDATE products SET status = 'inactive' WHERE product_id = $1;", [prod3Id]);
            const resInactive = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({ items: [{ product_id: prod3Id, quantity: 1 }] })
            });
            // Revert status
            await pool.query("UPDATE products SET status = 'active' WHERE product_id = $1;", [prod3Id]);

            const passed = resNonexistent.status === 400 && resInactive.status === 400;
            logTest(8, "Inactive/nonexistent products are rejected", passed, `Nonexistent: ${resNonexistent.status}, Inactive: ${resInactive.status}`);
        }

        // --- TEST 9: Invalid quantities and empty items are rejected ---
        {
            const cases = [
                { name: "empty items array", body: { items: [] } },
                { name: "missing items key", body: {} },
                { name: "zero quantity", body: { items: [{ product_id: prod1Id, quantity: 0 }] } },
                { name: "negative quantity", body: { items: [{ product_id: prod1Id, quantity: -2 }] } },
                { name: "fractional quantity", body: { items: [{ product_id: prod1Id, quantity: 2.5 }] } },
                { name: "string non-integer quantity", body: { items: [{ product_id: prod1Id, quantity: "bad" }] } },
                { name: "invalid product ID", body: { items: [{ product_id: -1, quantity: 1 }] } }
            ];

            let allRejected = true;
            for (const c of cases) {
                const res = await fetch(`${baseUrl}/api/sales`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${cashier1Token}`
                    },
                    body: JSON.stringify(c.body)
                });
                if (res.status !== 400) {
                    allRejected = false;
                    console.error(`Case ${c.name} failed with status ${res.status}`);
                }
            }
            logTest(9, "Invalid quantities and empty items are rejected with 400", allRejected, `All ${cases.length} edge cases returned 400`);
        }

        // --- TEST 10: Forged client prices and cashier IDs are ignored ---
        let sale2Id;
        {
            const res = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({
                    cashier_id: 999,
                    user_id: 999,
                    total_amount: "1.00",
                    items: [
                        {
                            product_id: prod2Id,
                            quantity: 1,
                            unit_price: "1.00",
                            price: "1.00",
                            subtotal: "1.00"
                        }
                    ]
                })
            });
            const data = await res.json();
            const passed =
                res.status === 201 &&
                data.data.cashier_id === 1 && // Not 999
                data.data.total_amount === "60.00" && // Not 1.00
                data.data.items[0].unit_price === "60.00" &&
                data.data.items[0].subtotal === "60.00";
            if (res.status === 201) {
                sale2Id = data.data.sale_id;
                createdSaleIds.push(sale2Id);
            }
            logTest(10, "Forged client prices and cashier IDs are ignored", passed, `Cashier: ${data.data?.cashier_id}, Total: ${data.data?.total_amount}`);
        }

        // --- TEST 11: A failure after transaction start leaves no partial sale or stock change ---
        {
            const stock1Before = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1;", [prod1Id])).rows[0].stock_quantity;
            const salesCountBefore = (await pool.query("SELECT COUNT(*) FROM sales;")).rows[0].count;

            const res = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({
                    items: [
                        { product_id: prod1Id, quantity: 1 },
                        { product_id: 999999, quantity: 1 } // Non-existent causes transaction abort
                    ]
                })
            });

            const stock1After = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1;", [prod1Id])).rows[0].stock_quantity;
            const salesCountAfter = (await pool.query("SELECT COUNT(*) FROM sales;")).rows[0].count;

            const passed = res.status === 400 && stock1Before === stock1After && salesCountBefore === salesCountAfter;
            logTest(11, "Failure after transaction start leaves no partial sale or stock change", passed, `Stock1: ${stock1Before} -> ${stock1After}, Sales: ${salesCountBefore} -> ${salesCountAfter}`);
        }

        // --- TEST 12: Cashier cannot view another cashier's sale ---
        let saleCashier2Id;
        {
            // Cashier 2 creates a sale
            const resCreate = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier2Token}`
                },
                body: JSON.stringify({ items: [{ product_id: prod2Id, quantity: 1 }] })
            });
            const dataCreate = await resCreate.json();
            saleCashier2Id = dataCreate.data.sale_id;
            createdSaleIds.push(saleCashier2Id);

            // Cashier 1 attempts to view Cashier 2's sale
            const resCashier1 = await fetch(`${baseUrl}/api/sales/${saleCashier2Id}`, {
                headers: { Authorization: `Bearer ${cashier1Token}` }
            });

            // Cashier 2 views own sale
            const resCashier2 = await fetch(`${baseUrl}/api/sales/${saleCashier2Id}`, {
                headers: { Authorization: `Bearer ${cashier2Token}` }
            });

            const passed = resCashier1.status === 404 && resCashier2.status === 200;
            logTest(12, "Cashier cannot view another cashier's sale (returns 404)", passed, `Cashier1 access: ${resCashier1.status}, Cashier2 access: ${resCashier2.status}`);
        }

        // --- TEST 13: Owner can view sales according to requirements; Staff forbidden ---
        {
            const resOwnerSale1 = await fetch(`${baseUrl}/api/sales/${sale1Id}`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resOwnerSale2 = await fetch(`${baseUrl}/api/sales/${saleCashier2Id}`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resOwnerList = await fetch(`${baseUrl}/api/sales`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resStaffSale = await fetch(`${baseUrl}/api/sales/${sale1Id}`, {
                headers: { Authorization: `Bearer ${staffToken}` }
            });
            const resStaffList = await fetch(`${baseUrl}/api/sales`, {
                headers: { Authorization: `Bearer ${staffToken}` }
            });

            const ownerData = await resOwnerList.json();
            const passed =
                resOwnerSale1.status === 200 &&
                resOwnerSale2.status === 200 &&
                resOwnerList.status === 200 &&
                ownerData.data.length >= 3 &&
                resStaffSale.status === 403 &&
                resStaffList.status === 403;
            logTest(13, "Owner can view all sales; staff forbidden from viewing sales", passed, `Owner: 200/200/200 (${ownerData.data?.length} sales), Staff: 403/403`);
        }

        // --- TEST 14: Pagination validation and ordering work ---
        {
            const resBadPage = await fetch(`${baseUrl}/api/sales?page=0`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resBadLimit = await fetch(`${baseUrl}/api/sales?limit=101`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resValid = await fetch(`${baseUrl}/api/sales?page=1&limit=2`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const validData = await resValid.json();

            let orderingCorrect = true;
            if (validData.data.length >= 2) {
                const s0 = validData.data[0];
                const s1 = validData.data[1];
                const d0 = new Date(s0.sale_date).getTime();
                const d1 = new Date(s1.sale_date).getTime();
                orderingCorrect = d0 > d1 || (d0 === d1 && s0.sale_id > s1.sale_id);
            }

            const passed =
                resBadPage.status === 400 &&
                resBadLimit.status === 400 &&
                resValid.status === 200 &&
                validData.pagination.page === 1 &&
                validData.pagination.limit === 2 &&
                validData.data.length === 2 &&
                orderingCorrect;
            logTest(14, "Pagination validation, limits, and ordering work", passed, `BadPage: ${resBadPage.status}, BadLimit: ${resBadLimit.status}, PageCount: ${validData.data?.length}, Ordering: ${orderingCorrect}`);
        }

        // --- TEST 15: Existing authentication, product, and category APIs remain operational ---
        {
            const resProd = await fetch(`${baseUrl}/api/products`, {
                headers: { Authorization: `Bearer ${cashier1Token}` }
            });
            const dataProd = await resProd.json();
            const resCat = await fetch(`${baseUrl}/api/categories`, {
                headers: { Authorization: `Bearer ${cashier1Token}` }
            });
            const dataCat = await resCat.json();
            const resMe = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${cashier1Token}` }
            });
            const dataMe = await resMe.json();

            const passed =
                resProd.status === 200 && dataProd.success === true &&
                resCat.status === 200 && dataCat.success === true &&
                resMe.status === 200 && dataMe.user.username === "rahul.cashier";
            logTest(15, "Existing auth, product, and category APIs remain operational", passed, `Prod: ${resProd.status}, Cat: ${resCat.status}, Me: ${resMe.status}`);
        }

        // --- TEST EXTRA: Duplicate product ID in items array is safely combined ---
        {
            const stock1Before = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1;", [prod1Id])).rows[0].stock_quantity;
            const res = await fetch(`${baseUrl}/api/sales`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cashier1Token}`
                },
                body: JSON.stringify({
                    items: [
                        { product_id: prod1Id, quantity: 1 },
                        { product_id: prod1Id, quantity: 2 }
                    ]
                })
            });
            const data = await res.json();
            const stock1After = (await pool.query("SELECT stock_quantity FROM products WHERE product_id = $1;", [prod1Id])).rows[0].stock_quantity;
            const passed =
                res.status === 201 &&
                data.data.items.length === 1 &&
                data.data.items[0].quantity === 3 &&
                data.data.total_amount === "540.00" &&
                stock1Before - stock1After === 3;
            if (res.status === 201) {
                createdSaleIds.push(data.data.sale_id);
            }
            logTest("Extra", "Duplicate product IDs combined consistently into single line item", passed, `Combined qty: ${data.data?.items[0]?.quantity}, total: ${data.data?.total_amount}`);
        }

        // --- TEST 16: Safe test cleanup removes temporary sales, sale_items, and test fixtures ---
        {
            console.log("\nStarting safe test cleanup...");
            console.log("Created sale IDs to clean up:", createdSaleIds);
            console.log("Created test product IDs to clean up:", createdProductIds);
            console.log("Created test category IDs to clean up:", createdCategoryIds);

            if (createdSaleIds.length > 0) {
                await pool.query("DELETE FROM sale_items WHERE sale_id = ANY($1::int[]);", [createdSaleIds]);
                await pool.query("DELETE FROM sales WHERE sale_id = ANY($1::int[]);", [createdSaleIds]);
            }

            if (createdProductIds.length > 0) {
                await pool.query("DELETE FROM products WHERE product_id = ANY($1::int[]);", [createdProductIds]);
            }

            if (createdCategoryIds.length > 0) {
                await pool.query("DELETE FROM categories WHERE category_id = ANY($1::int[]);", [createdCategoryIds]);
            }

            // Verify
            const salesRemaining = (await pool.query("SELECT COUNT(*) FROM sales WHERE sale_id = ANY($1::int[]);", [createdSaleIds])).rows[0].count;
            const prodsRemaining = (await pool.query("SELECT COUNT(*) FROM products WHERE product_id = ANY($1::int[]);", [createdProductIds])).rows[0].count;

            const passed = salesRemaining === "0" && prodsRemaining === "0";
            logTest(16, "Test cleanup restores and removes temporary sales and test fixtures safely", passed, `Remaining test sales: ${salesRemaining}, Remaining test products: ${prodsRemaining}`);
        }

    } catch (err) {
        console.error("Test error:", err);
    } finally {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        try {
            if (createdSaleIds.length > 0) {
                await pool.query("DELETE FROM sale_items WHERE sale_id = ANY($1::int[]);", [createdSaleIds]);
                await pool.query("DELETE FROM sales WHERE sale_id = ANY($1::int[]);", [createdSaleIds]);
            }
            if (createdProductIds.length > 0) {
                await pool.query("DELETE FROM products WHERE product_id = ANY($1::int[]);", [createdProductIds]);
            }
            if (createdCategoryIds.length > 0) {
                await pool.query("DELETE FROM categories WHERE category_id = ANY($1::int[]);", [createdCategoryIds]);
            }
        } catch (cleanupErr) {
            console.error("Finally cleanup error:", cleanupErr.message);
        }
        await pool.end();
    }

    console.log("\n=================== SALES TEST SUMMARY ===================");
    let allPassed = true;
    for (const r of testResults) {
        if (!r.passed) allPassed = false;
        console.log(`${r.passed ? "PASS" : "FAIL"}: [Test ${r.testNum}] ${r.testName}`);
    }
    console.log(`OVERALL RESULT: ${allPassed ? "ALL SALES TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);

    if (!allPassed) {
        process.exit(1);
    }
}

runSalesTests();
