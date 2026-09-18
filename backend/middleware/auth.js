const crypto = require("crypto");
const { getLeadModelForDb, sanitizeDbName } = require("../utils/dbManager");

// Secret key for signing tokens
const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.COUNSELOR_SECRET ||
  "crm-secret-counselor-auth-key-2026";
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL || "subhamsaha88979@gmail.com"
).toLowerCase().trim();

/**
 * Generate a cryptographically signed session token.
 */
function generateToken(payload = {}) {
  const data = {
    ...payload,
    issuedAt: Date.now()
  };
  const dataStr = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(dataStr)
    .digest("base64url");
  return `${dataStr}.${signature}`;
}

/**
 * Verify a signed token.
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataStr, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(dataStr)
    .digest("base64url");

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf-8"));
    if (payload.issuedAt && Date.now() - payload.issuedAt > TOKEN_MAX_AGE_MS) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Authentication and Tenant Database Resolution Middleware.
 * Resolves current user and attaches the tenant-scoped Lead model to `req.Lead`.
 */
function authenticateUser(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  const decoded = token ? verifyToken(token) : null;

  if (decoded) {
    req.user = decoded;
    let targetDb = decoded.dbName || "lead_manager";

    // Super Admin can dynamically inspect any tenant database via X-Tenant-DB header or ?db= query param
    if (
      (decoded.role === "admin" || decoded.email === SUPER_ADMIN_EMAIL) &&
      (req.headers["x-tenant-db"] || req.query.db)
    ) {
      targetDb = req.headers["x-tenant-db"] || req.query.db;
    }

    req.dbName = sanitizeDbName(targetDb);
    req.Lead = getLeadModelForDb(req.dbName);
  } else {
    // Fallback for unauthenticated or public read operations: point to default DB
    req.user = null;
    req.dbName = "lead_manager";
    req.Lead = getLeadModelForDb("lead_manager");
  }

  next();
}

/**
 * Middleware requiring valid login session (any role)
 */
function requireAuth(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please enter your counselor PIN."
    });
  }

  next();
}

/**
 * Middleware requiring Super Admin privileges
 */
function requireAdmin(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in as Super Admin."
    });
  }

  const isSuperAdmin =
    req.user.role === "admin" ||
    (req.user.email && req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL);

  if (!isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only Super Admin (subhamsaha88979@gmail.com) can access this page."
    });
  }

  next();
}

module.exports = {
  SUPER_ADMIN_EMAIL,
  generateToken,
  verifyToken,
  generateCounselorToken: generateToken,
  verifyCounselorToken: verifyToken,
  authMiddleware: authenticateUser,
  authenticateUser,
  requireAuth,
  requireAdmin
};
