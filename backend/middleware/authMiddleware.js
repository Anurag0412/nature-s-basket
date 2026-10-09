const jwt = require("jsonwebtoken");
const pool = require("../db/database");

/**
 * Authentication middleware
 * Verifies Bearer JWT token, loads current user from PostgreSQL,
 * verifies active status, and attaches safe user profile to req.user.
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"] || req.headers["Authorization"];

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Access token is required"
            });
        }

        const parts = authHeader.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1].trim()) {
            return res.status(401).json({
                success: false,
                message: "Malformed authorization header. Format must be 'Bearer <token>'"
            });
        }

        const token = parts[1].trim();
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET is not configured");
            return res.status(500).json({
                success: false,
                message: "Authentication service misconfigured"
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (jwtErr) {
            if (jwtErr.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Token has expired"
                });
            }
            return res.status(401).json({
                success: false,
                message: "Invalid or malformed token"
            });
        }

        const userId = decoded.userId || decoded.user_id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload"
            });
        }

        // Load the current user from PostgreSQL to verify existence, status, and role in real time
        const query = `
            SELECT user_id, name, username, role, status, created_at
            FROM users
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.rows[0];

        // Reject inactive accounts
        if (user.status !== "active") {
            return res.status(401).json({
                success: false,
                message: "Account is inactive"
            });
        }

        // Attach safe user profile to request (never contains password_hash)
        req.user = user;
        next();
    } catch (error) {
        console.error("Error in authenticateToken middleware:", error);
        return res.status(500).json({
            success: false,
            message: "Authentication error",
            error: error.message
        });
    }
};

/**
 * Reusable role-based authorization middleware
 * Checks if authenticated user has one of the allowed roles ('cashier', 'staff', 'owner')
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access forbidden: required role not met. Required one of: [${allowedRoles.join(", ")}]`
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    requireRole: authorizeRoles
};
