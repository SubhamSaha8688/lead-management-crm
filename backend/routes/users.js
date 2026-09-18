const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticateUser, requireAdmin } = require("../middleware/auth");
const { getLeadModelForDb, sanitizeDbName } = require("../utils/dbManager");

// Protect all user management endpoints with Admin check
router.use(authenticateUser, requireAdmin);

/**
 * GET /api/users
 * Lists all registered counselors and users
 */
router.get("/", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error("[Users] List error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users: " + err.message
    });
  }
});

/**
 * POST /api/users
 * Creates a new counselor with custom passcode and assigned MongoDB database name
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, passcode, dbName, role } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "User / Counselor name is required."
      });
    }

    if (!passcode || !passcode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Passcode is required."
      });
    }

    const cleanPasscode = passcode.trim();
    const cleanDbName = sanitizeDbName(dbName || `lead_crm_${name.toLowerCase().replace(/\s+/g, "_")}`);

    // Check if passcode is already used
    const existingPasscode = await User.findOne({ passcode: cleanPasscode });
    if (existingPasscode) {
      return res.status(400).json({
        success: false,
        message: `Passcode '${cleanPasscode}' is already assigned to ${existingPasscode.name}. Please choose a unique passcode.`
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: (email || "").trim(),
      passcode: cleanPasscode,
      dbName: cleanDbName,
      role: role === "admin" ? "admin" : "counselor",
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: `Counselor ${newUser.name} created successfully with DB '${cleanDbName}'.`,
      data: newUser
    });
  } catch (err) {
    console.error("[Users] Create error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create user: " + err.message
    });
  }
});

/**
 * PUT /api/users/:id
 * Updates counselor details, passcode, or assigned database name
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, passcode, dbName, role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (name) user.name = name.trim();
    if (email !== undefined) user.email = (email || "").trim();
    if (role) user.role = role === "admin" ? "admin" : "counselor";
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    if (passcode && passcode.trim()) {
      const cleanPasscode = passcode.trim();
      const duplicate = await User.findOne({
        passcode: cleanPasscode,
        _id: { $ne: id }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Passcode '${cleanPasscode}' is already in use by ${duplicate.name}.`
        });
      }
      user.passcode = cleanPasscode;
    }

    if (dbName && dbName.trim()) {
      user.dbName = sanitizeDbName(dbName);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Counselor ${user.name} updated successfully.`,
      data: user
    });
  } catch (err) {
    console.error("[Users] Update error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update user: " + err.message
    });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a counselor from user management
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    // Prevent deleting the main super admin account
    if (user.email === "subhamsaha88979@gmail.com") {
      return res.status(400).json({
        success: false,
        message: "The primary Super Admin account cannot be deleted."
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Counselor ${user.name} deleted successfully.`
    });
  } catch (err) {
    console.error("[Users] Delete error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user: " + err.message
    });
  }
});

/**
 * GET /api/users/databases
 * Returns list of distinct assigned tenant databases with lead counts
 */
router.get("/databases", async (req, res) => {
  try {
    const users = await User.find();
    const dbNames = [...new Set(users.map((u) => u.dbName).concat(["lead_manager"]))];

    const stats = await Promise.all(
      dbNames.map(async (dbName) => {
        try {
          const TenantLead = getLeadModelForDb(dbName);
          const totalLeads = await TenantLead.countDocuments({ isDeleted: { $ne: true } });
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, "0");
          const d = String(today.getDate()).padStart(2, "0");
          const todayStr = `${y}-${m}-${d}`;

          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

          const todayFollowUps = await TenantLead.countDocuments({
            isDeleted: { $ne: true },
            followUpDate: { $gte: startOfDay, $lte: endOfDay },
            stage: { $nin: ["Converted", "Lost"] }
          });

          const assignedUsers = users
            .filter((u) => u.dbName === dbName)
            .map((u) => u.name);

          return {
            dbName,
            totalLeads,
            todayFollowUps,
            assignedUsers
          };
        } catch (dbErr) {
          return {
            dbName,
            totalLeads: 0,
            todayFollowUps: 0,
            assignedUsers: [],
            error: dbErr.message
          };
        }
      })
    );

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error("[Users] Databases error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch database stats: " + err.message
    });
  }
});

module.exports = router;
