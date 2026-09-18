const express = require("express");
const router = express.Router();
const { generateCounselorToken, verifyCounselorToken } = require("../middleware/auth");

// Configured counselor PIN (defaults to 8688 for Subham Saha if not specified in ENV)
const DEFAULT_PIN = "8688";

function getValidPins() {
  const pins = [DEFAULT_PIN];
  if (process.env.COUNSELOR_PIN) {
    pins.push(String(process.env.COUNSELOR_PIN).trim());
  }
  if (process.env.COUNSELOR_PASSCODE) {
    pins.push(String(process.env.COUNSELOR_PASSCODE).trim());
  }
  return pins;
}

// POST /api/auth/login - Authenticate with counselor PIN
router.post("/login", (req, res) => {
  const { pin } = req.body;

  if (!pin || typeof pin !== "string" || !pin.trim()) {
    return res.status(400).json({
      success: false,
      message: "Counselor PIN is required."
    });
  }

  const validPins = getValidPins();
  const inputPin = pin.trim();

  if (!validPins.includes(inputPin)) {
    return res.status(401).json({
      success: false,
      message: "Incorrect counselor PIN. Please try again."
    });
  }

  const token = generateCounselorToken({ counselor: "Subham Saha" });

  return res.status(200).json({
    success: true,
    message: "Authentication successful.",
    token,
    user: {
      name: "Subham Saha",
      role: "Learning Consultant",
      organization: "Henry Harvin Education"
    }
  });
});

// GET /api/auth/verify - Verify current token status
router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: "No token provided."
    });
  }

  const token = authHeader.slice(7).trim();
  const decoded = verifyCounselorToken(token);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: "Invalid or expired token."
    });
  }

  return res.status(200).json({
    success: true,
    valid: true,
    user: {
      name: "Subham Saha",
      role: "Learning Consultant",
      organization: "Henry Harvin Education"
    }
  });
});

module.exports = router;
