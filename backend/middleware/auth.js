const crypto = require("crypto");

// Secret key for signing counselor tokens (persists across restarts if set in ENV, or generated)
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.COUNSELOR_SECRET || "crm-secret-counselor-auth-key-2026";
const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Generate a cryptographically signed session token for the counselor.
 */
function generateCounselorToken(payload = {}) {
  const data = {
    ...payload,
    role: "counselor",
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
 * Verify a signed counselor token.
 */
function verifyCounselorToken(token) {
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
    // Check expiration
    if (payload.issuedAt && Date.now() - payload.issuedAt > TOKEN_MAX_AGE_MS) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to protect counselor CRM endpoints.
 */
function authMiddleware(req, res, next) {
  // Allow OPTIONS pre-flight requests to pass through
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please enter counselor PIN."
    });
  }

  const token = authHeader.slice(7).trim();
  const decoded = verifyCounselorToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: "Session expired or invalid token. Please log in again."
    });
  }

  req.user = decoded;
  next();
}

module.exports = {
  authMiddleware,
  generateCounselorToken,
  verifyCounselorToken
};
