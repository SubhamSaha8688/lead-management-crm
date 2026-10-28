import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { formatDuration, timeToMinutes, formatDurationPace } from "../utils/pacing";
import TalktimeCalibrationModal from "../components/TalktimeCalibrationModal";

export default function Settings({ onDataChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Settings state
  const [loginTime, setLoginTime] = useState("10:00");
  const [logoutTime, setLogoutTime] = useState("19:00");
  const [breakStartTime, setBreakStartTime] = useState("13:30");
  const [breakEndTime, setBreakEndTime] = useState("14:30");
  const [targetHours, setTargetHours] = useState(1);
  const [targetMinutes, setTargetMinutes] = useState(30);

  // Today's metrics state
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/settings");
      if (res.data && res.data.success) {
        const d = res.data.data;
        if (d.loginTime) setLoginTime(d.loginTime);
        if (d.logoutTime) setLogoutTime(d.logoutTime);
        if (d.breakStartTime) setBreakStartTime(d.breakStartTime);
        if (d.breakEndTime) setBreakEndTime(d.breakEndTime);

        const totalTargetMins = d.targetTalkTimeMinutes || 90;
        setTargetHours(Math.floor(totalTargetMins / 60));
        setTargetMinutes(totalTargetMins % 60);

        setTodayMetrics(d);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const totalTargetMins = Math.max(1, Number(targetHours) * 60 + Number(targetMinutes));

      const payload = {
        loginTime,
        logoutTime,
        breakStartTime,
        breakEndTime,
        targetTalkTimeMinutes: totalTargetMins
      };

      const res = await axios.put("/api/settings", payload);
      if (res.data && res.data.success) {
        showToast("✓ Schedule & Target Settings saved successfully!");
        fetchSettings();
        if (onDataChange) onDataChange();
      }
    } catch (err) {
      alert("Failed to save settings: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Preview Calculations
  const loginM = timeToMinutes(loginTime);
  const logoutM = timeToMinutes(logoutTime);
  const shiftDurationM = Math.max(0, logoutM - loginM);

  const breakStartM = timeToMinutes(breakStartTime);
  const breakEndM = timeToMinutes(breakEndTime);
  const breakDurationM = Math.max(0, breakEndM - breakStartM);

  const netWorkingM = Math.max(0, shiftDurationM - breakDurationM);
  const workingSlotsCount = Math.floor(netWorkingM / 30);
  const targetTotalMins = Number(targetHours) * 60 + Number(targetMinutes);
  const baselineSlotTargetSecs = workingSlotsCount > 0 ? Math.round((targetTotalMins * 60) / workingSlotsCount) : 0;

  if (loading) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "4rem" }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: "860px", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            background: "#059669",
            color: "#ffffff",
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            fontWeight: 700,
            zIndex: 2200
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>⚙️</span> Schedule & Target Settings
          </h1>
          <p style={{ color: "var(--text2)", fontSize: "0.88rem", marginTop: "0.25rem", marginBottom: 0 }}>
            Configure your shift working hours, lunch break window, and daily talk-time targets.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/pacing" className="btn btn-outline btn-sm" style={{ fontWeight: 600 }}>
            ⏱️ Open Pacing Planner →
          </Link>
          <Link to="/" className="btn btn-secondary btn-sm">
            🏠 Dashboard
          </Link>
        </div>
      </div>

      <form onSubmit={handleSaveSettings}>
        {/* SHIFT HOURS SECTION */}
        <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
          <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>🕒</span> Shift Working Hours
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginBottom: "1.25rem" }}>
            Specify your standard daily login and logout times. Pacing intervals will be calculated between these two timestamps.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase" }}>
                Login Time (Start of Shift) *
              </label>
              <input
                type="time"
                value={loginTime}
                onChange={(e) => setLoginTime(e.target.value)}
                required
                style={{ fontSize: "1.05rem", fontWeight: 600 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase" }}>
                Logout Time (End of Shift) *
              </label>
              <input
                type="time"
                value={logoutTime}
                onChange={(e) => setLogoutTime(e.target.value)}
                required
                style={{ fontSize: "1.05rem", fontWeight: 600 }}
              />
            </div>
          </div>
        </div>

        {/* BREAK TIME WINDOW SECTION */}
        <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}>
              <span>☕</span> Break Time Window (Excluded)
            </h3>
            <span style={{ fontSize: "0.75rem", background: "rgba(245, 158, 11, 0.15)", color: "#b45309", padding: "0.2rem 0.55rem", borderRadius: "9999px", fontWeight: 700 }}>
              Zero Pacing Quota
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginBottom: "1.25rem" }}>
            Crucial: Slots that fall inside this break window are completely excluded from 30-minute pacing requirements so your targets aren't inflated during your lunch.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase" }}>
                Break Start Time *
              </label>
              <input
                type="time"
                value={breakStartTime}
                onChange={(e) => setBreakStartTime(e.target.value)}
                required
                style={{ fontSize: "1.05rem", fontWeight: 600 }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase" }}>
                Break End Time *
              </label>
              <input
                type="time"
                value={breakEndTime}
                onChange={(e) => setBreakEndTime(e.target.value)}
                required
                style={{ fontSize: "1.05rem", fontWeight: 600 }}
              />
            </div>
          </div>
        </div>

        {/* TARGET TALK-TIME SECTION */}
        <div className="card-padded" style={{ marginBottom: "1.5rem" }}>
          <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>🎯</span> Daily Target Talk-Time
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text3)", marginBottom: "1.25rem" }}>
            Set your required daily cumulative connected calling duration (default is 1 hr 30 mins).
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.25rem", marginBottom: "1rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase" }}>
                Hours
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={targetHours}
                  onChange={(e) => setTargetHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ paddingRight: "2.5rem", fontWeight: 700, fontSize: "1.1rem" }}
                />
                <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--text3)", fontWeight: 600 }}>
                  hrs
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase" }}>
                Minutes
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                  style={{ paddingRight: "2.5rem", fontWeight: 700, fontSize: "1.1rem" }}
                />
                <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--text3)", fontWeight: 600 }}>
                  mins
                </span>
              </div>
            </div>
          </div>

          {/* Quick Target Presets */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text3)", fontWeight: 600 }}>
              Quick Presets:
            </span>
            {[
              { label: "1 hr 00 min", h: 1, m: 0 },
              { label: "1 hr 30 min (Default)", h: 1, m: 30 },
              { label: "1 hr 45 min", h: 1, m: 45 },
              { label: "2 hr 00 min", h: 2, m: 0 }
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setTargetHours(p.h);
                  setTargetMinutes(p.m);
                }}
                className="btn btn-outline btn-sm"
                style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.6rem",
                  borderColor: targetHours === p.h && targetMinutes === p.m ? "var(--accent)" : "var(--border)",
                  color: targetHours === p.h && targetMinutes === p.m ? "var(--accent)" : "var(--text2)",
                  fontWeight: targetHours === p.h && targetMinutes === p.m ? 700 : 500
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SHIFT & PACING SUMMARY PREVIEW CARD */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)",
            border: "1px solid rgba(79, 70, 229, 0.2)",
            borderRadius: "var(--radius)",
            padding: "1.25rem",
            marginBottom: "1.75rem"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent)", marginBottom: "0.75rem" }}>
            📊 Shift Breakdown & Baseline Pacing Preview
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700 }}>
                Total Shift
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                {Math.floor(shiftDurationM / 60)}h {shiftDurationM % 60}m
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700 }}>
                Break (Excluded)
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#b45309" }}>
                {Math.floor(breakDurationM / 60)}h {breakDurationM % 60}m
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700 }}>
                Net Working Time
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text)" }}>
                {Math.floor(netWorkingM / 60)}h {netWorkingM % 60}m
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700 }}>
                Working 30m Slots
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent)" }}>
                {workingSlotsCount} blocks
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", fontWeight: 700 }}>
                Baseline Pace Needed
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#059669" }}>
                ~{formatDurationPace(baselineSlotTargetSecs)} / block
              </div>
            </div>
          </div>
        </div>

        {/* SAVE ACTIONS */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Link to="/" className="btn btn-outline">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ fontWeight: 700, padding: "0.6rem 1.5rem" }}
          >
            {saving ? "Saving Settings..." : "💾 Save Schedule & Target"}
          </button>
        </div>
      </form>

      {/* TODAY'S TALK-TIME CALIBRATION CARD */}
      <div className="card-padded" style={{ marginTop: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              ⏱️ Today's Talk-Time Sync & Calibration
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text3)", margin: 0 }}>
              If you did calls outside this CRM, calibrate today's total here to match Ozonetel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCalibrationModal(true)}
            className="btn btn-outline btn-sm"
            style={{ fontWeight: 700 }}
          >
            ✏️ Calibrate Today's Talk-Time
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ background: "var(--surface2)", padding: "0.75rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
              CRM Auto-Calculated
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>
              {formatDuration(todayMetrics?.crmTalkTimeSeconds || 0)}
            </div>
          </div>

          <div style={{ background: "var(--surface2)", padding: "0.75rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
              Effective Used in Pacing
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: todayMetrics?.isManualOverride ? "#059669" : "var(--accent)" }}>
              {formatDuration(todayMetrics?.effectiveTalkTimeSeconds || 0)}
              {todayMetrics?.isManualOverride && (
                <span style={{ fontSize: "0.7rem", marginLeft: "0.4rem", color: "#059669" }}>
                  (Calibrated ✓)
                </span>
              )}
            </div>
          </div>

          <div style={{ background: "var(--surface2)", padding: "0.75rem", borderRadius: "6px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
              Daily Target
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text)" }}>
              {formatDuration((todayMetrics?.targetTalkTimeMinutes || 90) * 60)}
            </div>
          </div>
        </div>
      </div>

      <TalktimeCalibrationModal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        currentEffectiveSeconds={todayMetrics?.effectiveTalkTimeSeconds}
        currentCrmSeconds={todayMetrics?.crmTalkTimeSeconds}
        isManualOverride={todayMetrics?.isManualOverride}
        onSaved={() => {
          showToast("✓ Talk-time calibrated successfully!");
          fetchSettings();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
