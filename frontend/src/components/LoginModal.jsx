import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginModal() {
  const { showLoginModal, login } = useAuth();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!showLoginModal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError("Please enter your counselor PIN.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const res = await login(pin.trim());
      if (!res.success) {
        setError(res.message || "Incorrect PIN. Please try again.");
      } else {
        setPin("");
      }
    } catch (err) {
      setError("Unable to connect to backend server. Please try again.");
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
          maxWidth: "400px",
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "1px solid var(--border2)",
          animation: "fadeIn 0.2s ease"
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "var(--accent-bg)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              margin: "0 auto 1rem auto"
            }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text)" }}>
            Counselor Access
          </h2>
          <p style={{ color: "var(--text2)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Enter your PIN to access the Lead Management CRM
          </p>
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

        {/* PIN Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
              Access PIN / Passcode
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showPin ? "text" : "password"}
                placeholder="Enter PIN..."
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
                title={showPin ? "Hide PIN" : "Show PIN"}
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
              Default Passcode:{" "}
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
            {submitting ? "Verifying..." : "🔓 Unlock CRM"}
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
            Skip / Continue as Subham Saha
          </button>
        </form>

        {/* Security Note */}
        <div
          style={{
            marginTop: "1.25rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--text3)"
          }}
        >
          Protected Session • Henry Harvin Learning Consultant Portal
        </div>
      </div>
    </div>
  );
}
