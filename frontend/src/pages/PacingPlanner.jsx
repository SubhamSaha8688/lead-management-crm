import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  calculatePacingSchedule,
  formatDuration,
  formatDurationPace
} from "../utils/pacing";
import TalktimeCalibrationModal from "../components/TalktimeCalibrationModal";

export default function PacingPlanner({ onDataChange }) {
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [settingsData, setSettingsData] = useState(null);
  const [crmStats, setCrmStats] = useState(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [expandedSlotId, setExpandedSlotId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [customSlotId, setCustomSlotId] = useState(null);
  const [customMinutes, setCustomMinutes] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Live Clock ticker every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data - isInitial controls full-page spinner (never flickers on adjustments)
  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      const [settingsRes, statsRes] = await Promise.all([
        axios.get("/api/settings"),
        axios.get("/api/leads/talktime-stats")
      ]);

      if (settingsRes.data && settingsRes.data.success) {
        setSettingsData(settingsRes.data.data);
      }
      if (statsRes.data && statsRes.data.success) {
        setCrmStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to load pacing data:", err);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  // Compute 30-min pacing schedule dynamically
  const pacing = useMemo(() => {
    if (!settingsData) return null;
    return calculatePacingSchedule(
      {
        loginTime: settingsData.loginTime,
        logoutTime: settingsData.logoutTime,
        breakStartTime: settingsData.breakStartTime,
        breakEndTime: settingsData.breakEndTime,
        targetTalkTimeMinutes: settingsData.targetTalkTimeMinutes
      },
      settingsData.effectiveTalkTimeSeconds || 0,
      crmStats?.callLogs || [],
      currentTime,
      settingsData.slotAdjustments || []
    );
  }, [settingsData, crmStats, currentTime]);

  if (loading || !pacing) {
    return (
      <div className="page" style={{ textAlign: "center", padding: "4rem" }}>
        Loading 30-minute pacing schedule...
      </div>
    );
  }

  const {
    settings,
    targetSeconds,
    effectiveTalkTimeSeconds,
    remainingSeconds,
    progressPercent,
    isTargetMet,
    totalWorkingSlots,
    remainingWorkingSlots,
    requiredPacePerSlot,
    currentSlot,
    pacingHealth,
    pacingMessage,
    pacingColor,
    slots
  } = pacing;

  // 1-Click Slot Quick Adjustment (+1m, +5m, -1m, etc.) with ZERO page reload
  const handleSlotQuickAdd = async (slot, deltaSeconds = 60) => {
    try {
      const slotKey = slot.key || slot.id;
      const roundedMins = Math.round(deltaSeconds / 60);

      // Instant optimistic update (0ms UI latency)
      setSettingsData((prev) => {
        if (!prev) return prev;
        const currentEffective = prev.effectiveTalkTimeSeconds || 0;
        const newEffective = Math.max(0, currentEffective + deltaSeconds);
        const currentSlotAdjs = [...(prev.slotAdjustments || [])];
        const existingIdx = currentSlotAdjs.findIndex((a) => a.slotKey === slotKey);
        if (existingIdx !== -1) {
          currentSlotAdjs[existingIdx] = {
            ...currentSlotAdjs[existingIdx],
            addedSeconds: Math.max(0, (currentSlotAdjs[existingIdx].addedSeconds || 0) + deltaSeconds)
          };
        } else if (deltaSeconds > 0) {
          currentSlotAdjs.push({ slotKey, addedSeconds: deltaSeconds });
        }
        return {
          ...prev,
          effectiveTalkTimeSeconds: newEffective,
          isManualOverride: true,
          slotAdjustments: currentSlotAdjs
        };
      });

      // Background persistence to backend
      const res = await axios.post("/api/settings/slot-adjust", {
        slotKey,
        deltaSeconds
      });

      if (res.data && res.data.success) {
        // Sync the authoritative backend data in-place without touching page loading state
        setSettingsData((prev) => ({
          ...prev,
          effectiveTalkTimeSeconds: res.data.data.effectiveTalkTimeSeconds,
          isManualOverride: true,
          slotAdjustments: res.data.data.slotAdjustments
        }));

        showToast(
          deltaSeconds > 0
            ? `✓ Added +${roundedMins}m to ${slot.timeLabel}`
            : `✓ Subtracted ${Math.abs(roundedMins)}m from ${slot.timeLabel}`
        );

        if (onDataChange) onDataChange();
      }
    } catch (err) {
      console.error("Error adjusting slot talktime:", err);
      showToast("❌ Failed to adjust slot talk-time");
      fetchData(false);
    }
  };

  // Submit custom minutes (e.g. user enters 9 for a 9-minute call)
  const handleCustomSubmit = async (slot) => {
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      setCustomSlotId(null);
      setCustomMinutes("");
      return;
    }
    setCustomSlotId(null);
    setCustomMinutes("");
    await handleSlotQuickAdd(slot, mins * 60);
  };

  return (
    <div className="page" style={{ maxWidth: "1140px", margin: "0 auto", paddingBottom: "3rem" }}>
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

      {/* TOP HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1 style={{ fontSize: "clamp(1.2rem, 3.5vw, 1.75rem)", fontWeight: 800, color: "var(--text)", margin: 0 }}>
              🎯 Target & 30-Min Pacing Planner
            </h1>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                background: "rgba(79, 70, 229, 0.12)",
                color: "var(--accent)",
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px"
              }}
            >
              LIVE PACING
            </span>
          </div>
          <p style={{ color: "var(--text2)", fontSize: "0.88rem", marginTop: "0.35rem", marginBottom: 0 }}>
            Dynamic required talk-time calculated across remaining 30-minute intervals • Break strictly excluded.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowCalibrationModal(true)}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 700 }}
            title="Calibrate talk-time directly from Ozonetel portal"
          >
            ✏️ Calibrate Talk-Time
          </button>
          <Link to="/settings" className="btn btn-outline btn-sm" style={{ fontWeight: 600 }}>
            ⚙️ Shift Settings
          </Link>
          <Link to="/" className="btn btn-secondary btn-sm">
            🏠 Dashboard
          </Link>
        </div>
      </div>

      {/* ACTIVE STATUS BANNER */}
      <div
        style={{
          background: "var(--surface)",
          border: `1px solid ${pacingColor}`,
          borderLeft: `5px solid ${pacingColor}`,
          borderRadius: "var(--radius)",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: `${pacingColor}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem"
            }}
          >
            {isTargetMet ? "🎉" : pacingHealth === "critical" ? "🚨" : pacingHealth === "moderate" ? "⚡" : "🟢"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: pacingColor }}>
              {pacingMessage}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: "0.2rem" }}>
              Shift: <strong>{settings.loginTime}</strong> to <strong>{settings.logoutTime}</strong> • Lunch Break: <strong>{settings.breakStartTime} – {settings.breakEndTime} (Excluded)</strong>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: "180px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
            Current Time
          </div>
          <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          {currentSlot && (
            <div style={{ fontSize: "0.78rem", color: currentSlot.isBreak ? "#b45309" : "var(--accent)", fontWeight: 700 }}>
              {currentSlot.isBreak ? "☕ In Break Window" : `Active Slot: ${currentSlot.timeLabel}`}
            </div>
          )}
        </div>
      </div>

      {/* 5-KPI METRIC CARDS GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        {/* 1. Target */}
        <div className="card-padded" style={{ padding: "1.1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
            Today's Target
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: "0.2rem" }}>
            {formatDuration(targetSeconds)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "0.2rem" }}>
            {settings.targetMinutes} minutes required
          </div>
        </div>

        {/* 2. Completed Today */}
        <div className="card-padded" style={{ padding: "1.1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
              Completed Today
            </div>
            {settingsData?.isManualOverride && (
              <span style={{ fontSize: "0.68rem", background: "rgba(5, 150, 105, 0.15)", color: "#059669", padding: "0.1rem 0.35rem", borderRadius: "4px", fontWeight: 700 }}>
                Portal ✓
              </span>
            )}
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: isTargetMet ? "#059669" : "var(--accent)", marginTop: "0.2rem" }}>
            {formatDuration(effectiveTalkTimeSeconds)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "0.2rem" }}>
            {progressPercent}% of target achieved
          </div>
        </div>

        {/* 3. Remaining */}
        <div className="card-padded" style={{ padding: "1.1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
            Remaining Talk-Time
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: remainingSeconds === 0 ? "#059669" : "#ea580c", marginTop: "0.2rem" }}>
            {formatDuration(remainingSeconds)}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "0.2rem" }}>
            {remainingSeconds === 0 ? "Goal completed!" : "Needed before logout"}
          </div>
        </div>

        {/* 4. Remaining Slots */}
        <div className="card-padded" style={{ padding: "1.1rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>
            Remaining 30m Blocks
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: "0.2rem" }}>
            {remainingWorkingSlots} <span style={{ fontSize: "0.9rem", color: "var(--text3)" }}>/ {totalWorkingSlots}</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "0.2rem" }}>
            Excluding break period
          </div>
        </div>

        {/* 5. Required Pace */}
        <div
          className="card-padded"
          style={{
            padding: "1.1rem",
            background: isTargetMet ? "rgba(16, 185, 129, 0.08)" : "rgba(79, 70, 229, 0.08)",
            border: `1px solid ${isTargetMet ? "#10b981" : "var(--accent)"}`
          }}
        >
          <div style={{ fontSize: "0.75rem", color: isTargetMet ? "#059669" : "var(--accent)", fontWeight: 800, textTransform: "uppercase" }}>
            ⚡ Required Pace
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: isTargetMet ? "#059669" : "var(--accent)", marginTop: "0.2rem" }}>
            {isTargetMet ? "Goal Met! ✓" : `~${formatDurationPace(requiredPacePerSlot)}`}
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text2)", fontWeight: 600, marginTop: "0.2rem" }}>
            {isTargetMet ? "100% Target Done" : "Per 30-min working block"}
          </div>
        </div>
      </div>

      {/* OVERALL PROGRESS BAR */}
      <div className="card-padded" style={{ marginBottom: "1.75rem", padding: "1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.45rem" }}>
          <span style={{ color: "var(--text)" }}>
            Today's Target Progress ({formatDuration(effectiveTalkTimeSeconds)} of {formatDuration(targetSeconds)})
          </span>
          <span style={{ color: progressPercent >= 100 ? "#059669" : "var(--accent)" }}>
            {progressPercent}% Complete
          </span>
        </div>
        <div style={{ width: "100%", height: "12px", background: "var(--surface2)", borderRadius: "9999px", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, progressPercent)}%`,
              height: "100%",
              background: progressPercent >= 100 ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #4f46e5, #7c3aed)",
              borderRadius: "9999px",
              transition: "width 0.5s ease"
            }}
          />
        </div>
      </div>

      {/* 30-MINUTE INTERVAL SCHEDULE BREAKDOWN */}
      <div className="card-padded" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 className="section-title" style={{ margin: 0 }}>
              📅 30-Minute Interval Schedule Breakdown
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text3)", margin: "0.2rem 0 0 0" }}>
              Every half-hour of your shift analyzed. Break slots are automatically zero-quota.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.78rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} /> Past (Completed)
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} /> ⚡ Current Active
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b45309" }} /> ☕ Break (Excluded)
            </span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "0.75rem", textAlign: "left" }}>Time Window</th>
                <th style={{ padding: "0.75rem", textAlign: "center" }}>Type</th>
                <th style={{ padding: "0.75rem", textAlign: "center" }}>Status</th>
                <th style={{ padding: "0.75rem", textAlign: "center" }}>Calls Logged</th>
                <th style={{ padding: "0.75rem", textAlign: "center" }}>Talk-Time Achieved</th>
                <th style={{ padding: "0.75rem", textAlign: "center" }}>Required Target</th>
                <th style={{ padding: "0.75rem", textAlign: "right" }}>Performance</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const isCurrent = slot.status === "current";
                const isPast = slot.status === "past";
                const isBreak = slot.isBreak;
                const metTarget = isPast && slot.actualSeconds >= slot.targetSeconds;
                const isExpanded = expandedSlotId === slot.id;

                let rowBg = "transparent";
                if (isCurrent) rowBg = "rgba(79, 70, 229, 0.06)";
                else if (isBreak) rowBg = "rgba(245, 158, 11, 0.05)";

                return (
                  <React.Fragment key={slot.id}>
                    <tr
                      style={{
                        background: rowBg,
                        borderBottom: "1px solid var(--border)",
                        cursor: slot.callsCount > 0 ? "pointer" : "default"
                      }}
                      onClick={() => {
                        if (slot.callsCount > 0) {
                          setExpandedSlotId(isExpanded ? null : slot.id);
                        }
                      }}
                    >
                      {/* 1. Time Window */}
                      <td style={{ padding: "0.75rem", fontWeight: isCurrent ? 800 : 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {isCurrent && <span style={{ animation: "pulse 1.5s infinite", fontSize: "0.9rem" }}>⚡</span>}
                          {isBreak && <span>☕</span>}
                          <span>{slot.timeLabel}</span>
                        </div>
                      </td>

                      {/* 2. Type */}
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        {isBreak ? (
                          <span style={{ fontSize: "0.72rem", background: "rgba(245, 158, 11, 0.15)", color: "#b45309", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontWeight: 700 }}>
                            ☕ Break Window
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.72rem", background: "var(--surface2)", color: "var(--text2)", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontWeight: 600 }}>
                            Working Slot
                          </span>
                        )}
                      </td>

                      {/* 3. Status */}
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        {isCurrent ? (
                          <span style={{ fontSize: "0.75rem", background: "var(--accent)", color: "#ffffff", padding: "0.2rem 0.6rem", borderRadius: "9999px", fontWeight: 800 }}>
                            ⚡ ACTIVE NOW
                          </span>
                        ) : isPast ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--text3)", fontWeight: 600 }}>
                            Passed
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text2)", fontWeight: 600 }}>
                            Upcoming ⏳
                          </span>
                        )}
                      </td>

                      {/* 4. Calls in Slot */}
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        {slot.callsCount > 0 ? (
                          <span style={{ fontWeight: 700, color: "var(--accent)", textDecoration: "underline" }} title="Click to view calls made in this slot">
                            {slot.callsCount} calls ▾
                          </span>
                        ) : (
                          <span style={{ color: "var(--text3)" }}>0</span>
                        )}
                      </td>

                      {/* 5. Actual Talk-Time with Fast +1m, +5m, +Custom (Zero Page Reload) */}
                      <td style={{ padding: "0.55rem 0.5rem", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                          {/* Time display */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                            <span
                              style={{
                                fontWeight: slot.actualSeconds > 0 ? 800 : 500,
                                color: slot.actualSeconds > 0 ? "var(--text)" : "var(--text3)",
                                fontSize: "0.92rem"
                              }}
                            >
                              {formatDuration(slot.actualSeconds)}
                            </span>
                            {slot.slotAddedSeconds > 0 && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  background: "rgba(5, 150, 105, 0.14)",
                                  color: "#059669",
                                  fontWeight: 800,
                                  padding: "0.08rem 0.35rem",
                                  borderRadius: "4px"
                                }}
                                title={`${formatDuration(slot.baseActualSeconds)} from CRM + ${formatDuration(slot.slotAddedSeconds)} manual`}
                              >
                                +${Math.round(slot.slotAddedSeconds / 60)}m
                              </span>
                            )}
                          </div>

                          {/* Quick Adjust Buttons */}
                          {!isBreak && (
                            <div onClick={(e) => e.stopPropagation()}>
                              {customSlotId === slot.id ? (
                                /* Inline Custom Minutes Form (e.g. type 9 and press enter) */
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    handleCustomSubmit(slot);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    background: "var(--surface)",
                                    padding: "0.15rem 0.3rem",
                                    borderRadius: "6px",
                                    border: "1px solid var(--accent)",
                                    boxShadow: "0 2px 8px rgba(79, 70, 229, 0.2)"
                                  }}
                                >
                                  <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    placeholder="mins"
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(e.target.value)}
                                    autoFocus
                                    style={{
                                      width: "55px",
                                      height: "24px",
                                      fontSize: "0.78rem",
                                      fontWeight: 700,
                                      padding: "0 0.35rem",
                                      borderRadius: "4px",
                                      border: "1px solid var(--border)",
                                      background: "var(--surface2)",
                                      color: "var(--text)",
                                      outline: "none"
                                    }}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{
                                      height: "24px",
                                      padding: "0 0.45rem",
                                      fontSize: "0.72rem",
                                      fontWeight: 800,
                                      borderRadius: "4px",
                                      lineHeight: 1
                                    }}
                                    title="Add minutes to this slot"
                                  >
                                    + Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomSlotId(null);
                                      setCustomMinutes("");
                                    }}
                                    style={{
                                      height: "24px",
                                      padding: "0 0.3rem",
                                      fontSize: "0.75rem",
                                      background: "transparent",
                                      border: "none",
                                      color: "var(--text3)",
                                      cursor: "pointer"
                                    }}
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </form>
                              ) : (
                                /* Fast 1-Click Action Pills: +1m, +5m, +..., -1m */
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", flexWrap: "wrap", justifyContent: "center" }}>
                                  {/* +1m */}
                                  <button
                                    type="button"
                                    onClick={() => handleSlotQuickAdd(slot, 60)}
                                    title={`Add +1 minute to ${slot.timeLabel}`}
                                    style={{
                                      background: isCurrent ? "var(--accent)" : "var(--surface2)",
                                      color: isCurrent ? "#ffffff" : "var(--accent)",
                                      border: isCurrent ? "1px solid var(--accent)" : "1px solid var(--border)",
                                      borderRadius: "5px",
                                      fontSize: "0.74rem",
                                      fontWeight: 800,
                                      padding: "0.18rem 0.45rem",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                      lineHeight: 1
                                    }}
                                  >
                                    +1m
                                  </button>

                                  {/* +5m */}
                                  <button
                                    type="button"
                                    onClick={() => handleSlotQuickAdd(slot, 300)}
                                    title={`Add +5 minutes to ${slot.timeLabel}`}
                                    style={{
                                      background: "var(--surface2)",
                                      color: "var(--accent)",
                                      border: "1px solid var(--border)",
                                      borderRadius: "5px",
                                      fontSize: "0.74rem",
                                      fontWeight: 800,
                                      padding: "0.18rem 0.45rem",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                      lineHeight: 1
                                    }}
                                  >
                                    +5m
                                  </button>

                                  {/* + Custom Minutes (e.g. type 9 in 1 step!) */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomSlotId(slot.id);
                                      setCustomMinutes("");
                                    }}
                                    title={`Enter custom minutes for ${slot.timeLabel} (e.g. 9 min)`}
                                    style={{
                                      background: "var(--surface2)",
                                      color: "var(--text2)",
                                      border: "1px solid var(--border)",
                                      borderRadius: "5px",
                                      fontSize: "0.72rem",
                                      fontWeight: 700,
                                      padding: "0.18rem 0.4rem",
                                      cursor: "pointer",
                                      lineHeight: 1
                                    }}
                                  >
                                    +...
                                  </button>

                                  {/* -1m (if minutes were added) */}
                                  {slot.slotAddedSeconds > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSlotQuickAdd(slot, -60)}
                                      title={`Subtract 1 minute (Added: +${Math.round(slot.slotAddedSeconds / 60)}m)`}
                                      style={{
                                        background: "rgba(239, 68, 68, 0.1)",
                                        color: "#dc2626",
                                        border: "1px solid rgba(239, 68, 68, 0.25)",
                                        borderRadius: "5px",
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        padding: "0.18rem 0.35rem",
                                        cursor: "pointer",
                                        lineHeight: 1
                                      }}
                                    >
                                      -1m
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 6. Required Target */}
                      <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: 700, color: isBreak ? "var(--text3)" : isCurrent || !isPast ? "var(--accent)" : "var(--text2)" }}>
                        {isBreak ? (
                          <span style={{ color: "var(--text3)" }}>—</span>
                        ) : isTargetMet ? (
                          <span style={{ color: "#059669" }}>Goal Met ✓</span>
                        ) : (
                          <span>~{formatDurationPace(slot.targetSeconds)}</span>
                        )}
                      </td>

                      {/* 7. Performance */}
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        {isBreak ? (
                          <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600 }}>
                            Excluded ✓
                          </span>
                        ) : isCurrent ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 800 }}>
                            In Progress ⚡
                          </span>
                        ) : isPast ? (
                          metTarget ? (
                            <span style={{ fontSize: "0.75rem", background: "rgba(5, 150, 105, 0.15)", color: "#059669", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontWeight: 700 }}>
                              ✓ Target Met
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.12)", color: "#dc2626", padding: "0.15rem 0.5rem", borderRadius: "9999px", fontWeight: 600 }}>
                              Under Pace
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                            Target: ~{formatDurationPace(slot.targetSeconds)}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* EXPANDED CALL LOG DETAILS FOR THIS SLOT */}
                    {isExpanded && slot.callsInSlot && slot.callsInSlot.length > 0 && (
                      <tr style={{ background: "var(--surface2)" }}>
                        <td colSpan={7} style={{ padding: "0.75rem 1.25rem" }}>
                          <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text)", marginBottom: "0.5rem" }}>
                            📞 Calls Logged in Window ({slot.timeLabel}):
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {slot.callsInSlot.map((call, cIdx) => (
                              <div
                                key={cIdx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  background: "var(--surface)",
                                  padding: "0.45rem 0.75rem",
                                  borderRadius: "4px",
                                  border: "1px solid var(--border)",
                                  fontSize: "0.82rem"
                                }}
                              >
                                <div>
                                  <Link to={`/leads/${call.leadId}`} style={{ fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
                                    {call.name}
                                  </Link>{" "}
                                  <span style={{ color: "var(--text3)" }}>({call.phone})</span> • <span style={{ color: "var(--text2)" }}>{call.outcome}</span>
                                </div>
                                <div style={{ fontWeight: 700, color: "#059669" }}>
                                  ⏱️ {formatDuration(call.duration)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK CALIBRATION MODAL */}
      <TalktimeCalibrationModal
        isOpen={showCalibrationModal}
        onClose={() => setShowCalibrationModal(false)}
        currentEffectiveSeconds={settingsData?.effectiveTalkTimeSeconds}
        currentCrmSeconds={settingsData?.crmTalkTimeSeconds}
        isManualOverride={settingsData?.isManualOverride}
        onSaved={() => {
          showToast("✓ Talk-time calibrated successfully!");
          fetchData(false);
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}
