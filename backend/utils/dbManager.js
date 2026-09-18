const mongoose = require("mongoose");
const Lead = require("../models/Lead");

// In-memory cache of tenant-scoped Lead models: dbName -> Model
const tenantModels = new Map();

/**
 * Normalizes a MongoDB database name (alphanumeric, underscores, hyphens only)
 */
function sanitizeDbName(rawName) {
  if (!rawName || typeof rawName !== "string") return "lead_manager";
  const cleaned = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  return cleaned || "lead_manager";
}

/**
 * Returns a Mongoose Lead model bound to a specific tenant's MongoDB database
 * @param {string} dbName - e.g. "lead_manager", "lead_crm_priya"
 * @returns {mongoose.Model}
 */
function getLeadModelForDb(dbName = "lead_manager") {
  const safeDbName = sanitizeDbName(dbName);

  // If using default database and readyState is open, return standard Lead model
  const defaultDbName = mongoose.connection.name;
  if (safeDbName === defaultDbName && Lead) {
    return Lead;
  }

  if (tenantModels.has(safeDbName)) {
    return tenantModels.get(safeDbName);
  }

  // Create or reuse connection for this specific tenant database
  const tenantConnection = mongoose.connection.useDb(safeDbName, { useCache: true });

  // Use existing model on connection if already registered to avoid OverwriteModelError
  const tenantLeadModel =
    tenantConnection.models.Lead ||
    tenantConnection.model("Lead", Lead.leadSchema);

  tenantModels.set(safeDbName, tenantLeadModel);
  return tenantLeadModel;
}

/**
 * Clear model cache (useful during testing or tenant DB deletion)
 */
function clearTenantCache() {
  tenantModels.clear();
}

module.exports = {
  sanitizeDbName,
  getLeadModelForDb,
  clearTenantCache
};
