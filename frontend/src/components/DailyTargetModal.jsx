import React, { useState, useEffect } from "react";
import axios from "axios";

export default function DailyTargetModal({
  isOpen,
  onClose,
  date,
  currentTargetMinutes = 90,
  isOffDay = false,
  currentNote = "",
  onSaved
}) {
  const [minutesVal, setMinutesVal] = useState(currentTargetMinutes);
  const [offDayVal, setOffDayVal] = useState(isOffDay);
  const [noteVal, setNoteVal] = useState(currentNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMinutesVal(currentTargetMinutes || 90);
      setOffDayVal(Boolean(isOffDay));
      setNoteVal(currentNote || "");
      setError("");
    }
  }, [isOpen, currentTargetMinutes, isOffDay, currentNote]);

  if (!isOpen) return null;

  const presets = [
    { label: "1h 15m", mins: 75 },
    { label: "1h 30m (Default)", mins: 90 },
    { label: "1h 45m", mins: 105 },
    { label: "2h 00m", mins: 120 },
    { label: "2h 30m", mins: 150 },
    { label: "3h 00m", mins: 180 }
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      const res = await axios.post("/api/settings/daily-target", {
        date,
        targetMinutes: offDayVal ? 0 : Number(minutesVal),
        isOffDay: offDayVal,
        note: noteVal.trim()
      });

      if (res.data?.success) {
        if (onSaved) onSaved(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update target.");
    } finally {
      setSaving(false);
    }
  };

  const hours = Math.floor(minutesVal / 60);
  const remainingMins = minutesVal % 60;

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
          maxWidth: "460px",
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
            <span style={{ fontSize: "1.4rem" }}>🎯</span>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
                Set Target Talk-Time
              </h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text3)", margin: 0 }}>
                {date ? `For ${date}` : "For Today"} • Management target adjustment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "var(--text3)",
              padding: "0.25rem"
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "0.6rem 0.75rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "var(--radius-sm)",
              color: "#ef4444",
              fontSize: "0.82rem",
              marginBottom: "1rem"
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Off Day Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem",
              background: offDayVal ? "rgba(100, 116, 139, 0.15)" : "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              marginBottom: "1rem",
              cursor: "pointer"
            }}
            onClick={() => setOffDayVal(!offDayVal)}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
                ⚪ Mark as Off / Holiday
              </span>
              <p style={{ fontSize: "0.75rem", color: "var(--text3)", margin: "0.1rem 0 0 0" }}>
                Target will be 0 mins (no salary/attendance penalty for this day)
              </p>
            </div>
            <input
              type="checkbox"
              checked={offDayVal}
              onChange={(e) => setOffDayVal(e.target.checked)}
              style={{ width: "1.2rem", height: "1.2rem", cursor: "pointer", accentColor: "#4f46e5" }}
            />
          </div>

          {!offDayVal && (
            <>
              {/* Quick Presets */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", marginBottom: "0.4rem" }}>
                  Quick Target Presets:
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {presets.map((p) => {
                    const isSelected = minutesVal === p.mins;
                    return (
                      <button
                        key={p.mins}
                        type="button"
                        onClick={() => setMinutesVal(p.mins)}
                        className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}`}
                        style={{
                          fontSize: "0.78rem",
                          padding: "0.3rem 0.6rem",
                          fontWeight: isSelected ? 800 : 600,
                          borderColor: isSelected ? "#4f46e5" : "var(--border)"
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", marginBottom: "0.4rem" }}>
                  Or Enter Specific Target Minutes:
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={minutesVal}
                    onChange={(e) => setMinutesVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="form-control"
                    style={{ fontWeight: 700, fontSize: "1rem", maxWidth: "120px" }}
                  />
                  <span style={{ fontSize: "0.85rem", color: "var(--text2)" }}>minutes</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      padding: "0.3rem 0.6rem",
                      background: "rgba(79, 70, 229, 0.1)",
                      color: "#4f46e5",
                      fontWeight: 800,
                      borderRadius: "6px",
                      fontSize: "0.85rem"
                    }}
                  >
                    = {hours > 0 ? `${hours}h ` : ""}{remainingMins > 0 ? `${remainingMins}m` : (hours > 0 ? "00m" : "0m")}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Reason / Note */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", marginBottom: "0.4rem" }}>
              Note / Reason (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Navratri special, weekend assignment, manager requested"
              value={noteVal}
              onChange={(e) => setNoteVal(e.target.value)}
              className="form-control"
              style={{ fontSize: "0.85rem" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ minWidth: "110px", fontWeight: 700 }}
            >
              {saving ? "Saving..." : "Save Target"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
