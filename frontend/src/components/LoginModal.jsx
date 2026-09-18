import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginModal() {
  const { showLoginModal, login, loginWithGoogle, SUPER_ADMIN_EMAIL } = useAuth();
  const [activeTab, setActiveTab] = useState("counselor"); // "counselor" or "admin"
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("subhamsaha88979@gmail.com");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!showLoginModal) return null;

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError("Please enter your counselor passcode.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await login(pin.trim());
      if (!res.success) {
        setError(res.message || "Incorrect passcode. Please try again.");
      } else {
        setPin("");
      }
    } catch (err) {
      setError("Unable to connect to backend server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setSubmitting(true);
      setError("");

      // Attempt Google login with the authorized email
      const res = await loginWithGoogle({
        email: googleEmail.trim(),
        name: "Subham Saha"
      });

      if (!res.success) {
        setError(res.message || "Google authentication failed. Only subhamsaha88979@gmail.com is authorized.");
      }
    } catch (err) {
      setError("Google authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem"
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid var(--border2)",
          animation: "fadeIn 0.2s ease"
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: activeTab === "admin" ? "rgba(245, 158, 11, 0.15)" : "var(--accent-bg)",
              color: activeTab === "admin" ? "#d97706" : "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              margin: "0 auto 0.75rem auto"
            }}
          >
            {activeTab === "admin" ? "👑" : "🔒"}
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text)" }}>
            {activeTab === "admin" ? "Super Admin Access" : "Counselor Access"}
          </h2>
          <p style={{ color: "var(--text2)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            {activeTab === "admin"
              ? "Validated via Google for subhamsaha88979@gmail.com"
              : "Enter your assigned passcode to open your CRM database"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            background: "var(--surface2)",
            padding: "0.25rem",
            borderRadius: "var(--radius)",
            marginBottom: "1.25rem",
            gap: "0.25rem"
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("counselor");
              setError("");
            }}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "counselor" ? "var(--surface)" : "transparent",
              color: activeTab === "counselor" ? "var(--accent)" : "var(--text3)",
              boxShadow: activeTab === "counselor" ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s ease"
            }}
          >
            👤 Counselor Login
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("admin");
              setError("");
            }}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              background: activeTab === "admin" ? "var(--surface)" : "transparent",
              color: activeTab === "admin" ? "#d97706" : "var(--text3)",
              boxShadow: activeTab === "admin" ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s ease"
            }}
          >
            👑 Super Admin (Google)
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "rgba(220, 38, 38, 0.12)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              color: "var(--danger)",
              padding: "0.6rem 0.85rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.82rem",
              marginBottom: "1rem",
              fontWeight: 600
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* TAB 1: COUNSELOR PASSCODE LOGIN */}
        {activeTab === "counselor" && (
          <form onSubmit={handlePasscodeSubmit}>
            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
                Counselor Passcode / PIN
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showPin ? "text" : "password"}
                  placeholder="Enter assigned passcode..."
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "0.65rem 2.5rem 0.65rem 0.85rem",
                    fontSize: "1.1rem",
                    letterSpacing: showPin ? "normal" : "0.2em",
                    textAlign: "center",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--surface2)",
                    color: "var(--text)"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    color: "var(--text3)",
                    padding: "4px"
                  }}
                  title={showPin ? "Hide Passcode" : "Show Passcode"}
                >
                  {showPin ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              <div
                style={{
                  marginTop: "0.5rem",
                  textAlign: "center",
                  fontSize: "0.8rem",
                  color: "var(--text3)"
                }}
              >
                Default Counselor Passcode:{" "}
                <button
                  type="button"
                  onClick={() => setPin("8688")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  8688
                </button>{" "}
                (Click to auto-fill)
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem"
              }}
            >
              {submitting ? "Verifying..." : "🔓 Unlock CRM Database"}
            </button>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => login("8688")}
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.45rem",
                fontSize: "0.82rem"
              }}
            >
              Skip / Continue as Subham Saha (8688)
            </button>
          </form>
        )}

        {/* TAB 2: SUPER ADMIN GOOGLE AUTHENTICATION */}
        {activeTab === "admin" && (
          <div>
            <div
              style={{
                padding: "1rem",
                background: "var(--surface2)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                marginBottom: "1.25rem",
                textAlign: "center"
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.5rem" }}>
                Super Admin Authorized Google Account:
              </div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--text)",
                  wordBreak: "break-all"
                }}
              >
                {SUPER_ADMIN_EMAIL}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: "0.4rem" }}>
                Only this verified Google address has permission to manage counselors, passcodes, and MongoDB databases.
              </div>
            </div>

            {/* Google Validation Button */}
            <button
              type="button"
              onClick={handleGoogleSubmit}
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.8rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                borderRadius: "var(--radius)",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#1f2937",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                transition: "background 0.2s ease"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{submitting ? "Verifying with Google..." : "Sign in with Google"}</span>
            </button>
          </div>
        )}

        {/* Security Note */}
        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "0.85rem",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--text3)"
          }}
        >
          Henry Harvin Learning Consultant Portal • Role-Based Access Control
        </div>
      </div>
    </div>
  );
}
