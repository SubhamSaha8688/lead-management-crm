import React, { useState, useEffect } from "react";
import axios from "axios";
import { formatDuration } from "../utils/pacing";
import TalktimeCalibrationModal from "./TalktimeCalibrationModal";
import DailyTargetModal from "./DailyTargetModal";

export default function MonthlyLedgerView({ onDataChange }) {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [toastMessage, setToastMessage] = useState("");
  const [showProofPreview, setShowProofPreview] = useState(false);

  // Modals state
  const [calibratingDateItem, setCalibratingDateItem] = useState(null);
  const [targetDateItem, setTargetDateItem] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchLedger = async (monthKey = selectedMonth, isInitial = false) => {
    try {
      if (isInitial && !ledgerData) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
      const res = await axios.get(`/api/settings/monthly-ledger?month=${monthKey}`);
      if (res.data?.success) {
        setLedgerData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load monthly ledger:", err);
      showToast("Failed to load monthly ledger data.");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchLedger(selectedMonth, true);
  }, [selectedMonth]);

  // Instant optimistic update when calibration is saved (0ms UI latency)
  const handleCalibrationSaved = (savedData, totalSeconds) => {
    const targetDate = calibratingDateItem?.date;
    const newSecs =
      savedData?.effectiveTalkTimeSeconds !== undefined
        ? savedData.effectiveTalkTimeSeconds
        : totalSeconds;

    setLedgerData((prev) => {
      if (!prev || !prev.days) return prev;
      const updatedDays = prev.days.map((d) => {
        if (d.date !== targetDate) return d;
        const diff = newSecs - d.targetSeconds;
        let newStatus = d.status;
        if (!d.isOffDay && !d.isFuture) {
          if (d.isToday) {
            newStatus = newSecs >= d.targetSeconds ? "achieved" : "in_progress";
          } else {
            newStatus = newSecs >= d.targetSeconds ? "achieved" : "risk";
          }
        }
        return {
          ...d,
          effectiveSeconds: newSecs,
          differenceSeconds: diff,
          isTargetMet: newSecs >= d.targetSeconds,
          isManualOverride: true,
          status: newStatus
        };
      });

      let totalAchieved = 0;
      let achievedCount = 0;
      let riskCount = 0;
      updatedDays.forEach((d) => {
        if (!d.isOffDay && !d.isFuture) {
          totalAchieved += d.effectiveSeconds;
          if (d.effectiveSeconds >= d.targetSeconds) achievedCount++;
          else if (d.isPast) riskCount++;
        }
      });

      const netBalance = totalAchieved - prev.totalTargetSeconds;

      return {
        ...prev,
        totalAchievedSeconds: totalAchieved,
        netBalanceSeconds: netBalance,
        achievedDaysCount: achievedCount,
        riskDaysCount: riskCount,
        safeSalaryStatus: riskCount === 0 ? "PROTECTED" : "AT_RISK",
        days: updatedDays
      };
    });

    showToast(`✓ Updated talk-time for ${targetDate}.`);
    // Background silent sync without flashing loading screen
    fetchLedger(selectedMonth, false);
    if (onDataChange) onDataChange();
  };

  // Instant optimistic update when target is saved (0ms UI latency)
  const handleTargetSaved = (savedData) => {
    const targetDate = targetDateItem?.date;
    const newTargetMins = savedData?.targetMinutes || 0;
    const isOffDay = Boolean(savedData?.isOffDay);
    const newTargetSecs = isOffDay ? 0 : newTargetMins * 60;

    setLedgerData((prev) => {
      if (!prev || !prev.days) return prev;
      let totalTarget = 0;
      let totalAchieved = 0;
      let achievedCount = 0;
      let riskCount = 0;
      let workingCount = 0;

      const updatedDays = prev.days.map((d) => {
        if (d.date !== targetDate) {
          if (!d.isOffDay && !d.isFuture) {
            workingCount++;
            totalTarget += d.targetSeconds;
            totalAchieved += d.effectiveSeconds;
            if (d.effectiveSeconds >= d.targetSeconds) achievedCount++;
            else if (d.isPast) riskCount++;
          }
          return d;
        }

        const diff = d.effectiveSeconds - newTargetSecs;
        let newStatus = isOffDay ? "off" : d.status;
        if (!isOffDay && !d.isFuture) {
          if (d.isToday) {
            newStatus = d.effectiveSeconds >= newTargetSecs ? "achieved" : "in_progress";
          } else {
            newStatus = d.effectiveSeconds >= newTargetSecs ? "achieved" : "risk";
          }
        }

        if (!isOffDay && !d.isFuture) {
          workingCount++;
          totalTarget += newTargetSecs;
          totalAchieved += d.effectiveSeconds;
          if (d.effectiveSeconds >= newTargetSecs) achievedCount++;
          else if (d.isPast) riskCount++;
        }

        return {
          ...d,
          isOffDay,
          targetMinutes: newTargetMins,
          targetSeconds: newTargetSecs,
          differenceSeconds: diff,
          isTargetMet: d.effectiveSeconds >= newTargetSecs,
          status: newStatus
        };
      });

      const netBalance = totalAchieved - totalTarget;

      return {
        ...prev,
        workingDaysCount: workingCount,
        totalTargetSeconds: totalTarget,
        totalAchievedSeconds: totalAchieved,
        netBalanceSeconds: netBalance,
        achievedDaysCount: achievedCount,
        riskDaysCount: riskCount,
        safeSalaryStatus: riskCount === 0 ? "PROTECTED" : "AT_RISK",
        days: updatedDays
      };
    });

    showToast(`✓ Updated target for ${targetDate}.`);
    // Background silent sync without flashing loading screen
    fetchLedger(selectedMonth, false);
    if (onDataChange) onDataChange();
  };

  // Navigate months
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonthKey);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    const newMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonthKey);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const currKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(currKey);
  };

  // Copy TL Proof Report
  const handleCopyProof = () => {
    if (!ledgerData?.proofText) return;
    navigator.clipboard.writeText(ledgerData.proofText)
      .then(() => {
        showToast("📋 TL Proof Report copied to clipboard! Ready to paste.");
      })
      .catch(() => {
        showToast("Failed to copy report to clipboard.");
      });
  };

  // Share via WhatsApp Web/App
  const handleShareWhatsApp = () => {
    if (!ledgerData?.proofText) return;
    const url = `https://wa.me/?text=${encodeURIComponent(ledgerData.proofText)}`;
    window.open(url, "_blank");
  };

  // Helper format seconds
  const formatSecs = (sec) => {
    if (!sec && sec !== 0) return "0s";
    return formatDuration(sec);
  };

  return (
    <div className="monthly-ledger-container" style={{ animation: "fadeIn 0.2s ease" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f172a",
            color: "#fff",
            padding: "0.6rem 1.25rem",
            borderRadius: "30px",
            fontSize: "0.88rem",
            fontWeight: 700,
            zIndex: 9999,
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* TOP HEADER & MONTH CONTROLS */}
      <div
        className="card"
        style={{
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
          background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem"
          }}
        >
          {/* Title & Description */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.75rem" }}>📅</span>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
                Talk-Time Monthly Ledger & Audit
              </h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text3)", margin: "0.15rem 0 0 0" }}>
                Day-by-day targets, shortfall/surplus tracking, and salary deduction protection
              </p>
            </div>
          </div>

          {/* Month Selector Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handlePrevMonth}
              title="Previous Month"
              style={{ fontWeight: 700, padding: "0.35rem 0.65rem" }}
            >
              ◀ Prev
            </button>
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "var(--text)",
                padding: "0.35rem 0.85rem",
                background: "var(--surface)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                minWidth: "150px",
                textAlign: "center"
              }}
            >
              {ledgerData?.monthLabel || selectedMonth}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleNextMonth}
              title="Next Month"
              style={{ fontWeight: 700, padding: "0.35rem 0.65rem" }}
            >
              Next ▶
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleCurrentMonth}
              title="Jump to Current Month"
              style={{ fontWeight: 700, padding: "0.35rem 0.65rem" }}
            >
              📍 This Month
            </button>
            {isSyncing && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#6366f1",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  padding: "0.2rem 0.5rem",
                  background: "rgba(99, 102, 241, 0.1)",
                  borderRadius: "6px"
                }}
              >
                🔄 Saving...
              </span>
            )}
          </div>
        </div>
      </div>

      {loading && !ledgerData ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
          <p>Calculating monthly talk-time audit & calls...</p>
        </div>
      ) : !ledgerData ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text2)" }}>
          No data available for this month.
        </div>
      ) : (
        <>
          {/* MONTHLY SUMMARY METRICS SCORECARD */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem"
            }}
          >
            {/* Target Hours */}
            <div
              className="card"
              style={{
                padding: "1rem 1.25rem",
                borderLeft: "4px solid #6366f1",
                background: "var(--surface)"
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text3)" }}>
                🎯 Month Target
              </div>
              <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "var(--text)", margin: "0.2rem 0" }}>
                {formatSecs(ledgerData.totalTargetSeconds)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                Across {ledgerData.workingDaysCount} active working days
              </div>
            </div>

            {/* Achieved Hours */}
            <div
              className="card"
              style={{
                padding: "1rem 1.25rem",
                borderLeft: "4px solid #10b981",
                background: "var(--surface)"
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text3)" }}>
                ⏱️ Achieved Talk-Time
              </div>
              <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#10b981", margin: "0.2rem 0" }}>
                {formatSecs(ledgerData.totalAchievedSeconds)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                {ledgerData.totalCallsCount} calls logged
              </div>
            </div>

            {/* Net Balance Surplus / Deficit */}
            <div
              className="card"
              style={{
                padding: "1rem 1.25rem",
                borderLeft: `4px solid ${ledgerData.netBalanceSeconds >= 0 ? "#10b981" : "#ef4444"}`,
                background: "var(--surface)"
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text3)" }}>
                ⚖️ Net Month Balance
              </div>
              <div
                style={{
                  fontSize: "1.45rem",
                  fontWeight: 900,
                  color: ledgerData.netBalanceSeconds >= 0 ? "#10b981" : "#ef4444",
                  margin: "0.2rem 0"
                }}
              >
                {ledgerData.netBalanceSeconds >= 0 ? "+" : "-"}
                {formatSecs(Math.abs(ledgerData.netBalanceSeconds))}
              </div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: ledgerData.netBalanceSeconds >= 0 ? "#10b981" : "#ef4444" }}>
                {ledgerData.netBalanceSeconds >= 0 ? "Surplus (Ahead of Target) ✅" : "Deficit (Behind Target) ⚠️"}
              </div>
            </div>

            {/* Target Adherence & Salary Risk */}
            <div
              className="card"
              style={{
                padding: "1rem 1.25rem",
                borderLeft: `4px solid ${ledgerData.riskDaysCount === 0 ? "#10b981" : "#f59e0b"}`,
                background: "var(--surface)"
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text3)" }}>
                🛡️ Salary & Deduction Status
              </div>
              <div
                style={{
                  fontSize: "1.45rem",
                  fontWeight: 900,
                  color: ledgerData.riskDaysCount === 0 ? "#10b981" : "#d97706",
                  margin: "0.2rem 0"
                }}
              >
                {ledgerData.riskDaysCount === 0 ? "Protected" : `${ledgerData.riskDaysCount} Days At Risk`}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
                {ledgerData.achievedDaysCount} / {ledgerData.workingDaysCount} days achieved ({ledgerData.successRatePercent}%)
              </div>
            </div>
          </div>

          {/* 1-CLICK PROOF REPORT BAR */}
          <div
            className="card"
            style={{
              padding: "1rem 1.25rem",
              marginBottom: "1.25rem",
              background: "linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)",
              border: "1px solid rgba(79, 70, 229, 0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.3rem" }}>📋</span>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>
                  Team Lead / Manager Proof Report
                </h4>
                <p style={{ margin: "0.1rem 0 0 0", fontSize: "0.78rem", color: "var(--text2)" }}>
                  1-Click verified audit summary of working days, talk-time, and call volume
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCopyProof}
                style={{
                  background: "#4f46e5",
                  borderColor: "#4f46e5",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  padding: "0.35rem 0.8rem"
                }}
              >
                📋 Copy TL Proof Text
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleShareWhatsApp}
                style={{
                  color: "#16a34a",
                  borderColor: "#16a34a",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  padding: "0.35rem 0.8rem"
                }}
              >
                📲 Send via WhatsApp
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowProofPreview(!showProofPreview)}
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.6rem" }}
              >
                {showProofPreview ? "Hide Preview" : "👁️ Preview"}
              </button>
            </div>
          </div>

          {/* Collapsible Proof Preview Box */}
          {showProofPreview && (
            <div
              className="card"
              style={{
                padding: "1rem",
                marginBottom: "1.25rem",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                fontSize: "0.82rem",
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                maxHeight: "260px",
                overflowY: "auto"
              }}
            >
              {ledgerData.proofText}
            </div>
          )}

          {/* DAY-BY-DAY AUDIT TABLE */}
          <div className="card" style={{ padding: "0", overflow: "hidden", border: "1px solid var(--border)" }}>
            <div
              style={{
                padding: "0.9rem 1.25rem",
                background: "var(--surface2)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>
                🗓️ Daily Talk-Time Breakdown ({ledgerData.monthLabel})
              </h3>
              <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
                Click ✏️ Target to change daily target • Click ⏱️ to calibrate with Ozonetel
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Date</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Target</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Achieved Talk-Time</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Calls</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Balance (+/-)</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)" }}>Status</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 800, color: "var(--text)", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.days.map((d) => {
                    const isToday = d.isToday;
                    const isDeficit = d.status === "risk";
                    const isAchieved = d.status === "achieved";
                    const isOff = d.isOffDay;
                    const isFuture = d.isFuture;

                    let rowBg = "transparent";
                    if (isToday) rowBg = "rgba(79, 70, 229, 0.08)";
                    else if (isOff) rowBg = "rgba(100, 116, 139, 0.04)";

                    return (
                      <tr
                        key={d.date}
                        style={{
                          background: rowBg,
                          borderBottom: "1px solid var(--border)",
                          borderLeft: isToday ? "4px solid #4f46e5" : (isDeficit ? "4px solid #ef4444" : "none")
                        }}
                      >
                        {/* Date & Day */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontWeight: isToday ? 900 : 700, color: isToday ? "#4f46e5" : "var(--text)" }}>
                              {d.dayNumber} {ledgerData.monthLabel.slice(0, 3)}
                            </span>
                            <span style={{ fontSize: "0.78rem", color: isOff ? "#94a3b8" : "var(--text3)", fontWeight: 600 }}>
                              ({d.dayOfWeek})
                            </span>
                            {isToday && (
                              <span
                                style={{
                                  background: "#4f46e5",
                                  color: "#fff",
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                  padding: "0.15rem 0.45rem",
                                  borderRadius: "10px"
                                }}
                              >
                                TODAY
                              </span>
                            )}
                          </div>
                          {d.note && (
                            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: "0.15rem" }}>
                              📝 {d.note}
                            </div>
                          )}
                        </td>

                        {/* Target */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          {isOff ? (
                            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "0.8rem" }}>
                              ⚪ OFF / Holiday
                            </span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <span style={{ fontWeight: 800, color: "var(--text)" }}>
                                {formatSecs(d.targetSeconds)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setTargetDateItem(d)}
                                title="Change target for this day"
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "0.85rem",
                                  padding: "0.1rem 0.25rem",
                                  opacity: 0.7
                                }}
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Achieved Talk-Time */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          {isFuture ? (
                            <span style={{ color: "var(--text3)", fontSize: "0.8rem" }}>—</span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: "0.9rem",
                                  color: isAchieved ? "#10b981" : (isDeficit ? "#ef4444" : "var(--text)")
                                }}
                              >
                                {formatSecs(d.effectiveSeconds)}
                              </span>
                              {d.isManualOverride && (
                                <span
                                  title="Calibrated manually with Ozonetel portal"
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: "4px",
                                    background: "rgba(245, 158, 11, 0.15)",
                                    color: "#d97706",
                                    fontWeight: 700
                                  }}
                                >
                                  Synced
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Calls Count */}
                        <td style={{ padding: "0.75rem 1rem", color: "var(--text2)", whiteSpace: "nowrap" }}>
                          {isFuture ? "—" : `${d.callsCount} calls`}
                        </td>

                        {/* Balance (+/-) */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          {isFuture || isOff ? (
                            <span style={{ color: "var(--text3)", fontSize: "0.8rem" }}>—</span>
                          ) : (
                            <span
                              style={{
                                fontWeight: 800,
                                color: d.differenceSeconds >= 0 ? "#10b981" : "#ef4444",
                                fontSize: "0.85rem"
                              }}
                            >
                              {d.differenceSeconds >= 0 ? "+" : "-"}
                              {formatSecs(Math.abs(d.differenceSeconds))}
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          {isOff ? (
                            <span
                              style={{
                                padding: "0.2rem 0.5rem",
                                borderRadius: "12px",
                                background: "rgba(100, 116, 139, 0.12)",
                                color: "#64748b",
                                fontSize: "0.72rem",
                                fontWeight: 700
                              }}
                            >
                              OFF
                            </span>
                          ) : isFuture ? (
                            <span style={{ color: "var(--text3)", fontSize: "0.75rem" }}>Upcoming</span>
                          ) : isToday ? (
                            <span
                              style={{
                                padding: "0.2rem 0.5rem",
                                borderRadius: "12px",
                                background: isAchieved ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                color: isAchieved ? "#10b981" : "#d97706",
                                fontSize: "0.72rem",
                                fontWeight: 800
                              }}
                            >
                              {isAchieved ? "🟢 MET" : "🟡 IN PROGRESS"}
                            </span>
                          ) : isAchieved ? (
                            <span
                              style={{
                                padding: "0.2rem 0.5rem",
                                borderRadius: "12px",
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#10b981",
                                fontSize: "0.72rem",
                                fontWeight: 800
                              }}
                            >
                              🟢 MET
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: "0.2rem 0.5rem",
                                borderRadius: "12px",
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                fontSize: "0.72rem",
                                fontWeight: 800
                              }}
                              title="Talk-time fell short of target for this day"
                            >
                              🔴 DEFICIT RISK
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                          {!isFuture && (
                            <div style={{ display: "inline-flex", gap: "0.3rem" }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setCalibratingDateItem(d)}
                                title="Calibrate talk-time for this date (sync with Ozonetel dialer)"
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.25rem 0.5rem",
                                  fontWeight: 700,
                                  borderColor: d.isManualOverride ? "#f59e0b" : "var(--border)",
                                  color: d.isManualOverride ? "#d97706" : "var(--text)"
                                }}
                              >
                                ⏱️ {d.isManualOverride ? "Calibrated" : "Calibrate"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => setTargetDateItem(d)}
                                title="Change target or mark off day"
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.25rem 0.45rem",
                                  fontWeight: 600
                                }}
                              >
                                🎯 Target
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CALIBRATION MODAL PRESET FOR SELECTED DATE */}
      {calibratingDateItem && (
        <TalktimeCalibrationModal
          isOpen={Boolean(calibratingDateItem)}
          onClose={() => setCalibratingDateItem(null)}
          date={calibratingDateItem.date}
          currentEffectiveSeconds={calibratingDateItem.effectiveSeconds}
          currentCrmSeconds={calibratingDateItem.crmSeconds}
          isManualOverride={calibratingDateItem.isManualOverride}
          onSaved={handleCalibrationSaved}
        />
      )}

      {/* DYNAMIC TARGET MODAL FOR SELECTED DATE */}
      {targetDateItem && (
        <DailyTargetModal
          isOpen={Boolean(targetDateItem)}
          onClose={() => setTargetDateItem(null)}
          date={targetDateItem.date}
          currentTargetMinutes={targetDateItem.targetMinutes}
          isOffDay={targetDateItem.isOffDay}
          currentNote={targetDateItem.note}
          onSaved={handleTargetSaved}
        />
      )}
    </div>
  );
}
