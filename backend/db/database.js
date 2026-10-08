const { Pool } = require("pg");
const path = require("path");
const dotenv = require("dotenv");

// Load .env from the project root
dotenv.config({
    path: path.resolve(__dirname, "../../.env")
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Test database connection
pool.connect()
    .then(client => {
        console.log("✅ PostgreSQL connected successfully");
        client.release();
    })
    .catch(error => {
        console.error("❌ PostgreSQL connection failed:");
        console.error(error.message);
    });

module.exports = pool;