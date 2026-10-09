const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/database");

/**
 * POST /api/auth/login
 * Validates credentials, verifies bcrypt hash, and returns JWT access token with safe user details
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate presence of username and password
        if (
            !username || typeof username !== "string" || username.trim() === "" ||
            !password || typeof password !== "string" || password.trim() === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const trimmedUsername = username.trim();

        // Parameterized query to find user by username
        const query = `
            SELECT user_id, name, username, password_hash, role, status
            FROM users
            WHERE username = $1;
        `;
        const result = await pool.query(query, [trimmedUsername]);

        // Generic 401 response for non-existent users
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const user = result.rows[0];

        // Generic 401 response for inactive accounts
        if (user.status !== "active") {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Verify password against bcrypt hash safely
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } catch (bcryptErr) {
            console.error("Password comparison error:", bcryptErr.message);
            isMatch = false;
        }

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET environment variable is missing");
            return res.status(500).json({
                success: false,
                message: "Authentication service misconfigured"
            });
        }

        const expiresIn = process.env.JWT_EXPIRES_IN || "15m";

        // Generate signed JWT with minimal claims (user ID and role)
        const token = jwt.sign(
            {
                userId: user.user_id,
                role: user.role
            },
            jwtSecret,
            { expiresIn }
        );

        // Return token and safe user details (never return password_hash)
        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during authentication",
            error: error.message
        });
    }
};

/**
 * GET /api/auth/me
 * Returns authenticated user's current safe profile from PostgreSQL
 */
const getMe = async (req, res) => {
    try {
        // Query PostgreSQL to guarantee up-to-date state
        const query = `
            SELECT user_id, name, username, role, status, created_at
            FROM users
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [req.user.user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.rows[0];

        if (user.status !== "active") {
            return res.status(401).json({
                success: false,
                message: "Account is inactive"
            });
        }

        res.status(200).json({
            success: true,
            user: {
                user_id: user.user_id,
                name: user.name,
                username: user.username,
                role: user.role,
                status: user.status,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error("Error fetching current user profile:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve user profile",
            error: error.message
        });
    }
};

module.exports = {
    login,
    getMe
};
