const { spawnSync } = require("child_process");
const path = require("path");

const testFiles = [
    "auth_product_category.test.js",
    "inventory.test.js",
    "sales.test.js",
    "analytics.test.js"
];

console.log("=================================================");
console.log("🚀 RUNNING FULL NATURE'S BASKET TEST SUITE");
console.log("=================================================\n");

let allPassed = true;

for (const testFile of testFiles) {
    console.log(`\n▶ Running ${testFile}...`);
    const fullPath = path.join(__dirname, testFile);
    const result = spawnSync(process.execPath, [fullPath], {
        stdio: "inherit",
        cwd: path.join(__dirname, "..")
    });

    if (result.status !== 0) {
        console.error(`❌ ${testFile} failed with exit code ${result.status}`);
        allPassed = false;
        break;
    } else {
        console.log(`✅ ${testFile} passed successfully.`);
    }
}

console.log("\n=================================================");
if (allPassed) {
    console.log("🎉 ALL TEST SUITES PASSED SUCCESSFULLY! ✅");
    process.exit(0);
} else {
    console.error("💥 SOME TEST SUITES FAILED! ❌");
    process.exit(1);
}
