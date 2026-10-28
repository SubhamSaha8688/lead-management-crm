import React, { useState, useEffect } from "react";
import axios from "axios";
import { formatDuration } from "../utils/pacing";

export default function TalktimeCalibrationModal({
  isOpen,
  onClose,
  currentEffectiveSeconds,
  currentCrmSeconds,
  isManualOverride,
  onSaved
}) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const s = currentEffectiveSeconds || 0;
      setHours(Math.floor(s / 3600));
      setMinutes(Math.floor((s % 3600) / 60));
      setNote(isManualOverride ? "Synced with Ozonetel portal" : "");
      setError("");
    }
  }, [isOpen, currentEffectiveSeconds, isManualOverride]);

  if (!isOpen) return null;

  const handleAddMinutes = (extraMinutes) => {
    const currentTotalMins = Number(hours) * 60 + Number(minutes) + extraMinutes;
    setHours(Math.floor(currentTotalMins / 60));
    setMinutes(currentTotalMins % 60);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const totalSeconds = (Number(hours) * 60 + Number(minutes)) * 60;

      const res = await axios.post("/api/settings/talktime-override", {
        seconds: totalSeconds,
        note: note.trim() || "Manual calibration"
      });

      if (res.data && res.data.success) {
        if (onSaved) onSaved(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update talk-time.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToCrm = async () => {
    if (window.confirm("Revert today's talk-time to CRM auto-calculated call logs?")) {
      try {
        setSaving(true);
        const res = await axios.post("/api/settings/talktime-override", {
          seconds: null
        });
        if (res.data && res.data.success) {
          if (onSaved) onSaved(res.data.data);
          onClose();
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "480px",
          padding: "1.5rem",
          background: "var(--surface)",
          borderRadius: "var(--radius)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: "1px solid var(--border)",
          animation: "scaleIn 0.15s ease"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.4rem" }}>⏱️</span>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
                Adjust Today's Talk-Time
              </h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text3)", margin: 0 }}>
                Calibrate directly with your Ozonetel dialer portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.2rem",
              color: "var(--text3)",
              cursor: "pointer",
              padding: "0.2rem"
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: "0.6rem 0.8rem", background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", borderRadius: "6px", fontSize: "0.82rem", marginBottom: "1rem" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Current Metrics Box */}
        <div
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem",
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
            fontSize: "0.82rem"
          }}
        >
          <div>
            <div style={{ color: "var(--text3)", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>
              CRM Auto-Logged
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
              {formatDuration(currentCrmSeconds || 0)}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text3)", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>
              Effective Talk-Time
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: isManualOverride ? "#059669" : "var(--accent)" }}>
              {formatDuration(currentEffectiveSeconds || 0)}
              {isManualOverride && (
                <span style={{ fontSize: "0.68rem", marginLeft: "0.3rem", background: "rgba(5, 150, 105, 0.15)", color: "#059669", padding: "0.1rem 0.35rem", borderRadius: "4px" }}>
                  Calibrated
                </span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", display: "block", marginBottom: "0.35rem" }}>
              Set Actual Talk-Time Today (from Ozonetel):
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    style={{ paddingRight: "2.5rem", fontWeight: 700, fontSize: "1.1rem" }}
                  />
                  <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--text3)", fontWeight: 600, pointerEvents: "none" }}>
                    hrs
                  </span>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    style={{ paddingRight: "2.5rem", fontWeight: 700, fontSize: "1.1rem" }}
                  />
                  <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--text3)", fontWeight: 600, pointerEvents: "none" }}>
                    mins
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Adjustment Pills */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 600, marginBottom: "0.35rem" }}>
              Quick Add / Adjust:
            </div>
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {[
                { label: "+5m", mins: 5 },
                { label: "+10m", mins: 10 },
                { label: "+15m", mins: 15 },
                { label: "+30m", mins: 30 }
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => handleAddMinutes(pill.mins)}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.55rem", fontWeight: 700 }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: "0.78rem", color: "var(--text2)", fontWeight: 600 }}>
              Calibration Reason / Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Ozonetel portal total at 2 PM"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            {isManualOverride ? (
              <button
                type="button"
                onClick={handleRevertToCrm}
                className="btn btn-outline btn-sm"
                style={{ fontSize: "0.78rem", color: "var(--text3)" }}
                disabled={saving}
                title="Reset back to CRM calculated seconds"
              >
                ↺ Reset to CRM
              </button>
            ) : <div />}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline btn-sm"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={saving}
              >
                {saving ? "Saving..." : "💾 Save & Calibrate"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
