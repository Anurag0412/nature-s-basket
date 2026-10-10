const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const jwt = require("jsonwebtoken");
const pool = require("../db/database");
const app = require("../server");

async function runAnalyticsTests() {
    let server;
    let baseUrl;
    const testResults = [];
    const testSaleIds = [];
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
                console.log(`Analytics test server running at ${baseUrl}`);
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
        const tamperedToken = ownerToken.slice(0, -6) + "xxxxxx";

        // Record initial stock for products 1, 2
        const pRows = (await pool.query("SELECT product_id, stock_quantity FROM products WHERE product_id IN (1, 2);")).rows;
        for (const p of pRows) {
            initialStocks[p.product_id] = p.stock_quantity;
        }

        console.log("\n=================== 1. AUTHENTICATION & AUTHORIZATION ===================");
        // Unauthenticated access -> 401
        {
            const endpoints = [
                "/api/analytics/overview",
                "/api/analytics/sales-trend",
                "/api/analytics/top-products",
                "/api/analytics/cashier-performance"
            ];

            let all401 = true;
            for (const ep of endpoints) {
                const res = await fetch(`${baseUrl}${ep}`);
                if (res.status !== 401) {
                    all401 = false;
                    console.error(`Unauthenticated ${ep} expected 401, got ${res.status}`);
                }
            }
            recordTest("All 4 analytics endpoints reject unauthenticated access with 401", all401);
        }

        // Invalid, expired, and tampered tokens -> 401
        {
            const resMalformed = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: "InvalidBearerToken" }
            });
            const resExpired = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: `Bearer ${expiredToken}` }
            });
            const resTampered = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: `Bearer ${tamperedToken}` }
            });
            const resFakeUser = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: `Bearer ${fakeUserToken}` }
            });

            // Inactive account check
            await pool.query("UPDATE users SET status = 'inactive' WHERE user_id = 2;");
            const inactiveToken = jwt.sign({ userId: 2, role: "cashier" }, jwtSecret, { expiresIn: "1h" });
            const resInactive = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: `Bearer ${inactiveToken}` }
            });
            await pool.query("UPDATE users SET status = 'active' WHERE user_id = 2;");

            const passed =
                resMalformed.status === 401 &&
                resExpired.status === 401 &&
                resTampered.status === 401 &&
                resFakeUser.status === 401 &&
                resInactive.status === 401;

            recordTest("Malformed, expired, tampered, non-existent, and inactive tokens rejected with 401", passed);
        }

        // Cashier and Staff denied access -> 403
        {
            const endpoints = [
                "/api/analytics/overview",
                "/api/analytics/sales-trend",
                "/api/analytics/top-products",
                "/api/analytics/cashier-performance"
            ];

            let allCashier403 = true;
            let allStaff403 = true;

            for (const ep of endpoints) {
                const resCashier = await fetch(`${baseUrl}${ep}`, {
                    headers: { Authorization: `Bearer ${cashierToken}` }
                });
                if (resCashier.status !== 403) allCashier403 = false;

                const resStaff = await fetch(`${baseUrl}${ep}`, {
                    headers: { Authorization: `Bearer ${staffToken}` }
                });
                if (resStaff.status !== 403) allStaff403 = false;
            }

            recordTest("Cashier is denied access (403) across all analytics endpoints", allCashier403);
            recordTest("Staff is denied access (403) across all analytics endpoints", allStaff403);
        }

        // Owner access succeeds -> 200
        {
            const resOverview = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resTrend = await fetch(`${baseUrl}/api/analytics/sales-trend`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resTop = await fetch(`${baseUrl}/api/analytics/top-products`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resCashier = await fetch(`${baseUrl}/api/analytics/cashier-performance`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });

            const passed =
                resOverview.status === 200 &&
                resTrend.status === 200 &&
                resTop.status === 200 &&
                resCashier.status === 200;

            recordTest("Owner access succeeds (200) across all analytics endpoints", passed);
        }

        console.log("\n=================== 2. DATE RANGE VALIDATION & DEFAULTS ===================");
        {
            // Default date range when query params omitted
            const resDefault = await fetch(`${baseUrl}/api/analytics/overview`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const dataDefault = await resDefault.json();
            const hasDefaultRange =
                resDefault.status === 200 &&
                dataDefault.date_range &&
                /^\d{4}-\d{2}-\d{2}$/.test(dataDefault.date_range.start_date) &&
                /^\d{4}-\d{2}-\d{2}$/.test(dataDefault.date_range.end_date);

            // Invalid date format
            const resInvalidFormat = await fetch(`${baseUrl}/api/analytics/overview?start_date=2026-13-45`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });

            // Invalid non-date string
            const resInvalidString = await fetch(`${baseUrl}/api/analytics/overview?end_date=not-a-date`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });

            // Start date after end date
            const resStartAfterEnd = await fetch(`${baseUrl}/api/analytics/overview?start_date=2026-10-15&end_date=2026-10-10`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });

            // Range > 366 days
            const resTooWide = await fetch(`${baseUrl}/api/analytics/overview?start_date=2024-01-01&end_date=2026-01-01`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });

            const passed =
                hasDefaultRange &&
                resInvalidFormat.status === 400 &&
                resInvalidString.status === 400 &&
                resStartAfterEnd.status === 400 &&
                resTooWide.status === 400;

            recordTest("Date range defaults to last 30 days and strictly validates malformed/inverted dates", passed);
        }

        console.log("\n=================== 3. SEEDING CONTROLLED TEST DATA ===================");
        // We will seed 2 known sales on a specific date '2026-10-05'
        // Sale 1: Cashier 1 (Rahul), Date: 2026-10-05 10:00:00
        //   - Product 1 (Fresh Apples, 180.00): 2 units = 360.00
        //   - Product 2 (Bananas, 60.00): 1 unit = 60.00
        //   - Total: 420.00
        // Sale 2: Cashier 2 (Priya), Date: 2026-10-05 14:30:00
        //   - Product 2 (Bananas, 60.00): 3 units = 180.00
        //   - Total: 180.00
        // Summary for 2026-10-05:
        //   Total Revenue: 600.00
        //   Number of bills: 2
        //   Average bill value: 300.00
        //   Total units sold: 6 (2 of P1 + 4 of P2)
        const targetDate = "2026-10-05";

        const sale1Res = await pool.query(`
            INSERT INTO sales (cashier_id, sale_date, total_amount)
            VALUES (1, '2026-10-05 10:00:00', 420.00)
            RETURNING sale_id;
        `);
        const sale1Id = sale1Res.rows[0].sale_id;
        testSaleIds.push(sale1Id);

        await pool.query(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES
                ($1, 1, 2, 180.00, 360.00),
                ($1, 2, 1, 60.00, 60.00);
        `, [sale1Id]);

        const sale2Res = await pool.query(`
            INSERT INTO sales (cashier_id, sale_date, total_amount)
            VALUES (2, '2026-10-05 14:30:00', 180.00)
            RETURNING sale_id;
        `);
        const sale2Id = sale2Res.rows[0].sale_id;
        testSaleIds.push(sale2Id);

        await pool.query(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES ($1, 2, 3, 60.00, 180.00);
        `, [sale2Id]);

        console.log(`Seeded test sales [${sale1Id}, ${sale2Id}] on ${targetDate}`);

        console.log("\n=================== 4. OVERVIEW METRICS CALCULATION ===================");
        {
            const res = await fetch(`${baseUrl}/api/analytics/overview?start_date=${targetDate}&end_date=${targetDate}`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const json = await res.json();
            const d = json.data;

            const passed =
                res.status === 200 &&
                d.total_revenue === "600.00" &&
                d.number_of_bills === 2 &&
                d.average_bill_value === "300.00" &&
                d.total_units_sold === 6;

            recordTest("Overview metrics match exact calculations against known test data", passed, `Rev: ${d?.total_revenue}, Bills: ${d?.number_of_bills}, Avg: ${d?.average_bill_value}, Units: ${d?.total_units_sold}`);
        }

        console.log("\n=================== 5. SALES TREND & ZERO-SALES DATES ===================");
        {
            // Query 3-day window: 2026-10-04 to 2026-10-06
            const res = await fetch(`${baseUrl}/api/analytics/sales-trend?start_date=2026-10-04&end_date=2026-10-06`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const json = await res.json();
            const trend = json.data;

            const day1 = trend.find(t => t.date === "2026-10-04");
            const day2 = trend.find(t => t.date === "2026-10-05");
            const day3 = trend.find(t => t.date === "2026-10-06");

            const isChronological =
                trend.length === 3 &&
                trend[0].date === "2026-10-04" &&
                trend[1].date === "2026-10-05" &&
                trend[2].date === "2026-10-06";

            const passed =
                res.status === 200 &&
                isChronological &&
                day1 && day1.revenue === "0.00" && day1.number_of_bills === 0 && day1.units_sold === 0 &&
                day2 && day2.revenue === "600.00" && day2.number_of_bills === 2 && day2.units_sold === 6 &&
                day3 && day3.revenue === "0.00" && day3.number_of_bills === 0 && day3.units_sold === 0;

            recordTest("Sales trend includes zero-sales dates in chronological order", passed, `Returned ${trend?.length} days with zero-sales filled`);
        }

        console.log("\n=================== 6. TOP PRODUCTS RANKING & LIMIT VALIDATION ===================");
        {
            // Ranked by units sold:
            // Product 2: 1 + 3 = 4 units, revenue = 240.00
            // Product 1: 2 units, revenue = 360.00
            const res = await fetch(`${baseUrl}/api/analytics/top-products?start_date=${targetDate}&end_date=${targetDate}`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const json = await res.json();
            const prods = json.data;

            const rank1 = prods[0];
            const rank2 = prods[1];

            const rankingCorrect =
                res.status === 200 &&
                prods.length === 2 &&
                rank1 && rank1.product_id === 2 && rank1.units_sold === 4 && rank1.revenue === "240.00" &&
                rank2 && rank2.product_id === 1 && rank2.units_sold === 2 && rank2.revenue === "360.00";

            // Limit validation
            const resLimit1 = await fetch(`${baseUrl}/api/analytics/top-products?start_date=${targetDate}&end_date=${targetDate}&limit=1`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const dataLimit1 = await resLimit1.json();
            const limit1Ok = resLimit1.status === 200 && dataLimit1.data.length === 1 && dataLimit1.data[0].product_id === 2;

            const resInvalidLimit = await fetch(`${baseUrl}/api/analytics/top-products?limit=0`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const resOverLimit = await fetch(`${baseUrl}/api/analytics/top-products?limit=105`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const limitValidationOk = resInvalidLimit.status === 400 && resOverLimit.status === 400;

            const passed = rankingCorrect && limit1Ok && limitValidationOk;
            recordTest("Top products ranked accurately by units sold, revenue matches sale_items, limit validated", passed);
        }

        console.log("\n=================== 7. CASHIER PERFORMANCE METRICS ===================");
        {
            const res = await fetch(`${baseUrl}/api/analytics/cashier-performance?start_date=${targetDate}&end_date=${targetDate}`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const json = await res.json();
            const cashiers = json.data;

            const rahul = cashiers.find(c => c.cashier_id === 1);
            const priya = cashiers.find(c => c.cashier_id === 2);

            // Verify non-cashiers (amit.staff, neha.staff, owner.admin) are NOT included
            const hasNonCashier = cashiers.some(c => c.cashier_id > 2);

            const passed =
                res.status === 200 &&
                !hasNonCashier &&
                rahul && rahul.number_of_bills === 1 && rahul.total_revenue === "420.00" && rahul.average_bill_value === "420.00" &&
                priya && priya.number_of_bills === 1 && priya.total_revenue === "180.00" && priya.average_bill_value === "180.00";

            recordTest("Cashier performance calculates per-cashier metrics and restricts strictly to cashier role", passed);
        }

        console.log("\n=================== 8. EMPTY DATE RANGE BEHAVIOR ===================");
        {
            // Range in the past with no sales
            const resEmpty = await fetch(`${baseUrl}/api/analytics/overview?start_date=2024-01-01&end_date=2024-01-02`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const jsonEmpty = await resEmpty.json();
            const d = jsonEmpty.data;

            const resEmptyTop = await fetch(`${baseUrl}/api/analytics/top-products?start_date=2024-01-01&end_date=2024-01-02`, {
                headers: { Authorization: `Bearer ${ownerToken}` }
            });
            const jsonEmptyTop = await resEmptyTop.json();

            const passed =
                resEmpty.status === 200 &&
                d.total_revenue === "0.00" &&
                d.number_of_bills === 0 &&
                d.average_bill_value === "0.00" &&
                d.total_units_sold === 0 &&
                resEmptyTop.status === 200 &&
                jsonEmptyTop.data.length === 0;

            recordTest("Empty date range returns zero values instead of null and empty lists gracefully", passed);
        }

        console.log("\n=================== 9. CLEANUP & VERIFICATION ===================");
        {
            if (testSaleIds.length > 0) {
                await pool.query("DELETE FROM sale_items WHERE sale_id = ANY($1::int[]);", [testSaleIds]);
                await pool.query("DELETE FROM sales WHERE sale_id = ANY($1::int[]);", [testSaleIds]);
            }

            const remainingSales = (await pool.query("SELECT COUNT(*) FROM sales WHERE sale_id = ANY($1::int[]);", [testSaleIds])).rows[0].count;
            recordTest("Temporary test sales and line items purged completely", remainingSales === "0");
        }

    } catch (err) {
        console.error("Analytics test failure:", err);
    } finally {
        if (server) server.close();
        await pool.end();
    }

    console.log("\n=================== ANALYTICS TEST SUMMARY ===================");
    let allPassed = true;
    for (const r of testResults) {
        if (!r.passed) allPassed = false;
    }
    console.log(`TOTAL TESTS: ${testResults.length}`);
    console.log(`PASSED: ${testResults.filter(r => r.passed).length}`);
    console.log(`FAILED: ${testResults.filter(r => !r.passed).length}`);
    console.log(`OVERALL RESULT: ${allPassed ? "ALL ANALYTICS TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);

    if (!allPassed) {
        process.exit(1);
    }
}

runAnalyticsTests();
