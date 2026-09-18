import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Settings() {
  const { user, isAdmin, activeTenantDb, switchTenantDb, SUPER_ADMIN_EMAIL } = useAuth();

  const [users, setUsers] = useState([]);
  const [dbStats, setDbStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Add Counselor Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPasscode, setAddPasscode] = useState("");
  const [addDbName, setAddDbName] = useState("");
  const [addRole, setAddRole] = useState("counselor");
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Counselor Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPasscode, setEditPasscode] = useState("");
  const [editDbName, setEditDbName] = useState("");
  const [editRole, setEditRole] = useState("counselor");
  const [editIsActive, setEditIsActive] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Visibility toggle for passcodes in the table
  const [visiblePasscodes, setVisiblePasscodes] = useState({});

  // Notification helper
  const notifySuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4500);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [usersRes, dbRes] = await Promise.all([
        axios.get("/api/users"),
        axios.get("/api/users/databases")
      ]);

      if (usersRes.data && usersRes.data.success) {
        setUsers(usersRes.data.data);
      }
      if (dbRes.data && dbRes.data.success) {
        setDbStats(dbRes.data.data);
      }
    } catch (err) {
      console.error("[Settings] fetch error:", err);
      setError(err.response?.data?.message || "Failed to load counselors and databases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  // Auto-generate suggested DB name when counselor name changes in Add modal
  const handleNameChangeForAdd = (val) => {
    setAddName(val);
    if (!addDbName || addDbName.startsWith("lead_crm_")) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      setAddDbName(slug ? `lead_crm_${slug}` : "");
    }
  };

  // Generate random 4-digit passcode
  const generateRandomPin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    return pin;
  };

  const handleOpenAddModal = () => {
    setAddName("");
    setAddEmail("");
    setAddPasscode(generateRandomPin());
    setAddDbName("");
    setAddRole("counselor");
    setShowAddModal(true);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!addName.trim() || !addPasscode.trim()) {
      setError("Counselor name and passcode are required.");
      return;
    }

    try {
      setSubmittingAdd(true);
      setError("");
      const res = await axios.post("/api/users", {
        name: addName.trim(),
        email: addEmail.trim(),
        passcode: addPasscode.trim(),
        dbName: addDbName.trim(),
        role: addRole
      });

      if (res.data && res.data.success) {
        notifySuccess(`Counselor "${addName}" added successfully!`);
        setShowAddModal(false);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create counselor.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditPasscode(u.passcode || "");
    setEditDbName(u.dbName || "");
    setEditRole(u.role || "counselor");
    setEditIsActive(u.isActive !== false);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setSubmittingEdit(true);
      setError("");
      const res = await axios.put(`/api/users/${editingUser._id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        passcode: editPasscode.trim(),
        dbName: editDbName.trim(),
        role: editRole,
        isActive: editIsActive
      });

      if (res.data && res.data.success) {
        notifySuccess(`Counselor "${editName}" updated successfully!`);
        setEditingUser(null);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update counselor.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      setSubmittingDelete(true);
      setError("");
      const res = await axios.delete(`/api/users/${deletingUser._id}`);
      if (res.data && res.data.success) {
        notifySuccess(`Counselor "${deletingUser.name}" deleted.`);
        setDeletingUser(null);
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete counselor.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  const togglePasscodeVisibility = (userId) => {
    setVisiblePasscodes((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    notifySuccess(`Copied ${label} to clipboard!`);
  };

  // Metrics calculations
  const totalCounselors = users.length;
  const activeDatabases = dbStats.length;
  const totalLeadsAcrossTenants = dbStats.reduce((acc, curr) => acc + (curr.totalLeads || 0), 0);
  const totalFollowUpsAcrossTenants = dbStats.reduce((acc, curr) => acc + (curr.todayFollowUps || 0), 0);

  // If user is not Super Admin
  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 700, margin: "3rem auto", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔒</div>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.5rem" }}>
          Super Admin Access Restricted
        </h2>
        <p style={{ color: "var(--text2)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          This page allows creating counselor accounts, assigning passcodes, and managing isolated
          multi-tenant MongoDB databases. Only authenticated Super Admin accounts (
          <strong>{SUPER_ADMIN_EMAIL}</strong>) have permission to access these controls.
        </p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.25rem",
            background: "var(--accent)",
            color: "#fff",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            fontWeight: 600
          }}
        >
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="settings-page-wrapper">
      {/* Top Header */}
      <div className="settings-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h1 className="settings-title">⚙️ Admin Console & Tenant Management</h1>
            <span className="badge-admin">Super Admin</span>
          </div>
          <p className="settings-subtitle">
            Manage counselor users, passcodes, and isolated multi-tenant MongoDB databases.
          </p>
        </div>

        <button
          className="btn-add-counselor"
          onClick={handleOpenAddModal}
          title="Create a new counselor account"
        >
          ➕ Add New Counselor
        </button>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="alert-banner alert-success">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="alert-banner alert-danger">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Active Database Context Bar */}
      <div className="active-db-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1.2rem" }}>🗄️</span>
          <div>
            <div style={{ fontSize: "0.82rem", color: "var(--text3)", fontWeight: 600 }}>
              ACTIVE WORKING DATABASE (GLOBAL CRM CONTEXT):
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--accent)" }}>
              {activeTenantDb ? activeTenantDb : "lead_manager (Default Master Database)"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <select
            className="db-select-dropdown"
            value={activeTenantDb || ""}
            onChange={(e) => switchTenantDb(e.target.value)}
            title="Switch the active database you are browsing as Admin"
          >
            <option value="">Default Master (lead_manager)</option>
            {dbStats
              .filter((d) => d.dbName !== "lead_manager")
              .map((d) => (
                <option key={d.dbName} value={d.dbName}>
                  {d.dbName} ({d.totalLeads} leads
                  {d.assignedUsers?.length ? ` - ${d.assignedUsers.join(", ")}` : ""})
                </option>
              ))}
          </select>

          {activeTenantDb && (
            <button
              className="btn-reset-db"
              onClick={() => switchTenantDb("")}
              title="Reset view back to master lead_manager database"
            >
              Reset to Master
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-info">
            <span className="metric-label">Total Counselors</span>
            <span className="metric-val">{totalCounselors}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🗄️</div>
          <div className="metric-info">
            <span className="metric-label">Active Databases</span>
            <span className="metric-val">{activeDatabases}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-info">
            <span className="metric-label">Total Leads (All Tenants)</span>
            <span className="metric-val">{totalLeadsAcrossTenants}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏰</div>
          <div className="metric-info">
            <span className="metric-label">Today's Follow-ups</span>
            <span className="metric-val">{totalFollowUpsAcrossTenants}</span>
          </div>
        </div>
      </div>

      {/* Counselors Table Section */}
      <div className="card-section">
        <div className="card-section-header">
          <div>
            <h2 className="card-section-title">Counselor Passcodes & Database Assignments</h2>
            <p className="card-section-desc">
              Each counselor logs in using their designated Passcode (PIN). Leads they create or modify
              are saved strictly into their designated MongoDB database.
            </p>
          </div>
          <button className="btn-refresh" onClick={fetchData} title="Refresh data">
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text3)" }}>
            Loading counselor credentials & databases...
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text3)" }}>
            No counselors found. Click "Add New Counselor" to create the first one.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Counselor Name</th>
                  <th>Role</th>
                  <th>Login Passcode (PIN)</th>
                  <th>Assigned MongoDB Database</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isVisible = visiblePasscodes[u._id];
                  const isSuperAdminUser =
                    u.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

                  return (
                    <tr key={u._id}>
                      {/* Name & Email */}
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>{u.name}</div>
                        {u.email ? (
                          <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{u.email}</div>
                        ) : (
                          <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>No email set</div>
                        )}
                      </td>

                      {/* Role */}
                      <td>
                        {u.role === "admin" ? (
                          <span className="badge-pill badge-pill-admin">Admin</span>
                        ) : (
                          <span className="badge-pill badge-pill-counselor">Counselor</span>
                        )}
                      </td>

                      {/* Passcode with reveal & copy */}
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <code className="passcode-code">
                            {isVisible ? u.passcode : "••••"}
                          </code>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => togglePasscodeVisibility(u._id)}
                            title={isVisible ? "Hide Passcode" : "Show Passcode"}
                          >
                            {isVisible ? "🙈" : "👁️"}
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => copyToClipboard(u.passcode, "Passcode")}
                            title="Copy Passcode"
                          >
                            📋
                          </button>
                        </div>
                      </td>

                      {/* DB Name */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span className="db-tag">🗄️ {u.dbName || "lead_manager"}</span>
                          {activeTenantDb === u.dbName && (
                            <span className="badge-active-context" title="Currently active in CRM">
                              Active View
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {u.isActive !== false ? (
                          <span className="status-pill status-active">Active</span>
                        ) : (
                          <span className="status-pill status-inactive">Inactive</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                          <button
                            className="btn-action-edit"
                            onClick={() => handleOpenEditModal(u)}
                            title="Edit counselor credentials"
                          >
                            ✏️ Edit
                          </button>

                          {!isSuperAdminUser ? (
                            <button
                              className="btn-action-delete"
                              onClick={() => setDeletingUser(u)}
                              title="Delete counselor"
                            >
                              🗑️
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text3)",
                                padding: "0.3rem 0.5rem"
                              }}
                              title="Primary Super Admin cannot be deleted"
                            >
                              🔒 Protected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Database Statistics Section */}
      <div className="card-section" style={{ marginTop: "2rem" }}>
        <div className="card-section-header">
          <div>
            <h2 className="card-section-title">Tenant MongoDB Databases Overview</h2>
            <p className="card-section-desc">
              Real-time lead counts and follow-up metrics grouped by individual MongoDB tenant databases.
            </p>
          </div>
        </div>

        <div className="db-cards-grid">
          {dbStats.map((db) => {
            const isCurrentlySelected =
              activeTenantDb === db.dbName || (!activeTenantDb && db.dbName === "lead_manager");

            return (
              <div
                key={db.dbName}
                className={`db-stat-card ${isCurrentlySelected ? "db-card-active" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span className="db-card-title">🗄️ {db.dbName}</span>
                    <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "0.2rem" }}>
                      Assigned to:{" "}
                      <strong>
                        {db.assignedUsers && db.assignedUsers.length > 0
                          ? db.assignedUsers.join(", ")
                          : "System Master"}
                      </strong>
                    </div>
                  </div>
                  {isCurrentlySelected && (
                    <span className="badge-pill badge-pill-admin" style={{ fontSize: "0.68rem" }}>
                      Active CRM View
                    </span>
                  )}
                </div>

                <div className="db-stats-row">
                  <div>
                    <div className="db-stat-num">{db.totalLeads}</div>
                    <div className="db-stat-lbl">Total Leads</div>
                  </div>
                  <div>
                    <div className="db-stat-num" style={{ color: "var(--warning)" }}>
                      {db.todayFollowUps}
                    </div>
                    <div className="db-stat-lbl">Today's Follow-ups</div>
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  {isCurrentlySelected ? (
                    <Link to="/" className="btn-browse-db active">
                      ✓ Currently Browsing Dashboard
                    </Link>
                  ) : (
                    <button
                      className="btn-browse-db"
                      onClick={() => switchTenantDb(db.dbName === "lead_manager" ? "" : db.dbName)}
                    >
                      Inspect Leads in this DB →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD COUNSELOR MODAL */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">➕ Add New Counselor</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {/* Name */}
                <div className="form-group">
                  <label className="form-label">Counselor Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Priya Sharma"
                    value={addName}
                    onChange={(e) => handleNameChangeForAdd(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Email */}
                <div className="form-group">
                  <label className="form-label">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="counselor@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                  <span className="form-help">
                    Useful for identification and future direct Google Sign-in.
                  </span>
                </div>

                {/* Passcode (PIN) */}
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="form-label">Login Passcode / PIN *</label>
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={() => setAddPasscode(generateRandomPin())}
                    >
                      🎲 Generate Random PIN
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 8688 or 4291"
                    value={addPasscode}
                    onChange={(e) => setAddPasscode(e.target.value)}
                    required
                  />
                  <span className="form-help">
                    The counselor enters this exact passcode on the CRM login screen.
                  </span>
                </div>

                {/* MongoDB Database Name */}
                <div className="form-group">
                  <label className="form-label">Assigned MongoDB Database Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. lead_crm_priya"
                    value={addDbName}
                    onChange={(e) => setAddDbName(e.target.value)}
                    required
                  />
                  <span className="form-help">
                    Must be valid MongoDB database name (letters, numbers, underscores). Each counselor
                    has their own isolated database.
                  </span>
                </div>

                {/* Role */}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-input"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                  >
                    <option value="counselor">Counselor (Standard CRM Access)</option>
                    <option value="admin">Administrator (Settings & User Management Access)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submittingAdd}
                >
                  {submittingAdd ? "Creating Counselor..." : "Create Counselor Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COUNSELOR MODAL */}
      {editingUser && (
        <div className="modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Edit Counselor: {editingUser.name}</h3>
              <button className="modal-close-btn" onClick={() => setEditingUser(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="modal-body">
                {/* Name */}
                <div className="form-group">
                  <label className="form-label">Counselor Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                {/* Email */}
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>

                {/* Passcode (PIN) */}
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="form-label">Login Passcode / PIN *</label>
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={() => setEditPasscode(generateRandomPin())}
                    >
                      🎲 Generate Random PIN
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    value={editPasscode}
                    onChange={(e) => setEditPasscode(e.target.value)}
                    required
                  />
                </div>

                {/* MongoDB Database Name */}
                <div className="form-group">
                  <label className="form-label">Assigned MongoDB Database Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editDbName}
                    onChange={(e) => setEditDbName(e.target.value)}
                    required
                  />
                  <span className="form-help">
                    Warning: Changing this will point the counselor to a different MongoDB database.
                  </span>
                </div>

                {/* Role */}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-input"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    <option value="counselor">Counselor (Standard CRM Access)</option>
                    <option value="admin">Administrator (Settings & User Management Access)</option>
                  </select>
                </div>

                {/* Active Toggle */}
                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <label htmlFor="editIsActive" style={{ fontWeight: 600, cursor: "pointer" }}>
                    Account Active (uncheck to temporarily disable login)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submittingEdit}
                >
                  {submittingEdit ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="modal-backdrop" onClick={() => setDeletingUser(null)}>
          <div className="modal-dialog" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: "var(--danger)" }}>
                🗑️ Confirm Deletion
              </h3>
              <button className="modal-close-btn" onClick={() => setDeletingUser(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ lineHeight: 1.6, color: "var(--text)" }}>
                Are you sure you want to delete counselor <strong>{deletingUser.name}</strong>?
              </p>
              <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginTop: "0.5rem" }}>
                This will remove their user record and login passcode. The underlying MongoDB database (
                <code>{deletingUser.dbName}</code>) and its leads will remain intact on your cluster.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setDeletingUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-action"
                onClick={handleDeleteUser}
                disabled={submittingDelete}
              >
                {submittingDelete ? "Deleting..." : "Yes, Delete Counselor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Styles */}
      <style>{`
        .settings-page-wrapper {
          max-width: 1200px;
          margin: 1.5rem auto 3rem;
          padding: 0 1rem;
        }
        .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .settings-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .settings-subtitle {
          font-size: 0.88rem;
          color: var(--text3);
          margin-top: 0.25rem;
        }
        .badge-admin {
          background: #7c3aed;
          color: #ffffff;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .btn-add-counselor {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--accent);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.9rem;
          padding: 0.6rem 1.25rem;
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .btn-add-counselor:hover {
          background: var(--accent-hover);
          transform: translateY(-1px);
        }

        .alert-banner {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-sm);
          font-size: 0.88rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
        }
        .alert-success {
          background: rgba(34, 197, 94, 0.12);
          color: #16a34a;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .alert-danger {
          background: rgba(239, 68, 68, 0.12);
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .active-db-bar {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .db-select-dropdown {
          padding: 0.45rem 0.75rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-weight: 600;
          font-size: 0.85rem;
        }
        .btn-reset-db {
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text2);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-reset-db:hover {
          color: var(--danger);
          border-color: var(--danger);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 1.75rem;
        }
        .metric-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.1rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: var(--shadow-sm);
        }
        .metric-icon {
          font-size: 1.8rem;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          background: var(--surface2);
        }
        .metric-info {
          display: flex;
          flex-direction: column;
        }
        .metric-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
        }
        .metric-val {
          font-size: 1.45rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1.2;
        }

        .card-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .card-section-header {
          padding: 1.2rem 1.25rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .card-section-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text);
        }
        .card-section-desc {
          font-size: 0.82rem;
          color: var(--text3);
          margin-top: 0.15rem;
        }
        .btn-refresh {
          padding: 0.4rem 0.8rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text);
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
        }

        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
        }
        .custom-table th {
          background: var(--surface2);
          color: var(--text3);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.04em;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          text-align: left;
        }
        .custom-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .custom-table tbody tr:hover {
          background: var(--surface2);
        }

        .badge-pill {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.15rem 0.55rem;
          border-radius: 9999px;
        }
        .badge-pill-admin {
          background: rgba(124, 58, 237, 0.12);
          color: #7c3aed;
          border: 1px solid rgba(124, 58, 237, 0.25);
        }
        .badge-pill-counselor {
          background: rgba(37, 99, 235, 0.12);
          color: #2563eb;
          border: 1px solid rgba(37, 99, 235, 0.25);
        }

        .passcode-code {
          background: var(--surface2);
          padding: 0.25rem 0.55rem;
          border-radius: 4px;
          border: 1px solid var(--border);
          font-family: monospace;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--text);
        }
        .btn-icon {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 0.95rem;
          padding: 0.2rem;
          border-radius: 4px;
        }
        .btn-icon:hover {
          background: var(--surface2);
        }

        .db-tag {
          font-family: monospace;
          font-size: 0.85rem;
          font-weight: 600;
          background: var(--surface2);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          border: 1px solid var(--border);
          color: var(--text2);
        }
        .badge-active-context {
          background: #16a34a;
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.45rem;
          border-radius: 9999px;
          text-transform: uppercase;
        }

        .status-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }
        .status-active {
          background: rgba(34, 197, 94, 0.15);
          color: #16a34a;
        }
        .status-inactive {
          background: rgba(100, 116, 139, 0.15);
          color: #64748b;
        }

        .btn-action-edit {
          padding: 0.35rem 0.65rem;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          cursor: pointer;
        }
        .btn-action-edit:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .btn-action-delete {
          padding: 0.35rem 0.55rem;
          font-size: 0.8rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--danger);
          cursor: pointer;
        }
        .btn-action-delete:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: var(--danger);
        }

        .db-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.25rem;
          padding: 1.25rem;
        }
        .db-stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: border-color 0.15s ease;
        }
        .db-stat-card:hover {
          border-color: var(--accent);
        }
        .db-card-active {
          border-color: #16a34a !important;
          background: rgba(34, 197, 94, 0.03);
        }
        .db-card-title {
          font-family: monospace;
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text);
        }
        .db-stats-row {
          display: flex;
          gap: 2rem;
          margin-top: 1rem;
          padding: 0.75rem 0;
          border-top: 1px dashed var(--border);
          border-bottom: 1px dashed var(--border);
        }
        .db-stat-num {
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--text);
        }
        .db-stat-lbl {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
        }
        .btn-browse-db {
          display: block;
          width: 100%;
          text-align: center;
          padding: 0.55rem;
          font-size: 0.85rem;
          font-weight: 700;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text);
          text-decoration: none;
          cursor: pointer;
        }
        .btn-browse-db:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .btn-browse-db.active {
          background: rgba(34, 197, 94, 0.15);
          color: #16a34a;
          border-color: #16a34a;
        }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(3px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .modal-dialog {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          width: 100%;
          max-width: 520px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: modalIn 0.18s ease-out;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .modal-header {
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text);
        }
        .modal-close-btn {
          background: transparent;
          border: none;
          font-size: 1.2rem;
          color: var(--text3);
          cursor: pointer;
        }
        .modal-body {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .form-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text);
        }
        .form-input {
          padding: 0.55rem 0.8rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text);
          font-size: 0.9rem;
        }
        .form-input:focus {
          border-color: var(--accent);
          outline: none;
        }
        .form-help {
          font-size: 0.74rem;
          color: var(--text3);
        }
        .btn-link-action {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        .modal-footer {
          padding: 0.9rem 1.25rem;
          border-top: 1px solid var(--border);
          background: var(--surface2);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.65rem;
        }
        .btn-cancel {
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text2);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .btn-submit {
          padding: 0.5rem 1.2rem;
          border-radius: var(--radius-sm);
          border: none;
          background: var(--accent);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-danger-action {
          padding: 0.5rem 1.2rem;
          border-radius: var(--radius-sm);
          border: none;
          background: var(--danger);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
