const bcrypt = require("bcryptjs");
const pool = require("../db/database");

/**
 * Safe local script to update the 5 seeded users' password hashes.
 * Passwords can be passed as an object mapping username -> plaintext password,
 * e.g., via interactive input or development config.
 * 
 * Never hardcodes or commits plaintext passwords.
 */
async function updateSeedPasswords(userPasswords) {
    const client = await pool.connect();
    try {
        console.log("Starting safe password hash update for seeded users...");
        await client.query("BEGIN");

        const usernames = Object.keys(userPasswords);
        for (const username of usernames) {
            const plaintext = userPasswords[username];
            if (!plaintext) {
                throw new Error(`Missing password for user: ${username}`);
            }

            const saltRounds = 10;
            const hash = await bcrypt.hash(plaintext, saltRounds);

            const updateQuery = `
                UPDATE users
                SET password_hash = $1
                WHERE username = $2
                RETURNING user_id, username, role, status;
            `;
            const result = await client.query(updateQuery, [hash, username]);

            if (result.rows.length === 0) {
                console.warn(`Warning: User '${username}' not found in database.`);
            } else {
                console.log(`Updated password hash for user '${username}' (ID: ${result.rows[0].user_id}, Role: ${result.rows[0].role})`);
            }
        }

        await client.query("COMMIT");
        console.log("✅ All user password hashes updated successfully.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Failed to update user password hashes. Rolled back changes.", error.message);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { updateSeedPasswords };

// If executed directly via CLI: node updateSeedPasswords.js
if (require.main === module) {
    const readline = require("readline");
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const targetUsers = [
        { username: "rahul.cashier", role: "cashier" },
        { username: "priya.cashier", role: "cashier" },
        { username: "amit.staff", role: "staff" },
        { username: "neha.staff", role: "staff" },
        { username: "owner.admin", role: "owner" }
    ];

    const passwords = {};
    let index = 0;

    function promptNext() {
        if (index >= targetUsers.length) {
            rl.close();
            updateSeedPasswords(passwords)
                .then(() => pool.end())
                .catch(() => pool.end());
            return;
        }

        const user = targetUsers[index];
        rl.question(`Enter development password for '${user.username}' (${user.role}): `, (answer) => {
            if (!answer || answer.trim() === "") {
                console.log("Password cannot be empty.");
                promptNext();
            } else {
                passwords[user.username] = answer.trim();
                index++;
                promptNext();
            }
        });
    }

    console.log("=== Nature's Basket Seed Password Hash Generator ===");
    promptNext();
}
