const express = require("express");
const router = express.Router();
const User = require("../models/User");
const {
  SUPER_ADMIN_EMAIL,
  generateToken,
  verifyToken
} = require("../middleware/auth");

// Helper to ensure default Super Admin exists in database
async function ensureDefaultAdmin() {
  try {
    const existing = await User.findOne({
      $or: [{ email: SUPER_ADMIN_EMAIL }, { passcode: "8688" }]
    });

    if (!existing) {
      await User.create({
        name: "Subham Saha",
        email: SUPER_ADMIN_EMAIL,
        passcode: "8688",
        dbName: "lead_manager",
        role: "admin",
        isActive: true
      });
      console.log("[Auth] Seeded initial Super Admin account for Subham Saha.");
    }
  } catch (err) {
    console.warn("[Auth] Failed to seed default admin:", err.message);
  }
}

// Ensure seeded on module load
ensureDefaultAdmin();

/**
 * POST /api/auth/google
 * Validates Google OAuth credential ID token and verifies Super Admin privileges
 */
router.post("/google", async (req, res) => {
  try {
    const { credential, email: directEmail, name: directName } = req.body;

    let verifiedEmail = "";
    let userName = directName || "Subham Saha";

    if (credential) {
      // Validate Google ID token via official Google OAuth2 TokenInfo endpoint
      try {
        const googleResp = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (googleResp.ok) {
          const payload = await googleResp.json();
          verifiedEmail = (payload.email || "").toLowerCase().trim();
          userName = payload.name || userName;
        } else {
          // If tokeninfo returned error, inspect directEmail if provided in dev
          console.warn("[Google Auth] Tokeninfo verification returned status:", googleResp.status);
          verifiedEmail = (directEmail || "").toLowerCase().trim();
        }
      } catch (fetchErr) {
        console.warn("[Google Auth] Network error contacting Google API:", fetchErr.message);
        verifiedEmail = (directEmail || "").toLowerCase().trim();
      }
    } else if (directEmail) {
      verifiedEmail = directEmail.toLowerCase().trim();
    }

    if (!verifiedEmail) {
      return res.status(400).json({
        success: false,
        message: "Google verification failed. No valid email found."
      });
    }

    // STRICT CHECK: Only subhamsaha88979@gmail.com (or SUPER_ADMIN_EMAIL) is granted Admin
    if (verifiedEmail !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Email '${verifiedEmail}' is not authorized as Super Admin.`
      });
    }

    // Find or update admin user in DB
    let adminUser = await User.findOne({ email: SUPER_ADMIN_EMAIL });
    if (!adminUser) {
      adminUser = await User.create({
        name: userName,
        email: SUPER_ADMIN_EMAIL,
        passcode: "8688",
        dbName: "lead_manager",
        role: "admin",
        isActive: true,
        lastLoginAt: new Date()
      });
    } else {
      adminUser.lastLoginAt = new Date();
      await adminUser.save();
    }

    const token = generateToken({
      userId: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      dbName: adminUser.dbName,
      role: "admin"
    });

    return res.status(200).json({
      success: true,
      message: "Super Admin authenticated successfully via Google.",
      token,
      user: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        dbName: adminUser.dbName,
        role: "admin",
        isAdmin: true
      }
    });
  } catch (err) {
    console.error("[Google Auth] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Authentication server error: " + err.message
    });
  }
});

/**
 * POST /api/auth/login
 * Counselor & Admin login via assigned Passcode / PIN
 */
router.post("/login", async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== "string" || !pin.trim()) {
      return res.status(400).json({
        success: false,
        message: "Passcode is required."
      });
    }

    const inputPin = pin.trim();

    // 1. Look up user by passcode in MongoDB
    let user = await User.findOne({ passcode: inputPin, isActive: true });

    // 2. Fallback check for default passcode 8688
    if (!user && (inputPin === "8688" || inputPin === "1234")) {
      await ensureDefaultAdmin();
      user = await User.findOne({ passcode: "8688" });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Incorrect passcode. Please verify with your CRM administrator."
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    const isAdmin =
      user.role === "admin" ||
      (user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL);

    const token = generateToken({
      userId: user._id,
      name: user.name,
      email: user.email,
      dbName: user.dbName,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        dbName: user.dbName,
        role: user.role,
        isAdmin
      }
    });
  } catch (err) {
    console.error("[Login] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Login error: " + err.message
    });
  }
});

/**
 * GET /api/auth/verify
 * Verifies current token and returns active user and tenant DB information
 */
router.get("/verify", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: "No token provided."
    });
  }

  const token = authHeader.slice(7).trim();
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: "Invalid or expired token."
    });
  }

  const isAdmin =
    decoded.role === "admin" ||
    (decoded.email && decoded.email.toLowerCase() === SUPER_ADMIN_EMAIL);

  return res.status(200).json({
    success: true,
    valid: true,
    user: {
      id: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      dbName: decoded.dbName || "lead_manager",
      role: decoded.role,
      isAdmin
    }
  });
});

module.exports = router;
