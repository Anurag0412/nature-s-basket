const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const jwt = require("jsonwebtoken");
const pool = require("../db/database");
const app = require("../server");

async function runTests() {
    let server;
    let baseUrl;
    const testResults = [];
    const createdCategoryIds = [];
    const createdProductIds = [];

    function recordTest(testName, passed, details = "") {
        testResults.push({ testName, passed, details });
        const icon = passed ? "✅" : "❌";
        console.log(`${icon} ${testName}${details ? " - " + details : ""}`);
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

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET is missing from environment");
        }

        // Active tokens
        const cashierToken = jwt.sign({ userId: 1, role: "cashier" }, jwtSecret, { expiresIn: "1h" });
        const staffToken = jwt.sign({ userId: 3, role: "staff" }, jwtSecret, { expiresIn: "1h" });
        const ownerToken = jwt.sign({ userId: 5, role: "owner" }, jwtSecret, { expiresIn: "1h" });

        // Invalid tokens
        const expiredToken = jwt.sign({ userId: 5, role: "owner" }, jwtSecret, { expiresIn: -10 });
        const fakeUserToken = jwt.sign({ userId: 999999, role: "owner" }, jwtSecret, { expiresIn: "1h" });
        const tamperedToken = cashierToken.slice(0, -6) + "xxxxxx";

        console.log("\n=================== 1. UNAUTHENTICATED REQUESTS (401) ===================");
        const unauthenticatedEndpoints = [
            { method: "GET", path: "/api/products", body: null },
            { method: "GET", path: "/api/products/1", body: null },
            { method: "POST", path: "/api/products", body: { product_name: "Test", category_id: 1, price: 10, stock_quantity: 5, reorder_level: 2 } },
            { method: "PUT", path: "/api/products/1", body: { product_name: "Test", category_id: 1, price: 10, stock_quantity: 5, reorder_level: 2 } },
            { method: "PATCH", path: "/api/products/1/status", body: { status: "inactive" } },
            { method: "GET", path: "/api/categories", body: null },
            { method: "GET", path: "/api/categories/1", body: null },
            { method: "POST", path: "/api/categories", body: { category_name: "Test Category" } },
            { method: "PUT", path: "/api/categories/1", body: { category_name: "Test Category" } },
            { method: "PATCH", path: "/api/categories/1/status", body: { status: "inactive" } }
        ];

        let allUnauthRejected = true;
        for (const ep of unauthenticatedEndpoints) {
            const res = await fetch(`${baseUrl}${ep.path}`, {
                method: ep.method,
                headers: ep.body ? { "Content-Type": "application/json" } : {},
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });
            const data = await res.json();
            if (res.status !== 401 || data.success !== false) {
                allUnauthRejected = false;
                console.error(`Unauthenticated ${ep.method} ${ep.path} expected 401, got ${res.status}`);
            }
        }
        recordTest("All 10 product & category endpoints reject unauthenticated requests with 401", allUnauthRejected);

        console.log("\n=================== 2. INVALID TOKENS & INACTIVE ACCOUNTS (401) ===================");
        // Malformed header
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                headers: { Authorization: "NotABearerToken" }
            });
            recordTest("Malformed Authorization header rejected with 401", res.status === 401);
        }
        // Tampered token
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                headers: { Authorization: `Bearer ${tamperedToken}` }
            });
            recordTest("Tampered token signature rejected with 401", res.status === 401);
        }
        // Expired token
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
            const data = await res.json();
            recordTest("Expired token rejected with 401", res.status === 401 && data.message === "Token has expired");
        }
        // Non-existent user payload
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                headers: { Authorization: `Bearer ${fakeUserToken}` }
            });
            recordTest("Token for non-existent user rejected with 401", res.status === 401);
        }
        // Inactive account
        {
            // Temporarily set user 2 (priya.cashier) to inactive
            await pool.query("UPDATE users SET status = 'inactive' WHERE user_id = 2;");
            const inactiveCashierToken = jwt.sign({ userId: 2, role: "cashier" }, jwtSecret, { expiresIn: "1h" });
            const res = await fetch(`${baseUrl}/api/products`, {
                headers: { Authorization: `Bearer ${inactiveCashierToken}` }
            });
            const data = await res.json();
            // Revert back to active
            await pool.query("UPDATE users SET status = 'active' WHERE user_id = 2;");
            recordTest("Inactive user account rejected with 401", res.status === 401 && data.message === "Account is inactive");
        }

        console.log("\n=================== 3. READ OPERATIONS FOR CASHIER & STAFF (200) ===================");
        // Cashier read
        {
            const resProds = await fetch(`${baseUrl}/api/products`, { headers: { Authorization: `Bearer ${cashierToken}` } });
            const dataProds = await resProds.json();
            const resProd1 = await fetch(`${baseUrl}/api/products/1`, { headers: { Authorization: `Bearer ${cashierToken}` } });
            const dataProd1 = await resProd1.json();
            const resCats = await fetch(`${baseUrl}/api/categories`, { headers: { Authorization: `Bearer ${cashierToken}` } });
            const dataCats = await resCats.json();
            const resCat1 = await fetch(`${baseUrl}/api/categories/1`, { headers: { Authorization: `Bearer ${cashierToken}` } });
            const dataCat1 = await resCat1.json();

            const passed = resProds.status === 200 && Array.isArray(dataProds.data) &&
                           resProd1.status === 200 && dataProd1.data.product_id === 1 &&
                           resCats.status === 200 && Array.isArray(dataCats.data) &&
                           resCat1.status === 200 && dataCat1.data.category_id === 1;
            recordTest("Cashier can read product and category collections and individual records", passed);
        }
        // Staff read
        {
            const resProds = await fetch(`${baseUrl}/api/products`, { headers: { Authorization: `Bearer ${staffToken}` } });
            const dataProds = await resProds.json();
            const resProd1 = await fetch(`${baseUrl}/api/products/1`, { headers: { Authorization: `Bearer ${staffToken}` } });
            const dataProd1 = await resProd1.json();
            const resCats = await fetch(`${baseUrl}/api/categories`, { headers: { Authorization: `Bearer ${staffToken}` } });
            const dataCats = await resCats.json();
            const resCat1 = await fetch(`${baseUrl}/api/categories/1`, { headers: { Authorization: `Bearer ${staffToken}` } });
            const dataCat1 = await resCat1.json();

            const passed = resProds.status === 200 && Array.isArray(dataProds.data) &&
                           resProd1.status === 200 && dataProd1.data.product_id === 1 &&
                           resCats.status === 200 && Array.isArray(dataCats.data) &&
                           resCat1.status === 200 && dataCat1.data.category_id === 1;
            recordTest("Staff can read product and category collections and individual records", passed);
        }

        console.log("\n=================== 4. WRITE OPERATIONS FORBIDDEN FOR CASHIER & STAFF (403) ===================");
        const writePayloads = [
            { method: "POST", path: "/api/products", body: { product_name: "Hack", category_id: 1, price: 1, stock_quantity: 1, reorder_level: 1 } },
            { method: "PUT", path: "/api/products/1", body: { product_name: "Hack", category_id: 1, price: 1, stock_quantity: 1, reorder_level: 1 } },
            { method: "PATCH", path: "/api/products/1/status", body: { status: "inactive" } },
            { method: "POST", path: "/api/categories", body: { category_name: "Hack Cat" } },
            { method: "PUT", path: "/api/categories/1", body: { category_name: "Hack Cat" } },
            { method: "PATCH", path: "/api/categories/1/status", body: { status: "inactive" } }
        ];

        let allCashierWriteForbidden = true;
        for (const wp of writePayloads) {
            const res = await fetch(`${baseUrl}${wp.path}`, {
                method: wp.method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${cashierToken}` },
                body: JSON.stringify(wp.body)
            });
            if (res.status !== 403) {
                allCashierWriteForbidden = false;
                console.error(`Cashier write ${wp.method} ${wp.path} expected 403, got ${res.status}`);
            }
        }
        recordTest("Cashier is forbidden (403) from all 6 product & category write endpoints", allCashierWriteForbidden);

        let allStaffWriteForbidden = true;
        for (const wp of writePayloads) {
            const res = await fetch(`${baseUrl}${wp.path}`, {
                method: wp.method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${staffToken}` },
                body: JSON.stringify(wp.body)
            });
            if (res.status !== 403) {
                allStaffWriteForbidden = false;
                console.error(`Staff write ${wp.method} ${wp.path} expected 403, got ${res.status}`);
            }
        }
        recordTest("Staff is forbidden (403) from all 6 product & category write endpoints", allStaffWriteForbidden);

        console.log("\n=================== 5. AUTHORIZED OWNER WRITE & CRUD OPERATIONS ===================");
        let testCategoryId;
        let testProductId;

        // Owner creates category
        {
            const res = await fetch(`${baseUrl}/api/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ category_name: "Automated Test Category" })
            });
            const data = await res.json();
            const passed = res.status === 201 && data.success === true && !!data.data.category_id;
            if (passed) {
                testCategoryId = data.data.category_id;
                createdCategoryIds.push(testCategoryId);
            }
            recordTest("Owner can create a category (POST /api/categories -> 201)", passed, `Category ID: ${testCategoryId}`);
        }

        // Owner updates category
        {
            const res = await fetch(`${baseUrl}/api/categories/${testCategoryId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ category_name: "Updated Test Category" })
            });
            const data = await res.json();
            const passed = res.status === 200 && data.success === true && data.data.category_name === "Updated Test Category";
            recordTest("Owner can update a category (PUT /api/categories/:id -> 200)", passed);
        }

        // Owner updates category status
        {
            const resDeactivate = await fetch(`${baseUrl}/api/categories/${testCategoryId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ status: "inactive" })
            });
            const dataDeact = await resDeactivate.json();

            const resReactivate = await fetch(`${baseUrl}/api/categories/${testCategoryId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ status: "active" })
            });
            const dataReact = await resReactivate.json();

            const passed = resDeactivate.status === 200 && dataDeact.data.status === "inactive" &&
                           resReactivate.status === 200 && dataReact.data.status === "active";
            recordTest("Owner can change category status (PATCH /api/categories/:id/status -> 200)", passed);
        }

        // Owner creates product linked to test category
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({
                    product_name: "Automated Test Organic Apples",
                    category_id: testCategoryId,
                    price: 150.50,
                    stock_quantity: 40,
                    reorder_level: 10
                })
            });
            const data = await res.json();
            const passed = res.status === 201 && data.success === true && !!data.data.product_id;
            if (passed) {
                testProductId = data.data.product_id;
                createdProductIds.push(testProductId);
            }
            recordTest("Owner can create a product (POST /api/products -> 201)", passed, `Product ID: ${testProductId}`);
        }

        // Owner updates product
        {
            const res = await fetch(`${baseUrl}/api/products/${testProductId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({
                    product_name: "Automated Test Organic Apples Updated",
                    category_id: testCategoryId,
                    price: 165.00,
                    stock_quantity: 35,
                    reorder_level: 8
                })
            });
            const data = await res.json();
            const passed = res.status === 200 && data.success === true &&
                           data.data.product_name === "Automated Test Organic Apples Updated" &&
                           Number(data.data.price) === 165 &&
                           data.data.stock_quantity === 35;
            recordTest("Owner can update a product (PUT /api/products/:id -> 200)", passed);
        }

        // Owner updates product status
        {
            const resDeact = await fetch(`${baseUrl}/api/products/${testProductId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ status: "inactive" })
            });
            const dataDeact = await resDeact.json();

            const resReact = await fetch(`${baseUrl}/api/products/${testProductId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ status: "active" })
            });
            const dataReact = await resReact.json();

            const passed = resDeact.status === 200 && dataDeact.data.status === "inactive" &&
                           resReact.status === 200 && dataReact.data.status === "active";
            recordTest("Owner can change product status (PATCH /api/products/:id/status -> 200)", passed);
        }

        console.log("\n=================== 6. VALIDATION & ERROR HANDLING (400, 404, 409) ===================");
        // Duplicate category name (409)
        {
            const res = await fetch(`${baseUrl}/api/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ category_name: "Updated Test Category" })
            });
            recordTest("Duplicate category name returns 409 Conflict", res.status === 409);
        }

        // Missing required field on product create (400)
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ product_name: "Incomplete" })
            });
            recordTest("Missing required product fields returns 400 Bad Request", res.status === 400);
        }

        // Negative price on product create (400)
        {
            const res = await fetch(`${baseUrl}/api/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({
                    product_name: "Negative Price",
                    category_id: testCategoryId,
                    price: -10,
                    stock_quantity: 10,
                    reorder_level: 5
                })
            });
            recordTest("Negative product price returns 400 Bad Request", res.status === 400);
        }

        // Invalid category status (400)
        {
            const res = await fetch(`${baseUrl}/api/categories/${testCategoryId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${ownerToken}` },
                body: JSON.stringify({ status: "suspended" })
            });
            recordTest("Invalid category status returns 400 Bad Request", res.status === 400);
        }

        // Non-existent product ID (404)
        {
            const res = await fetch(`${baseUrl}/api/products/999999`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            recordTest("Non-existent product ID returns 404 Not Found", res.status === 404);
        }

        // Non-existent category ID (404)
        {
            const res = await fetch(`${baseUrl}/api/categories/999999`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            recordTest("Non-existent category ID returns 404 Not Found", res.status === 404);
        }

        console.log("\n=================== 7. CLEANUP & VERIFICATION ===================");
        if (createdProductIds.length > 0) {
            await pool.query("DELETE FROM products WHERE product_id = ANY($1::int[]);", [createdProductIds]);
        }
        if (createdCategoryIds.length > 0) {
            await pool.query("DELETE FROM categories WHERE category_id = ANY($1::int[]);", [createdCategoryIds]);
        }

        const remainingProds = (await pool.query("SELECT COUNT(*) FROM products WHERE product_id = ANY($1::int[]);", [createdProductIds])).rows[0].count;
        const remainingCats = (await pool.query("SELECT COUNT(*) FROM categories WHERE category_id = ANY($1::int[]);", [createdCategoryIds])).rows[0].count;

        const cleanupPassed = remainingProds === "0" && remainingCats === "0";
        recordTest("Test cleanup removed test products and categories cleanly", cleanupPassed);

    } catch (err) {
        console.error("Test execution failed with error:", err);
    } finally {
        if (server) {
            server.close();
        }
        await pool.end();
    }

    console.log("\n=================== TEST SUMMARY ===================");
    let allPassed = true;
    for (const r of testResults) {
        if (!r.passed) allPassed = false;
    }
    console.log(`TOTAL TESTS: ${testResults.length}`);
    console.log(`PASSED: ${testResults.filter(r => r.passed).length}`);
    console.log(`FAILED: ${testResults.filter(r => !r.passed).length}`);
    console.log(`OVERALL RESULT: ${allPassed ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);

    if (!allPassed) {
        process.exit(1);
    }
}

runTests();
